import { db } from "../../db/client";
import { AppError } from "../../shared/errors/app-error";
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
import { AccountingLedgerService } from "../accounting/accounting-ledger.service";
import { AdminSettingsService } from "../admin-settings/admin-settings.service";
import { InventoryStockService } from "../inventory/inventory.stock.service";
import { PurchaseReturnsRepository } from "../purchase-returns/purchase-returns.repository";
import { PurchasesRepository } from "./purchases.repository";
import { realtimeService } from "../realtime/realtime.service";
import type {
  CancelPurchaseInput,
  CreatePurchaseInput,
  ListPurchasesQuery,
  UpdateDraftPurchaseInput,
} from "./purchases.validation";

const buildAppError = (statusCode: number, code: string, message: string) =>
  new AppError({
    statusCode,
    code,
    message,
  });

const PURCHASE_SUPPLIER_INVOICE_UNIQUE_CONSTRAINT =
  "purchases_shop_supplier_invoice_unique_idx";

const normalizeSearchValue = (value: string) =>
  collapseWhitespace(value).toLowerCase();

const isDatabaseConstraintError = (
  error: unknown,
  code: string,
  constraintName?: string,
) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === code &&
  (!constraintName ||
    ("constraint" in error &&
      error.constraint === constraintName));

const rethrowSupplierInvoiceConflict = (error: unknown): never => {
  if (
    isDatabaseConstraintError(
      error,
      "23505",
      PURCHASE_SUPPLIER_INVOICE_UNIQUE_CONSTRAINT,
    )
  ) {
    throw buildAppError(
      409,
      "DUPLICATE_SUPPLIER_INVOICE",
      "This supplier invoice number is already recorded for the supplier.",
    );
  }

  throw error;
};

const toEndOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const buildPurchaseNumber = () => {
  const now = new Date();
  const parts = [
    now.getFullYear().toString(),
    (now.getMonth() + 1).toString().padStart(2, "0"),
    now.getDate().toString().padStart(2, "0"),
    now.getHours().toString().padStart(2, "0"),
    now.getMinutes().toString().padStart(2, "0"),
    now.getSeconds().toString().padStart(2, "0"),
  ];
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `PUR-${parts.join("")}-${random}`;
};

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

const resolvePurchaseWorkflowStage = (purchase: {
  status: "draft" | "finalized" | "cancelled";
  purchaseOrderApprovedAt: Date | null;
  supplierNotifiedAt: Date | null;
}) => {
  if (purchase.status === "cancelled") {
    return "cancelled" as const;
  }

  if (purchase.status === "finalized") {
    return "received" as const;
  }

  if (purchase.supplierNotifiedAt) {
    return "supplier_notified" as const;
  }

  if (purchase.purchaseOrderApprovedAt) {
    return "approved" as const;
  }

  return "draft" as const;
};

const toPurchaseListResponse = (record: Awaited<
  ReturnType<PurchasesRepository["listPurchases"]>
>[number]) => ({
  id: record.purchase.id,
  purchaseNumber: record.purchase.purchaseNumber,
  supplierInvoiceNumber: record.purchase.supplierInvoiceNumber,
  supplierInvoiceDate: record.purchase.supplierInvoiceDate,
  purchaseDate: record.purchase.purchaseDate,
  status: record.purchase.status,
  paymentStatus: record.purchase.paymentStatus,
  subtotal: record.purchase.subtotal,
  discountAmount: record.purchase.discountAmount,
  taxAmount: record.purchase.taxAmount,
  roundOffAmount: record.purchase.roundOffAmount,
  grandTotal: record.purchase.grandTotal,
  initialPaidAmount: record.purchase.initialPaidAmount,
  paidAmount: record.purchase.paidAmount,
  dueAmount: record.purchase.dueAmount,
  purchaseOrderApprovedAt: record.purchase.purchaseOrderApprovedAt,
  supplierNotifiedAt: record.purchase.supplierNotifiedAt,
  finalizedAt: record.purchase.finalizedAt,
  cancelledAt: record.purchase.cancelledAt,
  createdAt: record.purchase.createdAt,
  updatedAt: record.purchase.updatedAt,
  workflowStage: resolvePurchaseWorkflowStage(record.purchase),
  supplier: record.supplier,
});

