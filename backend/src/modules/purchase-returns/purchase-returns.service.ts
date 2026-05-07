import { db } from "../../db/client";
import { AppError } from "../../shared/errors/app-error";
import { logger } from "../../shared/logger";
import {
  moneyMinorUnitsToString,
  roundPercentageAmount,
  sumMoneyMinorUnits,
  toMoneyMinorUnits,
} from "../../shared/utils/money";
import { toEndOfDay } from "../../shared/utils/date-range";
import { collapseWhitespace } from "../../shared/utils/strings";
import { AlertsService } from "../alerts/alerts.service";
import { AccountingLedgerService } from "../accounting/accounting-ledger.service";
import { InventoryRepository } from "../inventory/inventory.repository";
import { InventoryStockService } from "../inventory/inventory.stock.service";
import { realtimeService } from "../realtime/realtime.service";
import { PurchaseReturnsRepository } from "./purchase-returns.repository";
import type {
  CreatePurchaseReturnInput,
  ListPurchaseReturnsQuery,
  PurchaseReturnItemInput,
  UpdatePurchaseReturnInput,
} from "./purchase-returns.validation";
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
  const normalized = (value ?? "PR")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 12);

  return normalized || "PR";
};

const buildReturnNumber = (invoicePrefix: string, sequence: number) =>
  `${sanitizeInvoicePrefix(invoicePrefix)}-PR-${sequence.toString().padStart(6, "0")}`;

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

type PreparedReturnItem = {
  purchaseItemId: string;
  medicineId: string;
  batchId: string;
  quantity: number;
  purchaseRateMinorUnits: number;
  taxPercent: number;
  discountMinorUnits: number;
  lineReturnAmountMinorUnits: number;
  reason: PurchaseReturnItemInput["reason"];
  notes?: string;
};

type PreparedReturnDraft = {
  purchaseId: string;
  supplierId: string;
  notes?: string;
  totalReturnAmountMinorUnits: number;
  items: PreparedReturnItem[];
};

export class PurchaseReturnsService {
  constructor(
    private readonly purchaseReturnsRepository = new PurchaseReturnsRepository(),
    private readonly inventoryRepository = new InventoryRepository(),
    private readonly inventoryStockService = new InventoryStockService(),
    private readonly alertsService = new AlertsService(),
    private readonly accountingLedgerService = new AccountingLedgerService(),
  ) {}

  async listPurchaseReturns(shopId: string, query: ListPurchaseReturnsQuery) {
    const normalizedQuery = {
      ...query,
      search: query.search ? normalizeSearchValue(query.search) : undefined,
      ...(query.dateTo ? { dateTo: toEndOfDay(query.dateTo) } : {}),
    };

    const [items, total] = await Promise.all([
      this.purchaseReturnsRepository.listPurchaseReturns(shopId, normalizedQuery),
      this.purchaseReturnsRepository.countPurchaseReturns(shopId, normalizedQuery),
    ]);

    return buildPaginatedResponse(
      items.map((record) => ({
        id: record.purchaseReturn.id,
        purchaseId: record.purchaseReturn.purchaseId,
        supplierId: record.purchaseReturn.supplierId,
        returnNumber: record.purchaseReturn.returnNumber,
        purchaseNumber: record.purchase.purchaseNumber,
        supplierName: record.supplier.supplierName,
        supplier: record.supplier,
        status: record.purchaseReturn.status,
        totalReturnAmount: record.purchaseReturn.totalReturnAmount,
        notes: record.purchaseReturn.notes,
        createdAt: record.purchaseReturn.createdAt,
        updatedAt: record.purchaseReturn.updatedAt,
        completedAt: record.purchaseReturn.completedAt,
        cancelledAt: record.purchaseReturn.cancelledAt,
        createdBy: record.createdBy,
      })),
      total,
      normalizedQuery.page,
      normalizedQuery.pageSize,
    );
  }

