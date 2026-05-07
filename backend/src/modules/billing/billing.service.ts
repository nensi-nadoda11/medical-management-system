import { db } from "../../db/client";
import { AppError } from "../../shared/errors/app-error";
import { runDbReads } from "../../shared/db/run-db-reads";
import { logger } from "../../shared/logger";
import {
  moneyMinorUnitsToString,
  roundPercentageAmount,
  sumMoneyMinorUnits,
  toMoneyMinorUnits,
} from "../../shared/utils/money";
import { buildSettlementState } from "../../shared/utils/financials";
import { collapseWhitespace } from "../../shared/utils/strings";
import { AlertsService } from "../alerts/alerts.service";
import { AdminSettingsService } from "../admin-settings/admin-settings.service";
import { AccountingRepository } from "../accounting/accounting.repository";
import { CustomersRepository } from "../customers/customers.repository";
import { InventoryRepository } from "../inventory/inventory.repository";
import { InventoryStockService } from "../inventory/inventory.stock.service";
import { AccountingLedgerService } from "../accounting/accounting-ledger.service";
import { BillingRepository } from "./billing.repository";
import { realtimeService } from "../realtime/realtime.service";
import type {
  ListBillsQuery,
  SaveBillInput,
  SearchSellableMedicinesQuery,
} from "./billing.validation";
import type { DbExecutor } from "../../shared/db/executor";

const buildAppError = (statusCode: number, code: string, message: string) =>
  new AppError({
    statusCode,
    code,
    message,
  });

const normalizeSearchValue = (value: string) =>
  collapseWhitespace(value).toLowerCase();

const buildPaginatedResponse = <T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
) => ({
  items,
  pagination: {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  },
});

const sanitizeInvoicePrefix = (value?: string | null) => {
  const normalized = (value ?? "INV")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 12);

  return normalized || "INV";
};

const buildBillNumber = (invoicePrefix: string, sequence: number) =>
  `${sanitizeInvoicePrefix(invoicePrefix)}-${sequence.toString().padStart(6, "0")}`;

const getCustomerLabel = (customerName?: string | null) =>
  customerName?.trim().length ? customerName : "Walk-in";

const getDaysUntil = (value: Date) => {
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const target = new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  );

  return Math.round(
    (target.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
  );
};

const toSaleListResponse = (record: Awaited<
  ReturnType<BillingRepository["listSales"]>
>[number]) => ({
  id: record.sale.id,
  billNumber: record.sale.billNumber,
  customerId: record.sale.customerId,
  customerName: record.sale.customerName,
  customerPhone: record.sale.customerPhone,
  customerLabel: getCustomerLabel(record.sale.customerName),
  status: record.sale.status,
  paymentStatus: record.sale.paymentStatus,
  paymentMethod: record.sale.paymentMethod,
  subtotal: record.sale.subtotal,
  discountAmount: record.sale.discountAmount,
  taxAmount: record.sale.taxAmount,
  roundOffAmount: record.sale.roundOffAmount,
  grandTotal: record.sale.grandTotal,
  initialPaidAmount: record.sale.initialPaidAmount,
  paidAmount: record.sale.paidAmount,
  dueAmount: record.sale.dueAmount,
  notes: record.sale.notes,
  completedAt: record.sale.completedAt,
  cancelledAt: record.sale.cancelledAt,
  createdAt: record.sale.createdAt,
  updatedAt: record.sale.updatedAt,
  createdBy: record.createdBy,
});

