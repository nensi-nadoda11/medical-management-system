import { db } from "../../db/client";
import { AppError } from "../../shared/errors/app-error";
import { logger } from "../../shared/logger";
import { AlertsService } from "../alerts/alerts.service";
import { AdminSettingsService } from "../admin-settings/admin-settings.service";
import { BranchesService } from "../branches/branches.service";
import { realtimeService } from "../realtime/realtime.service";
import { InventoryRepository } from "./inventory.repository";
import { InventoryStockService } from "./inventory.stock.service";
import type {
  CreateStockAdjustmentInput,
  GetInventoryMedicineDetailQuery,
  ListExpiryReportQuery,
  ListInventorySummaryQuery,
  ListLowStockQuery,
  ListStockTransactionsQuery,
} from "./inventory.validation";

const buildAppError = (statusCode: number, code: string, message: string) =>
  new AppError({
    statusCode,
    code,
    message,
  });

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

const isLowStockState = (
  availableQuantity: number,
  reorderLevel: number,
  onHandQuantity: number,
) => availableQuantity <= reorderLevel && !(availableQuantity === 0 && onHandQuantity > 0);

export class InventoryService {
  constructor(
    private readonly inventoryRepository = new InventoryRepository(),
    private readonly inventoryStockService = new InventoryStockService(),
    private readonly alertsService = new AlertsService(),
    private readonly adminSettingsService = new AdminSettingsService(),
    private readonly branchesService = new BranchesService(),
  ) {}

  async listInventorySummary(
    shopId: string,
    branchId: string,
    query: ListInventorySummaryQuery,
  ) {
    await this.inventoryRepository.syncBatchStatuses(shopId, branchId);
    const settings = await this.branchesService.getResolvedBranchSettings(shopId, branchId);

    const [items, total] = await Promise.all([
      this.inventoryRepository.listInventorySummary(
        shopId,
        branchId,
        query,
        settings.defaultLowStockThreshold,
      ),
      this.inventoryRepository.countInventorySummary(
        shopId,
        branchId,
        query,
        settings.defaultLowStockThreshold,
      ),
    ]);

    return buildPaginatedResponse(
      items.map((record) => ({
        medicine: {
          id: record.medicine.id,
          medicineName: record.medicine.medicineName,
          genericName: record.medicine.genericName,
          barcode: record.medicine.barcode,
          form: record.medicine.form,
          unit: record.medicine.unit,
          reorderLevel: Number(record.effectiveReorderLevel ?? 0),
          status: record.medicine.status,
          updatedAt: record.medicine.updatedAt,
        },
        category: record.category,
        manufacturer: record.manufacturer,
        availableQuantity: Number(record.availableQuantity ?? 0),
        reorderLevel: Number(record.effectiveReorderLevel ?? 0),
        isLowStock: isLowStockState(
          Number(record.availableQuantity ?? 0),
          Number(record.effectiveReorderLevel ?? 0),
          Number(record.onHandQuantity ?? 0),
        ),
        activeBatchCount: Number(record.activeBatchCount ?? 0),
      })),
      total,
      query.page,
      query.pageSize,
    );
  }

  async getInventoryMedicineDetail(
    shopId: string,
    branchId: string,
    medicineId: string,
    query: GetInventoryMedicineDetailQuery,
  ) {
    await this.inventoryRepository.syncBatchStatuses(shopId, branchId);
    const settings = await this.branchesService.getResolvedBranchSettings(shopId, branchId);

    const record = await this.inventoryRepository.getInventoryMedicineDetail(
      shopId,
      branchId,
      medicineId,
      settings.defaultLowStockThreshold,
    );

    if (!record) {
      throw buildAppError(404, "MEDICINE_NOT_FOUND", "Medicine not found.");
    }

    const recentTransactions = query.includeTransactions
      ? await this.inventoryRepository.listStockTransactions(shopId, branchId, {
          page: 1,
          pageSize: 50,
          sortBy: "createdAt",
          sortOrder: "desc",
          medicineId,
        })
      : [];

    const onHandQuantity = record.batches.reduce(
      (sum, batch) => sum + Math.max(Number(batch.quantityAvailable ?? 0), 0),
      0,
    );

    return {
      medicine: {
        id: record.medicine.id,
        medicineName: record.medicine.medicineName,
        genericName: record.medicine.genericName,
        brandName: record.medicine.brandName,
        barcode: record.medicine.barcode,
        form: record.medicine.form,
        unit: record.medicine.unit,
        reorderLevel: Number(record.effectiveReorderLevel ?? 0),
        status: record.medicine.status,
      },
      category: record.category,
      manufacturer: record.manufacturer,
      availableQuantity: Number(record.availableQuantity ?? 0),
      activeBatchCount: Number(record.activeBatchCount ?? 0),
      isLowStock: isLowStockState(
        Number(record.availableQuantity ?? 0),
        Number(record.effectiveReorderLevel ?? 0),
        onHandQuantity,
      ),
      batches: record.batches.map((batch) => ({
        ...batch,
        isExpired: batch.expiryDate < new Date(),
      })),
      recentTransactions: recentTransactions.map((recordItem) => ({
        ...recordItem.transaction,
        medicine: recordItem.medicine,
        batch: recordItem.batch,
      })),
    };
  }