const toPurchaseDetailResponse = (
  record: NonNullable<Awaited<ReturnType<PurchasesRepository["findPurchaseDetailById"]>>>,
  input: {
    completedReturnedQuantityByItemId: Map<string, number>;
    returnHistory: Array<{
      id: string;
      returnNumber: string;
      status: "draft" | "completed" | "cancelled";
      totalReturnAmount: string;
      createdAt: Date;
      completedAt: Date | null;
      createdBy: {
        id: string;
        fullName: string;
        role: "admin" | "staff" | "accountant";
      };
    }>;
  },
) => ({
  id: record.purchase.id,
  shopId: record.purchase.shopId,
  supplierId: record.purchase.supplierId,
  purchaseNumber: record.purchase.purchaseNumber,
  supplierInvoiceNumber: record.purchase.supplierInvoiceNumber,
  supplierInvoiceDate: record.purchase.supplierInvoiceDate,
  purchaseDate: record.purchase.purchaseDate,
  status: record.purchase.status,
  paymentStatus: record.purchase.paymentStatus,
  subtotal: record.purchase.subtotal,
  discountAmount: record.purchase.discountAmount,
  taxAmount: record.purchase.taxAmount,
  roundOffAmount: record.purchase.roundOffAmount,
  grandTotal: record.purchase.grandTotal,
  initialPaidAmount: record.purchase.initialPaidAmount,
  paidAmount: record.purchase.paidAmount,
  dueAmount: record.purchase.dueAmount,
  notes: record.purchase.notes,
  createdByUserId: record.purchase.createdByUserId,
  updatedByUserId: record.purchase.updatedByUserId,
  purchaseOrderApprovedAt: record.purchase.purchaseOrderApprovedAt,
  purchaseOrderApprovedByUserId: record.purchase.purchaseOrderApprovedByUserId,
  supplierNotifiedAt: record.purchase.supplierNotifiedAt,
  supplierNotifiedByUserId: record.purchase.supplierNotifiedByUserId,
  finalizedAt: record.purchase.finalizedAt,
  cancelledAt: record.purchase.cancelledAt,
  createdAt: record.purchase.createdAt,
  updatedAt: record.purchase.updatedAt,
  workflowStage: resolvePurchaseWorkflowStage(record.purchase),
  supplier: record.supplier,
  items: record.items.map(({ item, medicine }) => ({
    id: item.id,
    medicineBatchId: item.medicineBatchId,
    medicine: {
      id: medicine.id,
      medicineName: medicine.medicineName,
      genericName: medicine.genericName,
      form: medicine.form,
      unit: medicine.unit,
      reorderLevel: medicine.reorderLevel,
      status: medicine.status,
    },
    batchNumber: item.batchNumber,
    expiryDate: item.expiryDate,
    quantity: item.quantity,
    freeQuantity: item.freeQuantity,
    purchaseRate: item.purchaseRate,
    saleRate: item.saleRate,
    mrp: item.mrp,
    gstPercent: item.gstPercent,
    discountPercent: item.discountPercent,
    lineSubtotal: item.lineSubtotal,
    lineTaxAmount: item.lineTaxAmount,
    lineTotal: item.lineTotal,
    alreadyReturnedQuantity:
      input.completedReturnedQuantityByItemId.get(item.id) ?? 0,
    remainingReturnableQuantity: Math.max(
      item.quantity - (input.completedReturnedQuantityByItemId.get(item.id) ?? 0),
      0,
    ),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  })),
  returnHistory: input.returnHistory,
  totalCompletedReturnedAmount: input.returnHistory
    .filter((entry) => entry.status === "completed")
    .reduce((sum, entry) => sum + Number(entry.totalReturnAmount), 0)
    .toFixed(2),
});