const toSaleDetailResponse = (
  record: NonNullable<Awaited<ReturnType<BillingRepository["findSaleDetailById"]>>>,
) => ({
  id: record.sale.id,
  shopId: record.sale.shopId,
  billSequence: record.sale.billSequence,
  billNumber: record.sale.billNumber,
  customerId: record.sale.customerId,
  customerName: record.sale.customerName,
  customerPhone: record.sale.customerPhone,
  customerLabel: getCustomerLabel(record.sale.customerName),
  status: record.sale.status,
  paymentStatus: record.sale.paymentStatus,
  paymentMethod: record.sale.paymentMethod,
  subtotal: record.sale.subtotal,
  discountAmount: record.sale.discountAmount,
  taxAmount: record.sale.taxAmount,
  roundOffAmount: record.sale.roundOffAmount,
  grandTotal: record.sale.grandTotal,
  initialPaidAmount: record.sale.initialPaidAmount,
  paidAmount: record.sale.paidAmount,
  dueAmount: record.sale.dueAmount,
  notes: record.sale.notes,
  createdByUserId: record.sale.createdByUserId,
  updatedByUserId: record.sale.updatedByUserId,
  completedAt: record.sale.completedAt,
  cancelledAt: record.sale.cancelledAt,
  createdAt: record.sale.createdAt,
  updatedAt: record.sale.updatedAt,
  createdBy: record.createdBy,
  updatedBy: record.updatedBy,
  items: record.items.map(({ item, medicine, batch }) => ({
    id: item.id,
    medicine: {
      id: medicine.id,
      medicineName: medicine.medicineName,
      genericName: medicine.genericName,
      form: medicine.form,
      unit: medicine.unit,
      prescriptionRequired: medicine.prescriptionRequired,
      status: medicine.status,
    },
    batch: {
      id: batch.id,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      status: batch.status,
      quantityAvailable: batch.quantityAvailable,
      isNearExpiry: getDaysUntil(batch.expiryDate) <= 30,
    },
    quantity: item.quantity,
    rate: item.rate,
    mrp: item.mrp,
    gstPercent: item.gstPercent,
    discountPercent: item.discountPercent,
    discountAmount: item.discountAmount,
    lineSubtotal: item.lineSubtotal,
    lineTaxAmount: item.lineTaxAmount,
    lineTotal: item.lineTotal,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  })),
});

type PreparedSaleItem = {
  medicineId: string;
  batchId: string;
  quantity: number;
  rateMinorUnits: number;
  mrpMinorUnits: number;
  gstPercent: number;
  discountPercent: number;
  discountMinorUnits: number;
  lineSubtotalMinorUnits: number;
  lineTaxMinorUnits: number;
  lineTotalMinorUnits: number;
};

type PreparedSaleDraft = {
  items: PreparedSaleItem[];
  totals: {
    subtotalMinorUnits: number;
    discountAmountMinorUnits: number;
    taxAmountMinorUnits: number;
    roundOffMinorUnits: number;
    grandTotalMinorUnits: number;
    paidAmountMinorUnits: number;
    settledPaidMinorUnits: number;
    dueAmountMinorUnits: number;
    paymentStatus: "unpaid" | "partial" | "paid";
  };
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod: "cash" | "upi" | "card" | "bank_transfer" | "split";
  notes?: string;
};

export class BillingService {
  constructor(
    private readonly billingRepository = new BillingRepository(),
    private readonly customersRepository = new CustomersRepository(),
    private readonly accountingRepository = new AccountingRepository(),
    private readonly inventoryRepository = new InventoryRepository(),
    private readonly inventoryStockService = new InventoryStockService(),
    private readonly alertsService = new AlertsService(),
    private readonly accountingLedgerService = new AccountingLedgerService(),
    private readonly adminSettingsService = new AdminSettingsService(),
  ) {}

  async listBills(shopId: string, branchId: string, query: ListBillsQuery) {
    const normalizedQuery = {
      ...query,
      search: query.search ? normalizeSearchValue(query.search) : undefined,
    };

    const items = await this.billingRepository.listSales(
      shopId,
      branchId,
      normalizedQuery,
    );
    const total = await this.billingRepository.countSales(
      shopId,
      branchId,
      normalizedQuery,
    );

    return buildPaginatedResponse(
      items.map(toSaleListResponse),
      total,
      normalizedQuery.page,
      normalizedQuery.pageSize,
    );
  }

  async getBillById(shopId: string, branchId: string, saleId: string) {
    const sale = await this.billingRepository.findSaleDetailById(
      shopId,
      branchId,
      saleId,
    );

    if (!sale) {
      throw buildAppError(404, "BILL_NOT_FOUND", "Bill not found.");
    }

    return toSaleDetailResponse(sale);
  }