  async getPurchaseReturnById(shopId: string, returnId: string) {
    const record = await this.purchaseReturnsRepository.findPurchaseReturnDetailById(
      shopId,
      returnId,
    );

    if (!record) {
      throw buildAppError(
        404,
        "PURCHASE_RETURN_NOT_FOUND",
        "Purchase return not found.",
      );
    }

    return {
      id: record.purchaseReturn.id,
      shopId: record.purchaseReturn.shopId,
      purchaseId: record.purchaseReturn.purchaseId,
      supplierId: record.purchaseReturn.supplierId,
      returnNumber: record.purchaseReturn.returnNumber,
      status: record.purchaseReturn.status,
      totalReturnAmount: record.purchaseReturn.totalReturnAmount,
      notes: record.purchaseReturn.notes,
      createdByUserId: record.purchaseReturn.createdByUserId,
      completedByUserId: record.purchaseReturn.completedByUserId,
      completedAt: record.purchaseReturn.completedAt,
      cancelledAt: record.purchaseReturn.cancelledAt,
      createdAt: record.purchaseReturn.createdAt,
      updatedAt: record.purchaseReturn.updatedAt,
      createdBy: record.createdBy,
      completedBy: record.completedBy,
      purchase: {
        id: record.purchase.id,
        purchaseNumber: record.purchase.purchaseNumber,
        purchaseDate: record.purchase.purchaseDate,
        status: record.purchase.status,
        paymentStatus: record.purchase.paymentStatus,
        grandTotal: record.purchase.grandTotal,
        paidAmount: record.purchase.paidAmount,
        dueAmount: record.purchase.dueAmount,
        finalizedAt: record.purchase.finalizedAt,
      },
      supplier: record.supplier,
      items: record.items.map(({ item, purchaseItem, medicine, batch }) => ({
        id: item.id,
        purchaseItemId: item.purchaseItemId,
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
        purchasedQuantity: purchaseItem.quantity,
        freeQuantity: purchaseItem.freeQuantity,
        quantity: item.quantity,
        purchaseRate: item.purchaseRate,
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

  async getReturnablePurchaseDetail(shopId: string, purchaseId: string) {
    await this.inventoryRepository.syncBatchStatuses(shopId);

    const record = await this.purchaseReturnsRepository.findPurchaseWithRelationsById(
      shopId,
      purchaseId,
    );

    if (!record) {
      throw buildAppError(404, "PURCHASE_NOT_FOUND", "Purchase not found.");
    }

    if (record.purchase.status !== "finalized") {
      throw buildAppError(
        400,
        "PURCHASE_NOT_RETURNABLE",
        "Returns can only be created against finalized purchases.",
      );
    }

    const purchaseItems =
      await this.purchaseReturnsRepository.listPurchaseItemsWithRelationsByPurchaseId(
        shopId,
        purchaseId,
      );
    const returnedQuantities =
      await this.purchaseReturnsRepository.getCompletedReturnedQuantitiesByPurchaseItemIds(
        shopId,
        purchaseItems.map(({ item }) => item.id),
      );
    const returnedQuantityMap = new Map(
      returnedQuantities.map((entry) => [entry.purchaseItemId, Number(entry.quantity)]),
    );

    return {
      purchase: {
        id: record.purchase.id,
        purchaseNumber: record.purchase.purchaseNumber,
        purchaseDate: record.purchase.purchaseDate,
        status: record.purchase.status,
        paymentStatus: record.purchase.paymentStatus,
        grandTotal: record.purchase.grandTotal,
        paidAmount: record.purchase.paidAmount,
        dueAmount: record.purchase.dueAmount,
        notes: record.purchase.notes,
        finalizedAt: record.purchase.finalizedAt,
        createdBy: record.createdBy,
      },
      supplier: record.supplier,
      items: purchaseItems.map(({ item, medicine, batch }) => {
        const alreadyReturnedQuantity = returnedQuantityMap.get(item.id) ?? 0;
        const remainingReturnableQuantity = Math.max(
          item.quantity - alreadyReturnedQuantity,
          0,
        );

        return {
          purchaseItemId: item.id,
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
          purchasedQuantity: item.quantity,
          freeQuantity: item.freeQuantity,
          alreadyReturnedQuantity,
          remainingReturnableQuantity,
          availableBatchQuantity: Math.max(batch.quantityAvailable, 0),
          maxReturnableQuantity: Math.min(
            remainingReturnableQuantity,
            Math.max(batch.quantityAvailable, 0),
          ),
          purchaseRate: item.purchaseRate,
          taxPercent: item.gstPercent,
          discountPercent: item.discountPercent,
          lineTotal: item.lineTotal,
        };
      }),
    };
  }

  async createDraftPurchaseReturn(
    shopId: string,
    userId: string,
    input: CreatePurchaseReturnInput,
  ) {
    const returnId = await db.transaction(async (tx) => {
      const preparedDraft = await this.prepareReturnDraft(
        shopId,
        {
          purchaseId: input.purchaseId,
          ...(input.notes ? { notes: input.notes } : {}),
          items: input.items,
        },
        tx,
      );
      const returnMeta = await this.buildReturnMeta(shopId, tx);
      const created = await this.purchaseReturnsRepository.createPurchaseReturn(
        {
          shopId,
          purchaseId: preparedDraft.purchaseId,
          supplierId: preparedDraft.supplierId,
          returnSequence: returnMeta.sequence,
          returnNumber: returnMeta.returnNumber,
          returnNumberNormalized: normalizeSearchValue(returnMeta.returnNumber),
          status: "draft",
          totalReturnAmount: moneyMinorUnitsToString(
            preparedDraft.totalReturnAmountMinorUnits,
          ),
          notes: preparedDraft.notes,
          createdByUserId: userId,
        },
        preparedDraft.items.map((item) => ({
          purchaseItemId: item.purchaseItemId,
          medicineId: item.medicineId,
          batchId: item.batchId,
          quantity: item.quantity,
          purchaseRate: moneyMinorUnitsToString(item.purchaseRateMinorUnits),
          taxPercent: item.taxPercent,
          discountAmount: moneyMinorUnitsToString(item.discountMinorUnits),
          lineReturnAmount: moneyMinorUnitsToString(item.lineReturnAmountMinorUnits),
          reason: item.reason,
          notes: item.notes,
        })),
        tx,
      );

      return created.purchaseReturn.id;
    });

    return this.getPurchaseReturnById(shopId, returnId);
  }

  async updateDraftPurchaseReturn(
    shopId: string,
    returnId: string,
    input: UpdatePurchaseReturnInput,
  ) {
    const existing = await this.purchaseReturnsRepository.findPurchaseReturnById(
      shopId,
      returnId,
    );

    if (!existing) {
      throw buildAppError(
        404,
        "PURCHASE_RETURN_NOT_FOUND",
        "Purchase return not found.",
      );
    }

    if (existing.status !== "draft") {
      throw buildAppError(
        400,
        "PURCHASE_RETURN_NOT_EDITABLE",
        "Only draft purchase returns can be edited.",
      );
    }

    await db.transaction(async (tx) => {
      const preparedDraft = await this.prepareReturnDraft(
        shopId,
        {
          purchaseId: existing.purchaseId,
          ...(input.notes ? { notes: input.notes } : {}),
          items: input.items,
        },
        tx,
      );

      await this.purchaseReturnsRepository.updatePurchaseReturn(
        returnId,
        {
          totalReturnAmount: moneyMinorUnitsToString(
            preparedDraft.totalReturnAmountMinorUnits,
          ),
          notes: preparedDraft.notes,
        },
        tx,
      );

      await this.purchaseReturnsRepository.replacePurchaseReturnItems(
        returnId,
        shopId,
        preparedDraft.items.map((item) => ({
          purchaseItemId: item.purchaseItemId,
          medicineId: item.medicineId,
          batchId: item.batchId,
          quantity: item.quantity,
          purchaseRate: moneyMinorUnitsToString(item.purchaseRateMinorUnits),
          taxPercent: item.taxPercent,
          discountAmount: moneyMinorUnitsToString(item.discountMinorUnits),
          lineReturnAmount: moneyMinorUnitsToString(item.lineReturnAmountMinorUnits),
          reason: item.reason,
          notes: item.notes,
        })),
        tx,
      );
    });

    return this.getPurchaseReturnById(shopId, returnId);
  }

  async completePurchaseReturn(shopId: string, returnId: string, userId: string) {
    await db.transaction(async (tx) => {
      await this.inventoryRepository.syncBatchStatuses(shopId, tx);

      const existing = await this.purchaseReturnsRepository.findPurchaseReturnById(
        shopId,
        returnId,
        tx,
      );

      if (!existing) {
        throw buildAppError(
          404,
          "PURCHASE_RETURN_NOT_FOUND",
          "Purchase return not found.",
        );
      }

      if (existing.status !== "draft") {
        throw buildAppError(
          400,
          "PURCHASE_RETURN_NOT_COMPLETABLE",
          "Only draft purchase returns can be completed.",
        );
      }

      const draftItems =
        await this.purchaseReturnsRepository.listPurchaseReturnItemsByReturnId(
          returnId,
          tx,
        );

      if (!draftItems.length) {
        throw buildAppError(
          400,
          "PURCHASE_RETURN_EMPTY",
          "Purchase return must contain at least one item.",
        );
      }

      const preparedDraft = await this.prepareReturnDraft(
        shopId,
        {
          purchaseId: existing.purchaseId,
          ...(existing.notes ? { notes: existing.notes } : {}),
          items: draftItems.map((item) => ({
            purchaseItemId: item.purchaseItemId,
            quantity: item.quantity,
            reason: item.reason,
            notes: item.notes ?? undefined,
          })),
        },
        tx,
      );

      const refreshedItems =
        await this.purchaseReturnsRepository.replacePurchaseReturnItems(
          returnId,
          shopId,
          preparedDraft.items.map((item) => ({
            purchaseItemId: item.purchaseItemId,
            medicineId: item.medicineId,
            batchId: item.batchId,
            quantity: item.quantity,
            purchaseRate: moneyMinorUnitsToString(item.purchaseRateMinorUnits),
            taxPercent: item.taxPercent,
            discountAmount: moneyMinorUnitsToString(item.discountMinorUnits),
            lineReturnAmount: moneyMinorUnitsToString(item.lineReturnAmountMinorUnits),
            reason: item.reason,
            notes: item.notes,
          })),
          tx,
        );

      await this.inventoryStockService.depletePurchaseReturnStock(
        {
          shopId,
          purchaseReturnId: returnId,
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

      await this.purchaseReturnsRepository.updatePurchaseReturn(
        returnId,
        {
          status: "completed",
          totalReturnAmount: moneyMinorUnitsToString(
            preparedDraft.totalReturnAmountMinorUnits,
          ),
          notes: preparedDraft.notes,
          completedByUserId: userId,
          completedAt: new Date(),
        },
        tx,
      );

      await this.accountingLedgerService.syncSupplierPurchaseFinancials(
        shopId,
        existing.purchaseId,
        userId,
        tx,
      );
    });

    try {
      await this.alertsService.dispatchPendingInventoryAlertEmails(shopId);
    } catch (error) {
      logger.error("Purchase return completed but notification email dispatch failed", {
        returnId,
        shopId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    realtimeService.publish({
      type: "inventory_changed",
      shopId,
      reason: "purchase_return_completed",
      metadata: {
        returnId,
      },
    });
    realtimeService.publish({
      type: "notification_changed",
      shopId,
      reason: "purchase_return_completed",
      metadata: {
        returnId,
      },
    });

    return this.getPurchaseReturnById(shopId, returnId);
  }

  async cancelDraftPurchaseReturn(shopId: string, returnId: string) {
    const existing = await this.purchaseReturnsRepository.findPurchaseReturnById(
      shopId,
      returnId,
    );

    if (!existing) {
      throw buildAppError(
        404,
        "PURCHASE_RETURN_NOT_FOUND",
        "Purchase return not found.",
      );
    }

    if (existing.status !== "draft") {
      throw buildAppError(
        400,
        "PURCHASE_RETURN_NOT_CANCELLABLE",
        "Only draft purchase returns can be cancelled.",
      );
    }

    await db.transaction(async (tx) => {
      await this.purchaseReturnsRepository.updatePurchaseReturn(
        returnId,
        {
          status: "cancelled",
          cancelledAt: new Date(),
        },
        tx,
      );
    });

    return this.getPurchaseReturnById(shopId, returnId);
  }

  private async buildReturnMeta(shopId: string, executor: DbExecutor) {
    await this.purchaseReturnsRepository.lockReturnSequence(shopId, executor);
    const [shop, sequence] = await Promise.all([
      this.purchaseReturnsRepository.getShopById(shopId, executor),
      this.purchaseReturnsRepository.getNextReturnSequence(shopId, executor),
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
      purchaseId: string;
      notes?: string;
      items: PurchaseReturnItemInput[];
    },
    executor?: DbExecutor,
  ): Promise<PreparedReturnDraft> {
    const purchase = await this.purchaseReturnsRepository.findPurchaseById(
      shopId,
      input.purchaseId,
      executor,
    );

    if (!purchase) {
      throw buildAppError(404, "PURCHASE_NOT_FOUND", "Purchase not found.");
    }

    if (purchase.status !== "finalized") {
      throw buildAppError(
        400,
        "PURCHASE_NOT_RETURNABLE",
        "Returns can only be created against finalized purchases.",
      );
    }

    const purchaseItemRecords =
      await this.purchaseReturnsRepository.listPurchaseItemsWithRelationsByPurchaseId(
        shopId,
        input.purchaseId,
        executor,
      );

    if (!purchaseItemRecords.length) {
      throw buildAppError(
        400,
        "PURCHASE_HAS_NO_ITEMS",
        "The selected purchase does not contain any returnable items.",
      );
    }

    const purchaseItemMap = new Map(
      purchaseItemRecords.map((record) => [record.item.id, record]),
    );
    const returnedQuantities =
      await this.purchaseReturnsRepository.getCompletedReturnedQuantitiesByPurchaseItemIds(
        shopId,
        purchaseItemRecords.map(({ item }) => item.id),
        executor,
      );
    const returnedQuantityMap = new Map(
      returnedQuantities.map((entry) => [entry.purchaseItemId, Number(entry.quantity)]),
    );
    const preparedItems: PreparedReturnItem[] = [];
    const seenPurchaseItemIds = new Set<string>();

    for (const inputItem of input.items) {
      if (seenPurchaseItemIds.has(inputItem.purchaseItemId)) {
        throw buildAppError(
          400,
          "DUPLICATE_PURCHASE_RETURN_ITEM",
          "Each purchase item can only be included once in a return.",
        );
      }

      seenPurchaseItemIds.add(inputItem.purchaseItemId);
      const record = purchaseItemMap.get(inputItem.purchaseItemId);

      if (!record) {
        throw buildAppError(
          400,
          "INVALID_PURCHASE_RETURN_ITEM",
          "One or more selected items do not belong to the purchase.",
        );
      }

      const alreadyReturnedQuantity =
        returnedQuantityMap.get(inputItem.purchaseItemId) ?? 0;
      const remainingReturnableQuantity =
        record.item.quantity - alreadyReturnedQuantity;
      const availableBatchQuantity = Math.max(record.batch.quantityAvailable, 0);
      const maxReturnableQuantity = Math.min(
        remainingReturnableQuantity,
        availableBatchQuantity,
      );

      if (remainingReturnableQuantity <= 0 || maxReturnableQuantity <= 0) {
        throw buildAppError(
          400,
          "ITEM_NOT_RETURNABLE",
          `${record.medicine.medicineName} does not have enough stock left in the original batch to return.`,
        );
      }

      if (inputItem.quantity > maxReturnableQuantity) {
        throw buildAppError(
          400,
          "RETURN_QUANTITY_EXCEEDED",
          `${record.medicine.medicineName} can only return ${maxReturnableQuantity} more from the original batch.`,
        );
      }

      const purchaseRateMinorUnits = toMoneyMinorUnits(record.item.purchaseRate);
      const grossMinorUnits = purchaseRateMinorUnits * inputItem.quantity;
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
        purchaseItemId: inputItem.purchaseItemId,
        medicineId: record.item.medicineId,
        batchId: record.batch.id,
        quantity: inputItem.quantity,
        purchaseRateMinorUnits,
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
        "PURCHASE_RETURN_EMPTY",
        "Purchase return must contain at least one item.",
      );
    }

    return {
      purchaseId: input.purchaseId,
      supplierId: purchase.supplierId,
      ...(input.notes ? { notes: input.notes } : {}),
      totalReturnAmountMinorUnits: sumMoneyMinorUnits(
        preparedItems.map((item) => item.lineReturnAmountMinorUnits),
      ),
      items: preparedItems,
    };
  }
}