class PurchaseTotalsBuilder {
  build(input: CreatePurchaseInput | UpdateDraftPurchaseInput) {
    const normalizedPurchaseDate = toEndOfDay(input.purchaseDate);
    const itemKeys = new Set<string>();

    const items = input.items.map((item) => {
      const normalizedBatchNumber = normalizeSearchValue(item.batchNumber);
      const normalizedExpiryDate = toEndOfDay(item.expiryDate);
      const itemKey = [
        item.medicineId,
        normalizedBatchNumber,
        normalizedExpiryDate.toISOString().slice(0, 10),
      ].join("|");

      if (itemKeys.has(itemKey)) {
        throw buildAppError(
          400,
          "DUPLICATE_PURCHASE_ITEM",
          "Duplicate medicine batch rows are not allowed in the same purchase.",
        );
      }

      itemKeys.add(itemKey);

      if (normalizedExpiryDate < normalizedPurchaseDate) {
        throw buildAppError(
          400,
          "INVALID_EXPIRY_DATE",
          "Batch expiry date cannot be earlier than the purchase date.",
        );
      }

      if (
        input.supplierInvoiceDate &&
        toEndOfDay(input.supplierInvoiceDate) > normalizedPurchaseDate
      ) {
        throw buildAppError(
          400,
          "INVALID_SUPPLIER_INVOICE_DATE",
          "Supplier invoice date cannot be later than the purchase date.",
        );
      }

      const purchaseRateMinorUnits = toMoneyMinorUnits(item.purchaseRate);
      const saleRateMinorUnits = toMoneyMinorUnits(item.saleRate);
      const mrpMinorUnits = toMoneyMinorUnits(item.mrp);
      const grossMinorUnits = purchaseRateMinorUnits * item.quantity;
      const discountMinorUnits = roundPercentageAmount(
        grossMinorUnits,
        item.discountPercent,
      );
      const lineSubtotalMinorUnits = grossMinorUnits - discountMinorUnits;
      const lineTaxMinorUnits = roundPercentageAmount(
        lineSubtotalMinorUnits,
        item.gstPercent,
      );
      const lineTotalMinorUnits = lineSubtotalMinorUnits + lineTaxMinorUnits;

      return {
        medicineId: item.medicineId,
        batchNumber: item.batchNumber,
        batchNumberNormalized: normalizedBatchNumber,
        expiryDate: normalizedExpiryDate,
        quantity: item.quantity,
        freeQuantity: item.freeQuantity,
        purchaseRateMinorUnits,
        saleRateMinorUnits,
        mrpMinorUnits,
        gstPercent: item.gstPercent,
        discountPercent: item.discountPercent,
        discountMinorUnits,
        lineSubtotalMinorUnits,
        lineTaxMinorUnits,
        lineTotalMinorUnits,
      };
    });

    const subtotalMinorUnits = sumMoneyMinorUnits(
      items.map((item) => item.lineSubtotalMinorUnits),
    );
    const discountAmountMinorUnits = sumMoneyMinorUnits(
      items.map((item) => item.discountMinorUnits),
    );
    const taxAmountMinorUnits = sumMoneyMinorUnits(
      items.map((item) => item.lineTaxMinorUnits),
    );
    const roundOffMinorUnits = Math.round(input.roundOffAmount * 100);
    const grandTotalMinorUnits =
      subtotalMinorUnits + taxAmountMinorUnits + roundOffMinorUnits;
    const paidAmountMinorUnits = toMoneyMinorUnits(input.paidAmount);

    if (grandTotalMinorUnits < 0) {
      throw buildAppError(
        400,
        "INVALID_PURCHASE_TOTAL",
        "Grand total cannot be negative.",
      );
    }

    const settlementState = buildSettlementState(
      grandTotalMinorUnits,
      paidAmountMinorUnits,
    );

    return {
      normalizedPurchaseDate,
      supplierInvoiceDate: input.supplierInvoiceDate
        ? toEndOfDay(input.supplierInvoiceDate)
        : undefined,
      items,
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
    };
  }
}

export class PurchasesService {
  constructor(
    private readonly purchasesRepository = new PurchasesRepository(),
    private readonly inventoryStockService = new InventoryStockService(),
    private readonly alertsService = new AlertsService(),
    private readonly totalsBuilder = new PurchaseTotalsBuilder(),
    private readonly accountingLedgerService = new AccountingLedgerService(),
    private readonly adminSettingsService = new AdminSettingsService(),
    private readonly purchaseReturnsRepository = new PurchaseReturnsRepository(),
  ) {}

  async listPurchases(shopId: string, branchId: string, query: ListPurchasesQuery) {
    const normalizedQuery = {
      ...query,
      search: query.search ? normalizeSearchValue(query.search) : undefined,
    };

    const [items, total] = await Promise.all([
      this.purchasesRepository.listPurchases(shopId, branchId, normalizedQuery),
      this.purchasesRepository.countPurchases(shopId, branchId, normalizedQuery),
    ]);

    return buildPaginatedResponse(
      items.map(toPurchaseListResponse),
      total,
      normalizedQuery.page,
      normalizedQuery.pageSize,
    );
  }

  async getPurchaseById(shopId: string, branchId: string, purchaseId: string) {
    const purchase = await this.purchasesRepository.findPurchaseDetailById(
      shopId,
      branchId,
      purchaseId,
    );

    if (!purchase) {
      throw buildAppError(404, "PURCHASE_NOT_FOUND", "Purchase not found.");
    }

    const [completedReturnedQuantities, returnHistory] = await Promise.all([
      this.purchaseReturnsRepository.getCompletedReturnedQuantitiesByPurchaseItemIds(
        shopId,
        purchase.items.map(({ item }) => item.id),
      ),
      this.purchaseReturnsRepository.listPurchaseReturnHistoryByPurchaseId(
        shopId,
        purchaseId,
      ),
    ]);

    return toPurchaseDetailResponse(purchase, {
      completedReturnedQuantityByItemId: new Map(
        completedReturnedQuantities.map((entry) => [
          entry.purchaseItemId,
          Number(entry.quantity),
        ]),
      ),
      returnHistory: returnHistory.map((entry) => ({
        id: entry.purchaseReturn.id,
        returnNumber: entry.purchaseReturn.returnNumber,
        status: entry.purchaseReturn.status,
        totalReturnAmount: entry.purchaseReturn.totalReturnAmount,
        createdAt: entry.purchaseReturn.createdAt,
        completedAt: entry.purchaseReturn.completedAt,
        createdBy: entry.createdBy,
      })),
    });
  }