  async createHeldBill(
    shopId: string,
    branchId: string,
    userId: string,
    input: SaveBillInput,
  ) {
    const settings = await this.adminSettingsService.getResolvedShopSettings(shopId);

    if (!settings.allowHeldBills) {
      throw buildAppError(
        400,
        "HELD_BILLS_DISABLED",
        "Held bills are disabled in admin settings.",
      );
    }

    const saleId = await db.transaction(async (tx) => {
      const preparedDraft = await this.prepareSaleDraft(
        shopId,
        branchId,
        input,
        settings,
        tx,
      );
      const billMeta = await this.buildBillMeta(shopId, branchId, tx);
      const created = await this.billingRepository.createSale(
        {
          shopId,
          branchId,
          billSequence: billMeta.sequence,
          billNumber: billMeta.billNumber,
          billNumberNormalized: normalizeSearchValue(billMeta.billNumber),
          customerId: preparedDraft.customerId,
          customerName: preparedDraft.customerName,
          customerPhone: preparedDraft.customerPhone,
          status: "held",
          paymentStatus: preparedDraft.totals.paymentStatus,
          paymentMethod: preparedDraft.paymentMethod,
          subtotal: moneyMinorUnitsToString(preparedDraft.totals.subtotalMinorUnits),
          discountAmount: moneyMinorUnitsToString(
            preparedDraft.totals.discountAmountMinorUnits,
          ),
          taxAmount: moneyMinorUnitsToString(preparedDraft.totals.taxAmountMinorUnits),
          roundOffAmount: moneyMinorUnitsToString(
            preparedDraft.totals.roundOffMinorUnits,
          ),
          grandTotal: moneyMinorUnitsToString(
            preparedDraft.totals.grandTotalMinorUnits,
          ),
          initialPaidAmount: moneyMinorUnitsToString(
            preparedDraft.totals.paidAmountMinorUnits,
          ),
          paidAmount: moneyMinorUnitsToString(
            preparedDraft.totals.settledPaidMinorUnits,
          ),
          dueAmount: moneyMinorUnitsToString(preparedDraft.totals.dueAmountMinorUnits),
          notes: preparedDraft.notes,
          createdByUserId: userId,
          updatedByUserId: userId,
        },
        preparedDraft.items.map((item) => ({
          medicineId: item.medicineId,
          batchId: item.batchId,
          quantity: item.quantity,
          rate: moneyMinorUnitsToString(item.rateMinorUnits),
          mrp: moneyMinorUnitsToString(item.mrpMinorUnits),
          gstPercent: item.gstPercent,
          discountPercent: item.discountPercent.toFixed(2),
          discountAmount: moneyMinorUnitsToString(item.discountMinorUnits),
          lineSubtotal: moneyMinorUnitsToString(item.lineSubtotalMinorUnits),
          lineTaxAmount: moneyMinorUnitsToString(item.lineTaxMinorUnits),
          lineTotal: moneyMinorUnitsToString(item.lineTotalMinorUnits),
        })),
        tx,
      );

      return created.sale.id;
    });

    return this.getBillById(shopId, branchId, saleId);
  }

  async updateHeldBill(
    shopId: string,
    branchId: string,
    saleId: string,
    userId: string,
    input: SaveBillInput,
  ) {
    const settings = await this.adminSettingsService.getResolvedShopSettings(shopId);

    if (!settings.allowHeldBills) {
      throw buildAppError(
        400,
        "HELD_BILLS_DISABLED",
        "Held bills are disabled in admin settings.",
      );
    }

    const existingSale = await this.billingRepository.findSaleById(
      shopId,
      branchId,
      saleId,
    );

    if (!existingSale) {
      throw buildAppError(404, "BILL_NOT_FOUND", "Bill not found.");
    }

    if (existingSale.status !== "held") {
      throw buildAppError(
        400,
        "BILL_NOT_EDITABLE",
        "Only held bills can be edited.",
      );
    }

    await db.transaction(async (tx) => {
      const preparedDraft = await this.prepareSaleDraft(
        shopId,
        branchId,
        input,
        settings,
        tx,
      );

      await this.billingRepository.updateSale(
        saleId,
        {
          customerId: preparedDraft.customerId,
          customerName: preparedDraft.customerName,
          customerPhone: preparedDraft.customerPhone,
          paymentStatus: preparedDraft.totals.paymentStatus,
          paymentMethod: preparedDraft.paymentMethod,
          subtotal: moneyMinorUnitsToString(preparedDraft.totals.subtotalMinorUnits),
          discountAmount: moneyMinorUnitsToString(
            preparedDraft.totals.discountAmountMinorUnits,
          ),
          taxAmount: moneyMinorUnitsToString(preparedDraft.totals.taxAmountMinorUnits),
          roundOffAmount: moneyMinorUnitsToString(
            preparedDraft.totals.roundOffMinorUnits,
          ),
          grandTotal: moneyMinorUnitsToString(
            preparedDraft.totals.grandTotalMinorUnits,
          ),
          initialPaidAmount: moneyMinorUnitsToString(
            preparedDraft.totals.paidAmountMinorUnits,
          ),
          paidAmount: moneyMinorUnitsToString(
            preparedDraft.totals.settledPaidMinorUnits,
          ),
          dueAmount: moneyMinorUnitsToString(preparedDraft.totals.dueAmountMinorUnits),
          notes: preparedDraft.notes,
          updatedByUserId: userId,
        },
        tx,
      );

      await this.billingRepository.replaceSaleItems(
        saleId,
        shopId,
        branchId,
        preparedDraft.items.map((item) => ({
          medicineId: item.medicineId,
          batchId: item.batchId,
          quantity: item.quantity,
          rate: moneyMinorUnitsToString(item.rateMinorUnits),
          mrp: moneyMinorUnitsToString(item.mrpMinorUnits),
          gstPercent: item.gstPercent,
          discountPercent: item.discountPercent.toFixed(2),
          discountAmount: moneyMinorUnitsToString(item.discountMinorUnits),
          lineSubtotal: moneyMinorUnitsToString(item.lineSubtotalMinorUnits),
          lineTaxAmount: moneyMinorUnitsToString(item.lineTaxMinorUnits),
          lineTotal: moneyMinorUnitsToString(item.lineTotalMinorUnits),
        })),
        tx,
      );
    });

    return this.getBillById(shopId, branchId, saleId);
  }

