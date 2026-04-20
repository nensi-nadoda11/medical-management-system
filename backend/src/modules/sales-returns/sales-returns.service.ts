import { db } from "../../db/client";
import { AppError } from "../../shared/errors/app-error";
import { logger } from "../../shared/logger";
import {
  moneyMinorUnitsToString,
  roundPercentageAmount,
  sumMoneyMinorUnits,
  toMoneyMinorUnits,
} from "../../shared/utils/money";
import { collapseWhitespace } from "../../shared/utils/strings";
import { AlertsService } from "../alerts/alerts.service";
import { AccountingLedgerService } from "../accounting/accounting-ledger.service";
import { AdminSettingsService } from "../admin-settings/admin-settings.service";
import { InventoryRepository } from "../inventory/inventory.repository";
import { InventoryStockService } from "../inventory/inventory.stock.service";
import { SalesReturnsRepository } from "./sales-returns.repository";
import type {
  CreateSalesReturnInput,
  ListSalesReturnsQuery,
  SalesReturnItemInput,
  UpdateSalesReturnInput,
} from "./sales-returns.validation";
import type { DbExecutor } from "../../shared/db/executor";

const buildAppError = (statusCode: number, code: string, message: string) =>
  new AppError({
    statusCode,
    code,
    message,
  });

const normalizeSearchValue = (value: string) =>
  collapseWhitespace(value).toLowerCase();

const sanitizeInvoicePrefix = (value?: string | null) => {
  const normalized = (value ?? "RET")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 12);

  return normalized || "RET";
};

const buildReturnNumber = (invoicePrefix: string, sequence: number) =>
  `${sanitizeInvoicePrefix(invoicePrefix)}-RET-${sequence.toString().padStart(6, "0")}`;

const getCustomerLabel = (customerName?: string | null) =>
  customerName?.trim().length ? customerName : "Walk-in";

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

type RefundMethod = "cash" | "upi" | "card" | "bank_transfer" | "adjustment";
type RefundStatus = "pending" | "processed" | "not_required";

type PreparedReturnItem = {
  saleItemId: string;
  medicineId: string;
  batchId: string;
  quantity: number;
  rateMinorUnits: number;
  taxPercent: number;
  discountMinorUnits: number;
  lineReturnAmountMinorUnits: number;
  reason: string;
  notes?: string;
};

type PreparedReturnDraft = {
  saleId: string;
  notes?: string;
  refundMethod?: RefundMethod;
  refundStatus: RefundStatus;
  refundAmountMinorUnits: number;
  totalReturnAmountMinorUnits: number;
  items: PreparedReturnItem[];
};

export class SalesReturnsService {
  constructor(
    private readonly salesReturnsRepository = new SalesReturnsRepository(),
    private readonly inventoryRepository = new InventoryRepository(),
    private readonly inventoryStockService = new InventoryStockService(),
    private readonly alertsService = new AlertsService(),
    private readonly accountingLedgerService = new AccountingLedgerService(),
    private readonly adminSettingsService = new AdminSettingsService(),
  ) {}

  async listSalesReturns(shopId: string, query: ListSalesReturnsQuery) {
    const normalizedQuery = {
      ...query,
      search: query.search ? normalizeSearchValue(query.search) : undefined,
    };

    const [items, total] = await Promise.all([
      this.salesReturnsRepository.listSalesReturns(shopId, normalizedQuery),
      this.salesReturnsRepository.countSalesReturns(shopId, normalizedQuery),
    ]);

    return buildPaginatedResponse(
      items.map((record) => ({
        id: record.saleReturn.id,
        saleId: record.saleReturn.saleId,
        returnNumber: record.saleReturn.returnNumber,
        billNumber: record.sale.billNumber,
        customerId: record.sale.customerId,
        customerName: record.sale.customerName,
        customerPhone: record.sale.customerPhone,
        customerLabel: getCustomerLabel(record.sale.customerName),
        status: record.saleReturn.status,
        refundStatus: record.saleReturn.refundStatus,
        refundMethod: record.saleReturn.refundMethod,
        totalReturnAmount: record.saleReturn.totalReturnAmount,
        refundAmount: record.saleReturn.refundAmount,
        notes: record.saleReturn.notes,
        createdAt: record.saleReturn.createdAt,
        updatedAt: record.saleReturn.updatedAt,
        completedAt: record.saleReturn.completedAt,
        cancelledAt: record.saleReturn.cancelledAt,
        createdBy: record.createdBy,
      })),
      total,
      normalizedQuery.page,
      normalizedQuery.pageSize,
    );
  }