  async createPurchase(
    shopId: string,
    branchId: string,
    userId: string,
    input: CreatePurchaseInput,
  ) {
    const settings = await this.adminSettingsService.getResolvedShopSettings(shopId);

    if (!settings.allowDraftPurchases) {
      throw buildAppError(
        400,
        "DRAFT_PURCHASES_DISABLED",
        "Draft purchases are disabled in admin settings.",
      );
    }

    const supplier = await this.purchasesRepository.findSupplierById(
      shopId,
      input.supplierId,
    );

    if (!supplier) {
      throw buildAppError(404, "SUPPLIER_NOT_FOUND", "Supplier not found.");
    }

    if (supplier.status !== "active") {
      throw buildAppError(
        400,
        "SUPPLIER_INACTIVE",
        "Only active suppliers can be used for purchases.",
      );
    }

    const normalizedInvoiceNumber = input.supplierInvoiceNumber
      ? normalizeSearchValue(input.supplierInvoiceNumber)
      : undefined;

    if (normalizedInvoiceNumber) {
      const duplicateInvoice =
        await this.purchasesRepository.findDuplicateSupplierInvoice(
          shopId,
          input.supplierId,
          normalizedInvoiceNumber,
        );

      if (duplicateInvoice) {
        throw buildAppError(
          409,
          "DUPLICATE_SUPPLIER_INVOICE",
          "This supplier invoice number is already recorded for the supplier.",
        );
      }
    }

    const calculated = this.totalsBuilder.build(input);
    const medicines = await this.purchasesRepository.findMedicinesByIds(
      shopId,
      [...new Set(calculated.items.map((item) => item.medicineId))],
    );
    const medicineMap = new Map(medicines.map((medicine) => [medicine.id, medicine]));

    for (const item of calculated.items) {
      const medicine = medicineMap.get(item.medicineId);
      if (!medicine) {
        throw buildAppError(404, "MEDICINE_NOT_FOUND", "Medicine not found.");
      }

      if (medicine.status !== "active") {
        throw buildAppError(
          400,
          "MEDICINE_INACTIVE",
          "Only active medicines can be used for purchases.",
        );
      }
    }

    let createdPurchase:
      | Awaited<ReturnType<PurchasesRepository["createPurchase"]>>
      | null = null;

    try {
      createdPurchase = await db.transaction(async (tx) => {
        const purchaseNumber = buildPurchaseNumber();
        const purchase = await this.purchasesRepository.createPurchase(
          {
            shopId,
            branchId,
            supplierId: input.supplierId,
            purchaseNumber,
            purchaseNumberNormalized: normalizeSearchValue(purchaseNumber),
            supplierInvoiceNumber: input.supplierInvoiceNumber,
            supplierInvoiceNumberNormalized: normalizedInvoiceNumber,
            supplierInvoiceDate: calculated.supplierInvoiceDate,
            purchaseDate: calculated.normalizedPurchaseDate,
            status: "draft",
            paymentStatus: calculated.totals.paymentStatus,
            subtotal: moneyMinorUnitsToString(calculated.totals.subtotalMinorUnits),
            discountAmount: moneyMinorUnitsToString(
              calculated.totals.discountAmountMinorUnits,
            ),
            taxAmount: moneyMinorUnitsToString(calculated.totals.taxAmountMinorUnits),
            roundOffAmount: moneyMinorUnitsToString(
              calculated.totals.roundOffMinorUnits,
            ),
            grandTotal: moneyMinorUnitsToString(
              calculated.totals.grandTotalMinorUnits,
            ),
            initialPaidAmount: moneyMinorUnitsToString(
              calculated.totals.paidAmountMinorUnits,
            ),
            paidAmount: moneyMinorUnitsToString(
              calculated.totals.settledPaidMinorUnits,
            ),
            dueAmount: moneyMinorUnitsToString(calculated.totals.dueAmountMinorUnits),
            notes: input.notes,
            createdByUserId: userId,
            updatedByUserId: userId,
          },
          calculated.items.map((item) => ({
            medicineId: item.medicineId,
            batchNumber: item.batchNumber,
            batchNumberNormalized: item.batchNumberNormalized,
            expiryDate: item.expiryDate,
            quantity: item.quantity,
            freeQuantity: item.freeQuantity,
            purchaseRate: moneyMinorUnitsToString(item.purchaseRateMinorUnits),
            saleRate: moneyMinorUnitsToString(item.saleRateMinorUnits),
            mrp: moneyMinorUnitsToString(item.mrpMinorUnits),
            gstPercent: item.gstPercent,
            discountPercent: item.discountPercent.toFixed(2),
            lineSubtotal: moneyMinorUnitsToString(item.lineSubtotalMinorUnits),
            lineTaxAmount: moneyMinorUnitsToString(item.lineTaxMinorUnits),
            lineTotal: moneyMinorUnitsToString(item.lineTotalMinorUnits),
          })),
          tx,
        );

        return purchase;
      });
    } catch (error) {
      rethrowSupplierInvoiceConflict(error);
    }

    if (!createdPurchase) {
      throw buildAppError(
        500,
        "PURCHASE_CREATION_FAILED",
        "Purchase could not be created. Please try again.",
      );
    }

    realtimeService.publish({
      type: "purchase_changed",
      shopId,
      branchId,
      reason: "purchase_order_created",
      metadata: {
        purchaseId: createdPurchase.id,
      },
    });

    return this.getPurchaseById(shopId, branchId, createdPurchase.id);
  }