  async createCompletedBill(
    shopId: string,
    branchId: string,
    userId: string,
    input: SaveBillInput,
  ) {
    const settings = await this.adminSettingsService.getResolvedShopSettings(shopId);
    let customerId: string | null = null;

    const saleId = await db.transaction(async (tx) => {
      const preparedDraft = await this.prepareSaleDraft(
        shopId,
        branchId,
        input,
        settings,
        tx,
      );
      const billMeta = await this.buildBillMeta(shopId, branchId, tx);
      const created = await this.billingRepository.createSale(
        {
          shopId,
          branchId,
          billSequence: billMeta.sequence,
          billNumber: billMeta.billNumber,
          billNumberNormalized: normalizeSearchValue(billMeta.billNumber),
          customerId: preparedDraft.customerId,
          customerName: preparedDraft.customerName,
          customerPhone: preparedDraft.customerPhone,
          status: "held",
          paymentStatus: preparedDraft.totals.paymentStatus,
          paymentMethod: preparedDraft.paymentMethod,
          subtotal: moneyMinorUnitsToString(preparedDraft.totals.subtotalMinorUnits),
          discountAmount: moneyMinorUnitsToString(
            preparedDraft.totals.discountAmountMinorUnits,
          ),
          taxAmount: moneyMinorUnitsToString(preparedDraft.totals.taxAmountMinorUnits),
          roundOffAmount: moneyMinorUnitsToString(
            preparedDraft.totals.roundOffMinorUnits,
          ),
          grandTotal: moneyMinorUnitsToString(
            preparedDraft.totals.grandTotalMinorUnits,
          ),
          initialPaidAmount: moneyMinorUnitsToString(
            preparedDraft.totals.paidAmountMinorUnits,
          ),
          paidAmount: moneyMinorUnitsToString(
            preparedDraft.totals.settledPaidMinorUnits,
          ),
          dueAmount: moneyMinorUnitsToString(preparedDraft.totals.dueAmountMinorUnits),
          notes: preparedDraft.notes,
          createdByUserId: userId,
          updatedByUserId: userId,
        },
        preparedDraft.items.map((item) => ({
          medicineId: item.medicineId,
          batchId: item.batchId,
          quantity: item.quantity,
          rate: moneyMinorUnitsToString(item.rateMinorUnits),
          mrp: moneyMinorUnitsToString(item.mrpMinorUnits),
          gstPercent: item.gstPercent,
          discountPercent: item.discountPercent.toFixed(2),
          discountAmount: moneyMinorUnitsToString(item.discountMinorUnits),
          lineSubtotal: moneyMinorUnitsToString(item.lineSubtotalMinorUnits),
          lineTaxAmount: moneyMinorUnitsToString(item.lineTaxMinorUnits),
          lineTotal: moneyMinorUnitsToString(item.lineTotalMinorUnits),
        })),
        tx,
      );

      await this.inventoryStockService.depleteSaleStock(
        {
          shopId,
          branchId,
          saleId: created.sale.id,
          createdByUserId: userId,
          items: created.items.map((item) => ({
            id: item.id,
            medicineId: item.medicineId,
            batchId: item.batchId,
            quantity: item.quantity,
          })),
        },
        tx,
      );
      customerId = created.sale.customerId;

      await this.billingRepository.updateSale(
        created.sale.id,
        {
          status: "completed",
          completedAt: new Date(),
          updatedByUserId: userId,
        },
        tx,
      );

      if (created.sale.customerId) {
        await this.accountingLedgerService.applyAvailableCustomerAdvanceToSale(
          shopId,
          created.sale.id,
          tx,
        );

        await this.accountingLedgerService.syncCustomerSaleFinancials(
          shopId,
          created.sale.id,
          userId,
          tx,
        );
      }

      return created.sale.id;
    });

    try {
      await this.alertsService.dispatchPendingInventoryAlertEmails(shopId, branchId);
    } catch (error) {
      logger.error("Bill completed but inventory alert email dispatch failed", {
        saleId,
        shopId,
        branchId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    if (customerId) {
      try {
        await this.alertsService.syncCustomerDueNotification(shopId, customerId);
      } catch (error) {
        logger.error("Bill completed but customer due notification sync failed", {
          saleId,
          shopId,
          branchId,
          customerId,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    realtimeService.publish({
      type: "inventory_changed",
      shopId,
      branchId,
      reason: "sale_completed",
      metadata: {
        saleId,
      },
    });
    realtimeService.publish({
      type: "notification_changed",
      shopId,
      branchId,
      reason: "sale_completed",
      metadata: {
        saleId,
      },
    });

    return this.getBillById(shopId, branchId, saleId);
  }

  async completeHeldBill(
    shopId: string,
    branchId: string,
    saleId: string,
    userId: string,
  ) {
    const settings = await this.adminSettingsService.getResolvedShopSettings(shopId);
    let customerId: string | null = null;

    await db.transaction(async (tx) => {
      await this.inventoryRepository.syncBatchStatuses(shopId, branchId, tx);

      const sale = await this.billingRepository.findSaleById(
        shopId,
        branchId,
        saleId,
        tx,
      );

      if (!sale) {
        throw buildAppError(404, "BILL_NOT_FOUND", "Bill not found.");
      }

      if (sale.status !== "held") {
        throw buildAppError(
          400,
          "BILL_NOT_COMPLETABLE",
          "Only held bills can be completed.",
        );
      }

      const items = await this.billingRepository.listSaleItemsBySaleId(
        saleId,
        branchId,
        tx,
      );

      if (!items.length) {
        throw buildAppError(
          400,
          "BILL_HAS_NO_ITEMS",
          "Bill must contain at least one item before completion.",
        );
      }

      await this.inventoryStockService.depleteSaleStock(
        {
          shopId,
          branchId,
          saleId,
          createdByUserId: userId,
          items: items.map((item) => ({
            id: item.id,
            medicineId: item.medicineId,
            batchId: item.batchId,
            quantity: item.quantity,
          })),
        },
        tx,
      );
      customerId = sale.customerId;

      await this.billingRepository.updateSale(
        saleId,
        {
          status: "completed",
          completedAt: new Date(),
          updatedByUserId: userId,
        },
        tx,
      );

      if (!settings.allowPartialPayments) {
        const availableAdvanceMinorUnits = sale.customerId
          ? await this.accountingRepository
              .getCustomerFinancialSummary(shopId, sale.customerId, tx)
              .then((summary) =>
                toMoneyMinorUnits(summary?.summary.advanceAmount ?? 0),
              )
          : 0;
        const effectiveDueMinorUnits = Math.max(
          toMoneyMinorUnits(sale.dueAmount) - availableAdvanceMinorUnits,
          0,
        );

        if (effectiveDueMinorUnits > 0) {
          throw buildAppError(
            400,
            "PARTIAL_PAYMENTS_DISABLED",
            "Partial payments are disabled in admin settings.",
          );
        }
      }

      if (sale.customerId) {
        await this.accountingLedgerService.applyAvailableCustomerAdvanceToSale(
          shopId,
          saleId,
          tx,
        );

        await this.accountingLedgerService.syncCustomerSaleFinancials(
          shopId,
          saleId,
          userId,
          tx,
        );
      }
    });

    try {
      await this.alertsService.dispatchPendingInventoryAlertEmails(shopId, branchId);
    } catch (error) {
      logger.error("Held bill completion succeeded but inventory alert email dispatch failed", {
        saleId,
        shopId,
        branchId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    if (customerId) {
      try {
        await this.alertsService.syncCustomerDueNotification(shopId, customerId);
      } catch (error) {
        logger.error("Held bill completion succeeded but customer due notification sync failed", {
          saleId,
          shopId,
          branchId,
          customerId,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    realtimeService.publish({
      type: "inventory_changed",
      shopId,
      branchId,
      reason: "held_sale_completed",
      metadata: {
        saleId,
      },
    });
    realtimeService.publish({
      type: "notification_changed",
      shopId,
      branchId,
      reason: "held_sale_completed",
      metadata: {
        saleId,
      },
    });

    return this.getBillById(shopId, branchId, saleId);
  }

  async searchSellableMedicines(
    shopId: string,
    branchId: string,
    query: SearchSellableMedicinesQuery,
  ) {
    await this.inventoryRepository.syncBatchStatuses(shopId, branchId);

    const normalizedQuery = {
      ...query,
      search: query.search ? normalizeSearchValue(query.search) : undefined,
    };

    const [items, total] = await Promise.all([
      this.billingRepository.listSellableMedicines(shopId, branchId, normalizedQuery),
      this.billingRepository.countSellableMedicines(shopId, branchId, normalizedQuery),
    ]);

    return buildPaginatedResponse(
      items.map((record) => ({
        medicine: {
          id: record.medicine.id,
          medicineName: record.medicine.medicineName,
          genericName: record.medicine.genericName,
          brandName: record.medicine.brandName,
          barcode: record.medicine.barcode,
          form: record.medicine.form,
          unit: record.medicine.unit,
          prescriptionRequired: record.medicine.prescriptionRequired,
          gstPercent: record.medicine.gstPercent,
        },
        availableQuantity: Number(record.availableQuantity ?? 0),
        activeBatchCount: Number(record.activeBatchCount ?? 0),
        nextExpiryDate: record.nextExpiryDate,
      })),
      total,
      normalizedQuery.page,
      normalizedQuery.pageSize,
    );
  }

  async getSellableMedicineOptions(shopId: string, branchId: string, medicineId: string) {
    await this.inventoryRepository.syncBatchStatuses(shopId, branchId);
    const settings = await this.adminSettingsService.getResolvedShopSettings(shopId);

    const medicines = await this.billingRepository.findMedicinesByIds(shopId, [
      medicineId,
    ]);
    const medicine = medicines[0];

    if (!medicine || medicine.status !== "active") {
      throw buildAppError(404, "MEDICINE_NOT_FOUND", "Medicine not found.");
    }

    const batches = await this.billingRepository.listSellableBatchesByMedicineIds(
      shopId,
      branchId,
      [medicineId],
    );

    if (!batches.length) {
      throw buildAppError(
        404,
        "SELLABLE_BATCHES_NOT_FOUND",
        "No sellable batches found for the medicine.",
      );
    }

    return {
      medicine: {
        id: medicine.id,
        medicineName: medicine.medicineName,
        genericName: medicine.genericName,
        brandName: medicine.brandName,
        barcode: medicine.barcode,
        form: medicine.form,
        unit: medicine.unit,
        prescriptionRequired: medicine.prescriptionRequired,
      },
      availableQuantity: batches.reduce(
        (total, batch) => total + batch.quantityAvailable,
        0,
      ),
      defaultBatchId: settings.preferFefo ? (batches[0]?.id ?? null) : null,
      batches: batches.map((batch) => {
        const daysUntilExpiry = getDaysUntil(batch.expiryDate);

        return {
          id: batch.id,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          saleRate: batch.saleRate,
          mrp: batch.mrp,
          gstPercent: batch.gstPercent,
          quantityAvailable: batch.quantityAvailable,
          status: batch.status,
          daysUntilExpiry,
          isNearExpiry: daysUntilExpiry <= settings.nearExpiryAlertDays,
        };
      }),
    };
  }

  private async buildBillMeta(
    shopId: string,
    branchId: string,
    executor: DbExecutor,
  ) {
    await this.billingRepository.lockBillSequence(shopId, executor);
    const [shop, sequence] = await runDbReads(
      [
        () => this.billingRepository.getShopById(shopId, executor),
        () => this.billingRepository.getNextBillSequence(shopId, branchId, executor),
      ] as const,
      executor,
    );

    if (!shop) {
      throw buildAppError(404, "SHOP_NOT_FOUND", "Shop not found.");
    }

    return {
      sequence,
      billNumber: buildBillNumber(shop.invoicePrefix, sequence),
    };
  }

  private async prepareSaleDraft(
    shopId: string,
    branchId: string,
    input: SaveBillInput,
    settings: Awaited<ReturnType<AdminSettingsService["getResolvedShopSettings"]>>,
    executor?: DbExecutor,
  ): Promise<PreparedSaleDraft> {
    await this.inventoryRepository.syncBatchStatuses(shopId, branchId, executor);

    const medicineIds = [...new Set(input.items.map((item) => item.medicineId))];
    const batchIds = [
      ...new Set(
        input.items
          .map((item) => item.batchId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const [medicines, selectedBatches, sellableBatches] = await runDbReads(
      [
        () => this.billingRepository.findMedicinesByIds(shopId, medicineIds, executor),
        () => this.billingRepository.findBatchesByIds(shopId, branchId, batchIds, executor),
        () =>
          this.billingRepository.listSellableBatchesByMedicineIds(
            shopId,
            branchId,
            medicineIds,
            executor,
          ),
      ] as const,
      executor,
    );

    const medicineMap = new Map(medicines.map((medicine) => [medicine.id, medicine]));
    const selectedBatchMap = new Map(
      selectedBatches.map((batch) => [batch.id, batch]),
    );
    const sellableBatchMap = new Map<string, typeof sellableBatches>();

    for (const batch of sellableBatches) {
      const existing = sellableBatchMap.get(batch.medicineId) ?? [];
      existing.push(batch);
      sellableBatchMap.set(batch.medicineId, existing);
    }

    const remainingByBatchId = new Map(
      sellableBatches.map((batch) => [batch.id, batch.quantityAvailable]),
    );

    const preparedItems: PreparedSaleItem[] = [];

    for (const inputItem of input.items) {
      const medicine = medicineMap.get(inputItem.medicineId);

      if (!medicine) {
        throw buildAppError(404, "MEDICINE_NOT_FOUND", "Medicine not found.");
      }

      if (medicine.status !== "active") {
        throw buildAppError(
          400,
          "MEDICINE_INACTIVE",
          "Only active medicines can be billed.",
        );
      }

      if (inputItem.batchId) {
        const batch = selectedBatchMap.get(inputItem.batchId);

        if (!batch || batch.medicineId !== inputItem.medicineId) {
          throw buildAppError(404, "BATCH_NOT_FOUND", "Batch not found.");
        }

        const remainingQuantity = remainingByBatchId.get(batch.id) ?? 0;

        if (remainingQuantity < inputItem.quantity) {
          throw buildAppError(
            400,
            "INSUFFICIENT_BATCH_STOCK",
            `Insufficient stock for batch ${batch.batchNumber}.`,
          );
        }

        remainingByBatchId.set(batch.id, remainingQuantity - inputItem.quantity);
        preparedItems.push(
          this.buildPreparedItem(batch, inputItem.quantity, inputItem.discountPercent),
        );
        continue;
      }

      const candidateBatches = sellableBatchMap.get(inputItem.medicineId) ?? [];
      let remainingQuantity = inputItem.quantity;

      for (const batch of candidateBatches) {
        if (remainingQuantity <= 0) {
          break;
        }

        const availableForDraft = remainingByBatchId.get(batch.id) ?? 0;

        if (availableForDraft <= 0) {
          continue;
        }

        const allocatedQuantity = Math.min(remainingQuantity, availableForDraft);
        remainingByBatchId.set(batch.id, availableForDraft - allocatedQuantity);
        preparedItems.push(
          this.buildPreparedItem(
            batch,
            allocatedQuantity,
            inputItem.discountPercent,
          ),
        );
        remainingQuantity -= allocatedQuantity;
      }

      if (remainingQuantity > 0) {
        throw buildAppError(
          400,
          "INSUFFICIENT_STOCK",
          `Not enough valid stock is available for ${medicine.medicineName}.`,
        );
      }
    }

    const subtotalMinorUnits = sumMoneyMinorUnits(
      preparedItems.map((item) => item.lineSubtotalMinorUnits),
    );
    const discountAmountMinorUnits = sumMoneyMinorUnits(
      preparedItems.map((item) => item.discountMinorUnits),
    );
    const taxAmountMinorUnits = sumMoneyMinorUnits(
      preparedItems.map((item) => item.lineTaxMinorUnits),
    );
    const roundOffMinorUnits = Math.round(input.roundOffAmount * 100);
    const grandTotalMinorUnits =
      subtotalMinorUnits + taxAmountMinorUnits + roundOffMinorUnits;
    const paidAmountMinorUnits = toMoneyMinorUnits(input.paidAmount);

    if (grandTotalMinorUnits < 0) {
      throw buildAppError(400, "INVALID_BILL_TOTAL", "Grand total cannot be negative.");
    }

    const settlementState = buildSettlementState(
      grandTotalMinorUnits,
      paidAmountMinorUnits,
    );

    let customerDetails:
      | {
          customerId: string;
          customerName: string;
          customerPhone: string;
        }
      | undefined;
    let availableAdvanceMinorUnits = 0;

    if (input.customerId) {
      const customer = await this.customersRepository.findCustomerById(
        shopId,
        input.customerId,
        executor,
      );

      if (!customer) {
        throw buildAppError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
      }

      if (customer.status !== "active") {
        throw buildAppError(
          400,
          "CUSTOMER_INACTIVE",
          "Only active customers can be selected for billing.",
        );
      }

      customerDetails = {
        customerId: customer.id,
        customerName: customer.fullName,
        customerPhone: customer.mobileNumber,
      };

      if (settlementState.dueMinorUnits > 0) {
        const customerSummary = await this.accountingRepository.getCustomerFinancialSummary(
          shopId,
          customer.id,
          executor,
        );
        availableAdvanceMinorUnits = toMoneyMinorUnits(
          customerSummary?.summary.advanceAmount ?? 0,
        );
      }
    }

    const effectiveDueMinorUnits = Math.max(
      settlementState.dueMinorUnits - availableAdvanceMinorUnits,
      0,
    );

    if (!settings.allowPartialPayments && effectiveDueMinorUnits > 0) {
      throw buildAppError(
        400,
        "PARTIAL_PAYMENTS_DISABLED",
        "Partial payments are disabled in admin settings.",
      );
    }

    return {
      items: preparedItems,
      totals: {
        subtotalMinorUnits,
        discountAmountMinorUnits,
        taxAmountMinorUnits,
        roundOffMinorUnits,
        grandTotalMinorUnits,
        paidAmountMinorUnits,
        settledPaidMinorUnits: settlementState.settledMinorUnits,
        dueAmountMinorUnits: settlementState.dueMinorUnits,
        paymentStatus: settlementState.paymentStatus,
      },
      paymentMethod: input.paymentMethod,
      ...(customerDetails ?? {}),
      ...(customerDetails
        ? {}
        : input.customerName
          ? { customerName: input.customerName }
          : {}),
      ...(customerDetails
        ? {}
        : input.customerPhone
          ? { customerPhone: input.customerPhone }
          : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    };
  }

  private buildPreparedItem(
    batch: {
      id: string;
      medicineId: string;
      saleRate: string;
      mrp: string;
      gstPercent: number;
    },
    quantity: number,
    discountPercent: number,
  ): PreparedSaleItem {
    const rateMinorUnits = toMoneyMinorUnits(batch.saleRate);
    const mrpMinorUnits = toMoneyMinorUnits(batch.mrp);
    const grossMinorUnits = rateMinorUnits * quantity;
    const discountMinorUnits = roundPercentageAmount(
      grossMinorUnits,
      discountPercent,
    );
    const lineSubtotalMinorUnits = grossMinorUnits - discountMinorUnits;
    const lineTaxMinorUnits = roundPercentageAmount(
      lineSubtotalMinorUnits,
      batch.gstPercent,
    );
    const lineTotalMinorUnits = lineSubtotalMinorUnits + lineTaxMinorUnits;

    return {
      medicineId: batch.medicineId,
      batchId: batch.id,
      quantity,
      rateMinorUnits,
      mrpMinorUnits,
      gstPercent: batch.gstPercent,
      discountPercent,
      discountMinorUnits,
      lineSubtotalMinorUnits,
      lineTaxMinorUnits,
      lineTotalMinorUnits,
    };
  }
}