  async getSalesReturnById(shopId: string, returnId: string) {
    const record = await this.salesReturnsRepository.findSalesReturnDetailById(
      shopId,
      returnId,
    );

    if (!record) {
      throw buildAppError(404, "SALES_RETURN_NOT_FOUND", "Sales return not found.");
    }

    return {
      id: record.saleReturn.id,
      shopId: record.saleReturn.shopId,
      saleId: record.saleReturn.saleId,
      returnNumber: record.saleReturn.returnNumber,
      status: record.saleReturn.status,
      totalReturnAmount: record.saleReturn.totalReturnAmount,
      refundAmount: record.saleReturn.refundAmount,
      refundMethod: record.saleReturn.refundMethod,
      refundStatus: record.saleReturn.refundStatus,
      notes: record.saleReturn.notes,
      createdByUserId: record.saleReturn.createdByUserId,
      completedByUserId: record.saleReturn.completedByUserId,
      completedAt: record.saleReturn.completedAt,
      cancelledAt: record.saleReturn.cancelledAt,
      createdAt: record.saleReturn.createdAt,
      updatedAt: record.saleReturn.updatedAt,
      createdBy: record.createdBy,
      completedBy: record.completedBy,
      sale: {
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
        paidAmount: record.sale.paidAmount,
        dueAmount: record.sale.dueAmount,
        completedAt: record.sale.completedAt,
      },
      items: record.items.map(({ item, saleItem, medicine, batch }) => ({
        id: item.id,
        saleItemId: item.saleItemId,
        medicine: {
          id: medicine.id,
          medicineName: medicine.medicineName,
          genericName: medicine.genericName,
          form: medicine.form,
          unit: medicine.unit,
        },
        batch: {
          id: batch.id,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          status: batch.status,
          quantityAvailable: batch.quantityAvailable,
        },
        soldQuantity: saleItem.quantity,
        quantity: item.quantity,
        rate: item.rate,
        taxPercent: item.taxPercent,
        discountAmount: item.discountAmount,
        lineReturnAmount: item.lineReturnAmount,
        reason: item.reason,
        notes: item.notes,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };
  }

  async getReturnableSaleDetail(shopId: string, saleId: string) {
    await this.inventoryRepository.syncBatchStatuses(shopId);

    const record = await this.salesReturnsRepository.findSaleWithCreatorById(
      shopId,
      saleId,
    );

    if (!record) {
      throw buildAppError(404, "BILL_NOT_FOUND", "Bill not found.");
    }

    if (record.sale.status !== "completed") {
      throw buildAppError(
        400,
        "SALE_NOT_RETURNABLE",
        "Returns can only be created against completed bills.",
      );
    }

    const saleItems = await this.salesReturnsRepository.listSaleItemsWithRelationsBySaleId(
      shopId,
      saleId,
    );
    const returnedQuantities =
      await this.salesReturnsRepository.getCompletedReturnedQuantitiesBySaleItemIds(
        shopId,
        saleItems.map(({ item }) => item.id),
      );
    const returnedQuantityMap = new Map(
      returnedQuantities.map((entry) => [entry.saleItemId, Number(entry.quantity)]),
    );

    return {
      sale: {
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
        grandTotal: record.sale.grandTotal,
        paidAmount: record.sale.paidAmount,
        dueAmount: record.sale.dueAmount,
        notes: record.sale.notes,
        completedAt: record.sale.completedAt,
        createdBy: record.createdBy,
      },
      items: saleItems.map(({ item, medicine, batch }) => {
        const alreadyReturnedQuantity = returnedQuantityMap.get(item.id) ?? 0;
        const remainingReturnableQuantity = Math.max(
          item.quantity - alreadyReturnedQuantity,
          0,
        );

        return {
          saleItemId: item.id,
          medicine: {
            id: medicine.id,
            medicineName: medicine.medicineName,
            genericName: medicine.genericName,
            form: medicine.form,
            unit: medicine.unit,
          },
          batch: {
            id: batch.id,
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate,
            status: batch.status,
            quantityAvailable: batch.quantityAvailable,
          },
          quantitySold: item.quantity,
          alreadyReturnedQuantity,
          remainingReturnableQuantity,
          rate: item.rate,
          taxPercent: item.gstPercent,
          discountPercent: item.discountPercent,
          lineTotal: item.lineTotal,
        };
      }),
    };
  }

  async createDraftSalesReturn(
    shopId: string,
    userId: string,
    userRole: "admin" | "staff" | "accountant",
    input: CreateSalesReturnInput,
  ) {
    await this.assertSalesReturnAllowed(shopId, userRole);

    const returnId = await db.transaction(async (tx) => {
      const preparedDraft = await this.prepareReturnDraft(
        shopId,
        {
          saleId: input.saleId,
          refundAmount: input.refundAmount,
          refundStatus: input.refundStatus,
          ...(input.refundMethod ? { refundMethod: input.refundMethod } : {}),
          ...(input.notes ? { notes: input.notes } : {}),
          items: input.items,
        },
        tx,
      );
      const returnMeta = await this.buildReturnMeta(shopId, tx);
      const created = await this.salesReturnsRepository.createSalesReturn(
        {
          shopId,
          saleId: preparedDraft.saleId,
          returnSequence: returnMeta.sequence,
          returnNumber: returnMeta.returnNumber,
          returnNumberNormalized: normalizeSearchValue(returnMeta.returnNumber),
          status: "draft",
          totalReturnAmount: moneyMinorUnitsToString(
            preparedDraft.totalReturnAmountMinorUnits,
          ),
          refundAmount: moneyMinorUnitsToString(preparedDraft.refundAmountMinorUnits),
          refundMethod: preparedDraft.refundMethod,
          refundStatus: preparedDraft.refundStatus,
          notes: preparedDraft.notes,
          createdByUserId: userId,
        },
        preparedDraft.items.map((item) => ({
          saleItemId: item.saleItemId,
          medicineId: item.medicineId,
          batchId: item.batchId,
          quantity: item.quantity,
          rate: moneyMinorUnitsToString(item.rateMinorUnits),
          taxPercent: item.taxPercent,
          discountAmount: moneyMinorUnitsToString(item.discountMinorUnits),
          lineReturnAmount: moneyMinorUnitsToString(item.lineReturnAmountMinorUnits),
          reason: item.reason,
          notes: item.notes,
        })),
        tx,
      );

      return created.saleReturn.id;
    });

    return this.getSalesReturnById(shopId, returnId);
  }

  async updateDraftSalesReturn(
    shopId: string,
    returnId: string,
    userRole: "admin" | "staff" | "accountant",
    input: UpdateSalesReturnInput,
  ) {
    await this.assertSalesReturnAllowed(shopId, userRole);

    const existing = await this.salesReturnsRepository.findSalesReturnById(
      shopId,
      returnId,
    );

    if (!existing) {
      throw buildAppError(404, "SALES_RETURN_NOT_FOUND", "Sales return not found.");
    }

    if (existing.status !== "draft") {
      throw buildAppError(
        400,
        "SALES_RETURN_NOT_EDITABLE",
        "Only draft sales returns can be edited.",
      );
    }

    await db.transaction(async (tx) => {
      const preparedDraft = await this.prepareReturnDraft(
        shopId,
        {
          saleId: existing.saleId,
          refundAmount: input.refundAmount,
          refundStatus: input.refundStatus,
          ...(input.refundMethod ? { refundMethod: input.refundMethod } : {}),
          ...(input.notes ? { notes: input.notes } : {}),
          items: input.items,
        },
        tx,
      );

      await this.salesReturnsRepository.updateSalesReturn(
        returnId,
        {
          totalReturnAmount: moneyMinorUnitsToString(
            preparedDraft.totalReturnAmountMinorUnits,
          ),
          refundAmount: moneyMinorUnitsToString(preparedDraft.refundAmountMinorUnits),
          refundMethod: preparedDraft.refundMethod,
          refundStatus: preparedDraft.refundStatus,
          notes: preparedDraft.notes,
        },
        tx,
      );

      await this.salesReturnsRepository.replaceSalesReturnItems(
        returnId,
        shopId,
        preparedDraft.items.map((item) => ({
          saleItemId: item.saleItemId,
          medicineId: item.medicineId,
          batchId: item.batchId,
          quantity: item.quantity,
          rate: moneyMinorUnitsToString(item.rateMinorUnits),
          taxPercent: item.taxPercent,
          discountAmount: moneyMinorUnitsToString(item.discountMinorUnits),
          lineReturnAmount: moneyMinorUnitsToString(item.lineReturnAmountMinorUnits),
          reason: item.reason,
          notes: item.notes,
        })),
        tx,
      );

    });

    return this.getSalesReturnById(shopId, returnId);
  }

  async completeSalesReturn(
    shopId: string,
    returnId: string,
    userId: string,
    userRole: "admin" | "staff" | "accountant",
  ) {
    await this.assertSalesReturnAllowed(shopId, userRole);
    let customerId: string | null = null;

    await db.transaction(async (tx) => {
      await this.inventoryRepository.syncBatchStatuses(shopId, tx);

      const existing = await this.salesReturnsRepository.findSalesReturnById(
        shopId,
        returnId,
        tx,
      );

      if (!existing) {
        throw buildAppError(404, "SALES_RETURN_NOT_FOUND", "Sales return not found.");
      }

      if (existing.status !== "draft") {
        throw buildAppError(
          400,
          "SALES_RETURN_NOT_COMPLETABLE",
          "Only draft sales returns can be completed.",
        );
      }

      const draftItems = await this.salesReturnsRepository.listSalesReturnItemsByReturnId(
        returnId,
        tx,
      );

      if (!draftItems.length) {
        throw buildAppError(
          400,
          "SALES_RETURN_EMPTY",
          "Sales return must contain at least one item.",
        );
      }

      const sale = await this.salesReturnsRepository.findSaleById(
        shopId,
        existing.saleId,
        tx,
      );

      if (!sale) {
        throw buildAppError(404, "BILL_NOT_FOUND", "Bill not found.");
      }

      customerId = sale.customerId;

      const preparedDraft = await this.prepareReturnDraft(
        shopId,
        {
          saleId: existing.saleId,
          refundAmount: Number(existing.refundAmount),
          refundStatus: existing.refundStatus,
          ...(existing.refundMethod ? { refundMethod: existing.refundMethod } : {}),
          ...(existing.notes ? { notes: existing.notes } : {}),
          items: draftItems.map((item) => ({
            saleItemId: item.saleItemId,
            quantity: item.quantity,
            reason: item.reason,
            notes: item.notes ?? undefined,
          })),
        },
        tx,
      );

      const refreshedItems = await this.salesReturnsRepository.replaceSalesReturnItems(
        returnId,
        shopId,
        preparedDraft.items.map((item) => ({
          saleItemId: item.saleItemId,
          medicineId: item.medicineId,
          batchId: item.batchId,
          quantity: item.quantity,
          rate: moneyMinorUnitsToString(item.rateMinorUnits),
          taxPercent: item.taxPercent,
          discountAmount: moneyMinorUnitsToString(item.discountMinorUnits),
          lineReturnAmount: moneyMinorUnitsToString(item.lineReturnAmountMinorUnits),
          reason: item.reason,
          notes: item.notes,
        })),
        tx,
      );

      await this.inventoryStockService.restoreSaleReturnStock(
        {
          shopId,
          saleReturnId: returnId,
          createdByUserId: userId,
          items: refreshedItems.map((item) => ({
            id: item.id,
            medicineId: item.medicineId,
            batchId: item.batchId,
            quantity: item.quantity,
          })),
        },
        tx,
      );

      await this.salesReturnsRepository.updateSalesReturn(
        returnId,
        {
          status: "completed",
          totalReturnAmount: moneyMinorUnitsToString(
            preparedDraft.totalReturnAmountMinorUnits,
          ),
          refundAmount: moneyMinorUnitsToString(preparedDraft.refundAmountMinorUnits),
          refundMethod: preparedDraft.refundMethod,
          refundStatus: preparedDraft.refundStatus,
          notes: preparedDraft.notes,
          completedByUserId: userId,
          completedAt: new Date(),
        },
        tx,
      );

      if (sale.customerId) {
        await this.accountingLedgerService.syncCustomerSaleFinancials(
          shopId,
          existing.saleId,
          userId,
          tx,
        );
      }
    });

    try {
      await this.alertsService.dispatchPendingInventoryAlertEmails(shopId);
    } catch (error) {
      logger.error("Sales return completed but inventory alert email dispatch failed", {
        returnId,
        shopId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    if (customerId) {
      try {
        await this.alertsService.syncCustomerDueNotification(shopId, customerId);
      } catch (error) {
        logger.error("Sales return completed but customer due notification sync failed", {
          returnId,
          shopId,
          customerId,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return this.getSalesReturnById(shopId, returnId);
  }

  async cancelDraftSalesReturn(
    shopId: string,
    returnId: string,
    userRole: "admin" | "staff" | "accountant",
  ) {
    await this.assertSalesReturnAllowed(shopId, userRole);

    const existing = await this.salesReturnsRepository.findSalesReturnById(
      shopId,
      returnId,
    );

    if (!existing) {
      throw buildAppError(404, "SALES_RETURN_NOT_FOUND", "Sales return not found.");
    }

    if (existing.status !== "draft") {
      throw buildAppError(
        400,
        "SALES_RETURN_NOT_CANCELLABLE",
        "Only draft sales returns can be cancelled.",
      );
    }

    await db.transaction(async (tx) => {
      await this.salesReturnsRepository.updateSalesReturn(
        returnId,
        {
          status: "cancelled",
          cancelledAt: new Date(),
        },
        tx,
      );
    });

    return this.getSalesReturnById(shopId, returnId);
  }

  private async buildReturnMeta(shopId: string, executor: DbExecutor) {
    await this.salesReturnsRepository.lockReturnSequence(shopId, executor);
    const [shop, sequence] = await Promise.all([
      this.salesReturnsRepository.getShopById(shopId, executor),
      this.salesReturnsRepository.getNextReturnSequence(shopId, executor),
    ]);

    if (!shop) {
      throw buildAppError(404, "SHOP_NOT_FOUND", "Shop not found.");
    }

    return {
      sequence,
      returnNumber: buildReturnNumber(shop.invoicePrefix, sequence),
    };
  }

  private async prepareReturnDraft(
    shopId: string,
    input: {
      saleId: string;
      refundAmount: number;
      refundMethod?: RefundMethod;
      refundStatus: RefundStatus;
      notes?: string;
      items: SalesReturnItemInput[];
    },
    executor?: DbExecutor,
  ): Promise<PreparedReturnDraft> {
    const sale = await this.salesReturnsRepository.findSaleById(
      shopId,
      input.saleId,
      executor,
    );

    if (!sale) {
      throw buildAppError(404, "BILL_NOT_FOUND", "Bill not found.");
    }

    if (sale.status !== "completed") {
      throw buildAppError(
        400,
        "SALE_NOT_RETURNABLE",
        "Returns can only be created against completed bills.",
      );
    }

    const saleItemRecords =
      await this.salesReturnsRepository.listSaleItemsWithRelationsBySaleId(
        shopId,
        input.saleId,
        executor,
      );

    if (!saleItemRecords.length) {
      throw buildAppError(
        400,
        "SALE_HAS_NO_ITEMS",
        "The selected bill does not contain any returnable items.",
      );
    }

    const saleItemMap = new Map(saleItemRecords.map((record) => [record.item.id, record]));
    const returnedQuantities =
      await this.salesReturnsRepository.getCompletedReturnedQuantitiesBySaleItemIds(
        shopId,
        saleItemRecords.map(({ item }) => item.id),
        executor,
      );
    const returnedQuantityMap = new Map(
      returnedQuantities.map((entry) => [entry.saleItemId, Number(entry.quantity)]),
    );
    const preparedItems: PreparedReturnItem[] = [];
    const seenSaleItemIds = new Set<string>();

    for (const inputItem of input.items) {
      if (seenSaleItemIds.has(inputItem.saleItemId)) {
        throw buildAppError(
          400,
          "DUPLICATE_SALE_RETURN_ITEM",
          "Each bill item can only be included once in a return.",
        );
      }

      seenSaleItemIds.add(inputItem.saleItemId);
      const record = saleItemMap.get(inputItem.saleItemId);

      if (!record) {
        throw buildAppError(
          400,
          "INVALID_SALE_RETURN_ITEM",
          "One or more selected items do not belong to the bill.",
        );
      }

      const alreadyReturnedQuantity = returnedQuantityMap.get(inputItem.saleItemId) ?? 0;
      const remainingReturnableQuantity =
        record.item.quantity - alreadyReturnedQuantity;

      if (remainingReturnableQuantity <= 0) {
        throw buildAppError(
          400,
          "ITEM_NOT_RETURNABLE",
          `${record.medicine.medicineName} has no returnable quantity left.`,
        );
      }

      if (inputItem.quantity > remainingReturnableQuantity) {
        throw buildAppError(
          400,
          "RETURN_QUANTITY_EXCEEDED",
          `${record.medicine.medicineName} can only return ${remainingReturnableQuantity} more.`,
        );
      }

      const rateMinorUnits = toMoneyMinorUnits(record.item.rate);
      const grossMinorUnits = rateMinorUnits * inputItem.quantity;
      const discountMinorUnits = roundPercentageAmount(
        grossMinorUnits,
        Number(record.item.discountPercent),
      );
      const lineSubtotalMinorUnits = grossMinorUnits - discountMinorUnits;
      const lineTaxMinorUnits = roundPercentageAmount(
        lineSubtotalMinorUnits,
        record.item.gstPercent,
      );
      const lineReturnAmountMinorUnits =
        lineSubtotalMinorUnits + lineTaxMinorUnits;

      preparedItems.push({
        saleItemId: inputItem.saleItemId,
        medicineId: record.item.medicineId,
        batchId: record.item.batchId,
        quantity: inputItem.quantity,
        rateMinorUnits,
        taxPercent: record.item.gstPercent,
        discountMinorUnits,
        lineReturnAmountMinorUnits,
        reason: inputItem.reason,
        ...(inputItem.notes ? { notes: inputItem.notes } : {}),
      });
    }

    if (!preparedItems.length) {
      throw buildAppError(
        400,
        "SALES_RETURN_EMPTY",
        "Sales return must contain at least one item.",
      );
    }

    const totalReturnAmountMinorUnits = sumMoneyMinorUnits(
      preparedItems.map((item) => item.lineReturnAmountMinorUnits),
    );
    const refundAmountMinorUnits = toMoneyMinorUnits(input.refundAmount);
    const refundConfig = this.normalizeRefund({
      refundAmountMinorUnits,
      totalReturnAmountMinorUnits,
      refundStatus: input.refundStatus,
      ...(input.refundMethod ? { refundMethod: input.refundMethod } : {}),
    });

    return {
      saleId: input.saleId,
      ...(input.notes ? { notes: input.notes } : {}),
      ...refundConfig,
      totalReturnAmountMinorUnits,
      items: preparedItems,
    };
  }

  private normalizeRefund(input: {
    refundAmountMinorUnits: number;
    totalReturnAmountMinorUnits: number;
    refundMethod?: RefundMethod;
    refundStatus: RefundStatus;
  }) {
    if (input.refundAmountMinorUnits > input.totalReturnAmountMinorUnits) {
      throw buildAppError(
        400,
        "REFUND_AMOUNT_INVALID",
        "Refund amount cannot exceed the total return amount.",
      );
    }

    if (input.refundAmountMinorUnits === 0) {
      if (input.refundStatus !== "not_required") {
        throw buildAppError(
          400,
          "REFUND_STATUS_INVALID",
          "Refund status must be not required when refund amount is zero.",
        );
      }

      if (input.refundMethod) {
        throw buildAppError(
          400,
          "REFUND_METHOD_INVALID",
          "Refund method is only allowed when a refund amount is recorded.",
        );
      }

      return {
        refundAmountMinorUnits: 0,
        refundStatus: "not_required" as const,
      };
    }

    if (!input.refundMethod) {
      throw buildAppError(
        400,
        "REFUND_METHOD_REQUIRED",
        "Refund method is required when refund amount is greater than zero.",
      );
    }

    if (input.refundStatus === "not_required") {
      throw buildAppError(
        400,
        "REFUND_STATUS_INVALID",
        "Refund status cannot be not required when refund amount is greater than zero.",
      );
    }

    return {
      refundAmountMinorUnits: input.refundAmountMinorUnits,
      refundMethod: input.refundMethod,
      refundStatus: input.refundStatus,
    };
  }

  private async assertSalesReturnAllowed(
    shopId: string,
    userRole: "admin" | "staff" | "accountant",
  ) {
    if (userRole !== "staff") {
      return;
    }

    const settings = await this.adminSettingsService.getResolvedShopSettings(shopId);

    if (!settings.allowStaffSalesReturn) {
      throw buildAppError(
        400,
        "STAFF_SALES_RETURN_DISABLED",
        "Staff sales returns are disabled in admin settings.",
      );
    }
  }
}