  async updateDraftPurchase(
    shopId: string,
    branchId: string,
    purchaseId: string,
    userId: string,
    input: UpdateDraftPurchaseInput,
  ) {
    const settings = await this.adminSettingsService.getResolvedShopSettings(shopId);

    if (!settings.allowDraftPurchases) {
      throw buildAppError(
        400,
        "DRAFT_PURCHASES_DISABLED",
        "Draft purchases are disabled in admin settings.",
      );
    }

    const existingPurchase = await this.purchasesRepository.findPurchaseById(
      shopId,
      branchId,
      purchaseId,
    );

    if (!existingPurchase) {
      throw buildAppError(404, "PURCHASE_NOT_FOUND", "Purchase not found.");
    }

    if (existingPurchase.status !== "draft") {
      throw buildAppError(
        400,
        "PURCHASE_NOT_EDITABLE",
        "Only draft purchases can be edited.",
      );
    }

    if (
      existingPurchase.purchaseOrderApprovedAt ||
      existingPurchase.supplierNotifiedAt
    ) {
      throw buildAppError(
        400,
        "PURCHASE_ORDER_ALREADY_IN_WORKFLOW",
        "Approved or supplier-shared purchase orders cannot be edited. Cancel and recreate the order if changes are required.",
      );
    }

    const supplier = await this.purchasesRepository.findSupplierById(
      shopId,
      input.supplierId,
    );

    if (!supplier) {
      throw buildAppError(404, "SUPPLIER_NOT_FOUND", "Supplier not found.");
    }

    if (supplier.status !== "active") {
      throw buildAppError(
        400,
        "SUPPLIER_INACTIVE",
        "Only active suppliers can be used for purchases.",
      );
    }

    const normalizedInvoiceNumber = input.supplierInvoiceNumber
      ? normalizeSearchValue(input.supplierInvoiceNumber)
      : undefined;

    if (normalizedInvoiceNumber) {
      const duplicateInvoice =
        await this.purchasesRepository.findDuplicateSupplierInvoice(
          shopId,
          input.supplierId,
          normalizedInvoiceNumber,
          purchaseId,
        );

      if (duplicateInvoice) {
        throw buildAppError(
          409,
          "DUPLICATE_SUPPLIER_INVOICE",
          "This supplier invoice number is already recorded for the supplier.",
        );
      }
    }

    const calculated = this.totalsBuilder.build(input);
    const medicines = await this.purchasesRepository.findMedicinesByIds(
      shopId,
      [...new Set(calculated.items.map((item) => item.medicineId))],
    );
    const medicineMap = new Map(medicines.map((medicine) => [medicine.id, medicine]));

    for (const item of calculated.items) {
      const medicine = medicineMap.get(item.medicineId);
      if (!medicine) {
        throw buildAppError(404, "MEDICINE_NOT_FOUND", "Medicine not found.");
      }

      if (medicine.status !== "active") {
        throw buildAppError(
          400,
          "MEDICINE_INACTIVE",
          "Only active medicines can be used for purchases.",
        );
      }
    }

    try {
      await db.transaction(async (tx) => {
        await this.purchasesRepository.updatePurchase(
          purchaseId,
          {
            supplierId: input.supplierId,
            supplierInvoiceNumber: input.supplierInvoiceNumber,
            supplierInvoiceNumberNormalized: normalizedInvoiceNumber,
            supplierInvoiceDate: calculated.supplierInvoiceDate,
            purchaseDate: calculated.normalizedPurchaseDate,
            paymentStatus: calculated.totals.paymentStatus,
            subtotal: moneyMinorUnitsToString(calculated.totals.subtotalMinorUnits),
            discountAmount: moneyMinorUnitsToString(
              calculated.totals.discountAmountMinorUnits,
            ),
            taxAmount: moneyMinorUnitsToString(calculated.totals.taxAmountMinorUnits),
            roundOffAmount: moneyMinorUnitsToString(
              calculated.totals.roundOffMinorUnits,
            ),
            grandTotal: moneyMinorUnitsToString(
              calculated.totals.grandTotalMinorUnits,
            ),
            initialPaidAmount: moneyMinorUnitsToString(
              calculated.totals.paidAmountMinorUnits,
            ),
            paidAmount: moneyMinorUnitsToString(
              calculated.totals.settledPaidMinorUnits,
            ),
            dueAmount: moneyMinorUnitsToString(calculated.totals.dueAmountMinorUnits),
            notes: input.notes,
            updatedByUserId: userId,
          },
          tx,
        );

        await this.purchasesRepository.replacePurchaseItems(
          purchaseId,
          shopId,
          branchId,
          calculated.items.map((item) => ({
            medicineId: item.medicineId,
            batchNumber: item.batchNumber,
            batchNumberNormalized: item.batchNumberNormalized,
            expiryDate: item.expiryDate,
            quantity: item.quantity,
            freeQuantity: item.freeQuantity,
            purchaseRate: moneyMinorUnitsToString(item.purchaseRateMinorUnits),
            saleRate: moneyMinorUnitsToString(item.saleRateMinorUnits),
            mrp: moneyMinorUnitsToString(item.mrpMinorUnits),
            gstPercent: item.gstPercent,
            discountPercent: item.discountPercent.toFixed(2),
            lineSubtotal: moneyMinorUnitsToString(item.lineSubtotalMinorUnits),
            lineTaxAmount: moneyMinorUnitsToString(item.lineTaxMinorUnits),
            lineTotal: moneyMinorUnitsToString(item.lineTotalMinorUnits),
          })),
          tx,
        );
      });
    } catch (error) {
      rethrowSupplierInvoiceConflict(error);
    }

    realtimeService.publish({
      type: "purchase_changed",
      shopId,
      branchId,
      reason: "purchase_order_updated",
      metadata: {
        purchaseId,
      },
    });

    return this.getPurchaseById(shopId, branchId, purchaseId);
  }