  async listStockTransactions(
    shopId: string,
    branchId: string,
    query: ListStockTransactionsQuery,
  ) {
    const [items, total] = await Promise.all([
      this.inventoryRepository.listStockTransactions(shopId, branchId, query),
      this.inventoryRepository.countStockTransactions(shopId, branchId, query),
    ]);

    return buildPaginatedResponse(
      items.map((record) => ({
        ...record.transaction,
        medicine: record.medicine,
        batch: record.batch,
      })),
      total,
      query.page,
      query.pageSize,
    );
  }

  async listLowStock(shopId: string, branchId: string, query: ListLowStockQuery) {
    return this.listInventorySummary(shopId, branchId, {
      ...query,
      lowStockOnly: true,
    });
  }

  async listExpiryReport(
    shopId: string,
    branchId: string,
    query: ListExpiryReportQuery,
  ) {
    await this.inventoryRepository.syncBatchStatuses(shopId, branchId);

    const [items, total] = await Promise.all([
      this.inventoryRepository.listExpiryReport(shopId, branchId, query),
      this.inventoryRepository.countExpiryReport(shopId, branchId, query),
    ]);

    return buildPaginatedResponse(
      items.map((record) => ({
        ...record.batch,
        medicine: record.medicine,
        expiryStatus:
          record.batch.expiryDate < new Date()
            ? "expired"
            : query.expiryWindow === "30"
              ? "next_30_days"
              : query.expiryWindow === "60"
                ? "next_60_days"
                : query.expiryWindow === "90"
                  ? "next_90_days"
                  : "safe",
      })),
      total,
      query.page,
      query.pageSize,
    );
  }

  async createStockAdjustment(
    shopId: string,
    branchId: string,
    userId: string,
    input: CreateStockAdjustmentInput,
  ) {
    const settings = await this.adminSettingsService.getResolvedShopSettings(shopId);

    if (!settings.allowInventoryAdjustment) {
      throw buildAppError(
        400,
        "INVENTORY_ADJUSTMENT_DISABLED",
        "Inventory adjustments are disabled in admin settings.",
      );
    }

    const adjustmentResult = await db.transaction((tx) =>
      this.inventoryStockService.applyManualAdjustment(
        {
          shopId,
          branchId,
          medicineId: input.medicineId,
          batchId: input.batchId,
          adjustmentType: input.adjustmentType,
          quantity: input.quantity,
          reason: input.reason,
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          createdByUserId: userId,
        },
        tx,
      ),
    );

    try {
      await this.alertsService.dispatchPendingInventoryAlertEmails(
        shopId,
        branchId,
      );
    } catch (error) {
      logger.error("Stock adjustment saved but inventory alert email dispatch failed", {
        shopId,
        branchId,
        medicineId: input.medicineId,
        batchId: input.batchId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    realtimeService.publish({
      type: "inventory_changed",
      shopId,
      branchId,
      reason: "stock_adjustment_created",
      metadata: {
        medicineId: input.medicineId,
        batchId: input.batchId,
      },
    });
    realtimeService.publish({
      type: "notification_changed",
      shopId,
      branchId,
      reason: "stock_adjustment_created",
      metadata: {
        medicineId: input.medicineId,
        batchId: input.batchId,
      },
    });

    return {
      adjustment: adjustmentResult.adjustment,
      batch: adjustmentResult.batch,
    };
  }
}