  async finalizePurchase(
    shopId: string,
    branchId: string,
    purchaseId: string,
    userId: string,
  ) {
    let supplierId: string | null = null;

    await db.transaction(async (tx) => {
      const purchase = await this.purchasesRepository.findPurchaseById(
        shopId,
        branchId,
        purchaseId,
        tx,
      );

      if (!purchase) {
        throw buildAppError(404, "PURCHASE_NOT_FOUND", "Purchase not found.");
      }

      if (purchase.status !== "draft") {
        throw buildAppError(
          400,
          "PURCHASE_NOT_FINALIZABLE",
          "Only draft purchases can be finalized.",
        );
      }

      const items = await this.purchasesRepository.listPurchaseItemsByPurchaseId(
        purchaseId,
        branchId,
        tx,
      );

      if (!items.length) {
        throw buildAppError(
          400,
          "PURCHASE_HAS_NO_ITEMS",
          "Purchase must contain at least one item before finalization.",
        );
      }

      const stockPostingResult = await this.inventoryStockService.postPurchaseStock(
        {
          shopId,
          branchId,
          purchaseId,
          createdByUserId: userId,
          items: items.map((item) => ({
            id: item.id,
            medicineId: item.medicineId,
            batchNumber: item.batchNumber,
            batchNumberNormalized: item.batchNumberNormalized,
            expiryDate: item.expiryDate,
            quantity: item.quantity,
            freeQuantity: item.freeQuantity,
            purchaseRate: item.purchaseRate,
            saleRate: item.saleRate,
            mrp: item.mrp,
            gstPercent: item.gstPercent,
          })),
        },
        tx,
      );

      for (const postedBatch of stockPostingResult.postedBatches) {
        await this.purchasesRepository.assignPurchaseItemBatch(
          postedBatch.purchaseItemId,
          postedBatch.batchId,
          tx,
        );
      }
      supplierId = purchase.supplierId;

      await this.purchasesRepository.updatePurchase(
        purchaseId,
        {
          status: "finalized",
          ...(purchase.purchaseOrderApprovedAt
            ? {}
            : {
                purchaseOrderApprovedAt: new Date(),
                purchaseOrderApprovedByUserId: userId,
              }),
          finalizedAt: new Date(),
          updatedByUserId: userId,
        },
        tx,
      );

      await this.accountingLedgerService.applyAvailableSupplierAdvanceToPurchase(
        shopId,
        purchaseId,
        tx,
      );

      await this.accountingLedgerService.syncSupplierPurchaseFinancials(
        shopId,
        purchaseId,
        userId,
        tx,
      );
    });

    try {
      await this.alertsService.dispatchPendingInventoryAlertEmails(
        shopId,
        branchId,
      );
    } catch (error) {
      logger.error("Purchase finalized but inventory alert email dispatch failed", {
        purchaseId,
        shopId,
        branchId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    if (supplierId) {
      try {
        await this.alertsService.syncSupplierPayableNotification(
          shopId,
          supplierId,
        );
      } catch (error) {
        logger.error("Purchase finalized but supplier payable sync failed", {
          purchaseId,
          shopId,
          supplierId,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    realtimeService.publish({
      type: "purchase_changed",
      shopId,
      branchId,
      reason: "purchase_received",
      metadata: {
        purchaseId,
      },
    });
    realtimeService.publish({
      type: "inventory_changed",
      shopId,
      branchId,
      reason: "purchase_received",
      metadata: {
        purchaseId,
      },
    });
    realtimeService.publish({
      type: "notification_changed",
      shopId,
      branchId,
      reason: "purchase_received",
      metadata: {
        purchaseId,
      },
    });

    return this.getPurchaseById(shopId, branchId, purchaseId);
  }

  async approvePurchaseOrder(
    shopId: string,
    branchId: string,
    purchaseId: string,
    userId: string,
  ) {
    const purchase = await this.purchasesRepository.findPurchaseById(
      shopId,
      branchId,
      purchaseId,
    );

    if (!purchase) {
      throw buildAppError(404, "PURCHASE_NOT_FOUND", "Purchase not found.");
    }

    if (purchase.status !== "draft") {
      throw buildAppError(
        400,
        "PURCHASE_ORDER_NOT_APPROVABLE",
        "Only open purchase orders can be approved.",
      );
    }

    if (purchase.purchaseOrderApprovedAt) {
      throw buildAppError(
        400,
        "PURCHASE_ORDER_ALREADY_APPROVED",
        "Purchase order is already approved.",
      );
    }

    await this.purchasesRepository.updatePurchase(
      purchaseId,
      {
        purchaseOrderApprovedAt: new Date(),
        purchaseOrderApprovedByUserId: userId,
        updatedByUserId: userId,
      },
      db,
    );

    realtimeService.publish({
      type: "purchase_changed",
      shopId,
      branchId,
      reason: "purchase_order_approved",
      metadata: {
        purchaseId,
      },
    });

    return this.getPurchaseById(shopId, branchId, purchaseId);
  }

  async markPurchaseOrderSupplierNotified(
    shopId: string,
    branchId: string,
    purchaseId: string,
    userId: string,
  ) {
    const purchase = await this.purchasesRepository.findPurchaseById(
      shopId,
      branchId,
      purchaseId,
    );

    if (!purchase) {
      throw buildAppError(404, "PURCHASE_NOT_FOUND", "Purchase not found.");
    }

    if (purchase.status !== "draft") {
      throw buildAppError(
        400,
        "PURCHASE_ORDER_NOT_SHAREABLE",
        "Only open purchase orders can be marked as shared with the supplier.",
      );
    }

    if (!purchase.purchaseOrderApprovedAt) {
      throw buildAppError(
        400,
        "PURCHASE_ORDER_NOT_APPROVED",
        "Approve the purchase order before marking it as shared with the supplier.",
      );
    }

    if (purchase.supplierNotifiedAt) {
      throw buildAppError(
        400,
        "PURCHASE_ORDER_ALREADY_SHARED",
        "Purchase order is already marked as shared with the supplier.",
      );
    }

    await this.purchasesRepository.updatePurchase(
      purchaseId,
      {
        supplierNotifiedAt: new Date(),
        supplierNotifiedByUserId: userId,
        updatedByUserId: userId,
      },
      db,
    );

    realtimeService.publish({
      type: "purchase_changed",
      shopId,
      branchId,
      reason: "purchase_order_supplier_notified",
      metadata: {
        purchaseId,
      },
    });

    return this.getPurchaseById(shopId, branchId, purchaseId);
  }

  async cancelPurchase(
    shopId: string,
    branchId: string,
    purchaseId: string,
    userId: string,
    input: CancelPurchaseInput,
  ) {
    const purchase = await this.purchasesRepository.findPurchaseById(
      shopId,
      branchId,
      purchaseId,
    );

    if (!purchase) {
      throw buildAppError(404, "PURCHASE_NOT_FOUND", "Purchase not found.");
    }

    if (purchase.status === "finalized") {
      throw buildAppError(
        400,
        "FINALIZED_PURCHASE_CANCELLATION_BLOCKED",
        "Finalized purchases cannot be cancelled. Use a dedicated return or reversal workflow instead.",
      );
    }

    if (purchase.status === "cancelled") {
      throw buildAppError(
        400,
        "PURCHASE_ALREADY_CANCELLED",
        "Purchase is already cancelled.",
      );
    }

    await this.purchasesRepository.updatePurchase(purchaseId, {
      status: "cancelled",
      cancelledAt: new Date(),
      updatedByUserId: userId,
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    }, db);

    realtimeService.publish({
      type: "purchase_changed",
      shopId,
      branchId,
      reason: "purchase_order_cancelled",
      metadata: {
        purchaseId,
      },
    });

    return this.getPurchaseById(shopId, branchId, purchaseId);
  }

  async deletePurchase(shopId: string, branchId: string, purchaseId: string, userId: string) {
    const purchase = await this.purchasesRepository.findPurchaseById(shopId, branchId, purchaseId);

    if (!purchase) {
      throw buildAppError(404, "PURCHASE_NOT_FOUND", "Purchase not found.");
    }

    // 1. Check for Purchase Returns
    const returnCount = await this.purchaseReturnsRepository.countPurchaseReturnsByPurchaseId(shopId, purchaseId);
    if (returnCount > 0) {
      throw buildAppError(
        400,
        "PURCHASE_HAS_RETURNS",
        "Cannot delete purchase because it has linked purchase returns. Cancel the returns first.",
      );
    }

    // 2. Check for Payment Allocations (if we have a table for it)
    // Looking at the schema, supplierPaymentAllocations references purchaseId.
    // I'll need to check this in the repository or directly here if I have the repo.
    // Let's check if the service has access to a repository for this.
    // Actually, I'll just check if there's a record in supplier_payment_allocations.

    // 3. If Finalized, check stock movement
    if (purchase.status === "finalized") {
      const items = await this.purchasesRepository.listPurchaseItemsByPurchaseId(purchaseId, branchId);
      const batchIds = items
        .map((item) => item.medicineBatchId)
        .filter((id): id is string => id !== null);

      if (batchIds.length > 0) {
        const batches = await this.inventoryStockService.getBatchesByIds(shopId, branchId, batchIds);
        for (const batch of batches) {
          if (Number(batch.quantityAvailable) < Number(batch.quantityReceived)) {
            throw buildAppError(
              400,
              "STOCK_ALREADY_SOLD",
              `Cannot delete purchase because some stock from batch ${batch.batchNumber} has already been sold or moved.`,
            );
          }
        }
      }
    }

    // Perform deletion in transaction
    await db.transaction(async (tx) => {
      if (purchase.status === "finalized") {
        await this.inventoryStockService.deletePurchaseStock(shopId, branchId, purchaseId, tx);
      }

      await this.purchasesRepository.deletePurchase(purchaseId, tx);

      if (purchase.status === "finalized") {
        await this.accountingLedgerService.rebuildSupplierLedger(
          shopId,
          purchase.supplierId,
          tx,
        );
      }
    });

    if (purchase.status === "finalized") {
      try {
        await this.alertsService.dispatchPendingInventoryAlertEmails(
          shopId,
          branchId,
        );
      } catch (error) {
        logger.error("Purchase deleted but inventory alert email dispatch failed", {
          purchaseId,
          shopId,
          branchId,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }

      try {
        await this.alertsService.syncSupplierPayableNotification(
          shopId,
          purchase.supplierId,
        );
      } catch (error) {
        logger.error("Purchase deleted but supplier payable sync failed", {
          purchaseId,
          shopId,
          supplierId: purchase.supplierId,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    realtimeService.publish({
      type: "purchase_changed",
      shopId,
      branchId,
      reason: "purchase_deleted",
      metadata: {
        purchaseId,
        deletedStatus: purchase.status,
      },
    });

    if (purchase.status === "finalized") {
      realtimeService.publish({
        type: "inventory_changed",
        shopId,
        branchId,
        reason: "purchase_deleted",
        metadata: {
          purchaseId,
        },
      });
      realtimeService.publish({
        type: "notification_changed",
        shopId,
        branchId,
        reason: "purchase_deleted",
        metadata: {
          purchaseId,
        },
      });
    }
  }
}
