import { db } from "../../db/client";
import { AppError } from "../../shared/errors/app-error";
import { AlertsService } from "../alerts/alerts.service";
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

export class InventoryService {
  constructor(
    private readonly inventoryRepository = new InventoryRepository(),
    private readonly inventoryStockService = new InventoryStockService(),
    private readonly alertsService = new AlertsService(),
  ) {}

  async listInventorySummary(shopId: string, query: ListInventorySummaryQuery) {
    await this.inventoryRepository.syncBatchStatuses(shopId);

    const [items, total] = await Promise.all([
      this.inventoryRepository.listInventorySummary(shopId, query),
      this.inventoryRepository.countInventorySummary(shopId, query),
    ]);

    return buildPaginatedResponse(
      items.map((record) => ({
        medicine: {
          id: record.medicine.id,
          medicineName: record.medicine.medicineName,
          genericName: record.medicine.genericName,
          form: record.medicine.form,
          unit: record.medicine.unit,
          reorderLevel: record.medicine.reorderLevel,
          status: record.medicine.status,
          updatedAt: record.medicine.updatedAt,
        },
        category: record.category,
        manufacturer: record.manufacturer,
        availableQuantity: Number(record.availableQuantity ?? 0),
        reorderLevel: record.medicine.reorderLevel,
        isLowStock:
          Number(record.availableQuantity ?? 0) <= record.medicine.reorderLevel,
        activeBatchCount: Number(record.activeBatchCount ?? 0),
      })),
      total,
      query.page,
      query.pageSize,
    );
  }

  async getInventoryMedicineDetail(
    shopId: string,
    medicineId: string,
    query: GetInventoryMedicineDetailQuery,
  ) {
    await this.inventoryRepository.syncBatchStatuses(shopId);

    const record = await this.inventoryRepository.getInventoryMedicineDetail(
      shopId,
      medicineId,
    );

    if (!record) {
      throw buildAppError(404, "MEDICINE_NOT_FOUND", "Medicine not found.");
    }

    const recentTransactions = query.includeTransactions
      ? await this.inventoryRepository.listStockTransactions(shopId, {
          page: 1,
          pageSize: 50,
          sortBy: "createdAt",
          sortOrder: "desc",
          medicineId,
        })
      : [];

    return {
      medicine: {
        id: record.medicine.id,
        medicineName: record.medicine.medicineName,
        genericName: record.medicine.genericName,
        brandName: record.medicine.brandName,
        form: record.medicine.form,
        unit: record.medicine.unit,
        reorderLevel: record.medicine.reorderLevel,
        status: record.medicine.status,
      },
      category: record.category,
      manufacturer: record.manufacturer,
      availableQuantity: Number(record.availableQuantity ?? 0),
      activeBatchCount: Number(record.activeBatchCount ?? 0),
      isLowStock:
        Number(record.availableQuantity ?? 0) <= record.medicine.reorderLevel,
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

  async listStockTransactions(shopId: string, query: ListStockTransactionsQuery) {
    const [items, total] = await Promise.all([
      this.inventoryRepository.listStockTransactions(shopId, query),
      this.inventoryRepository.countStockTransactions(shopId, query),
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

  async listLowStock(shopId: string, query: ListLowStockQuery) {
    return this.listInventorySummary(shopId, {
      ...query,
      lowStockOnly: true,
    });
  }

  async listExpiryReport(shopId: string, query: ListExpiryReportQuery) {
    await this.inventoryRepository.syncBatchStatuses(shopId);

    const [items, total] = await Promise.all([
      this.inventoryRepository.listExpiryReport(shopId, query),
      this.inventoryRepository.countExpiryReport(shopId, query),
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
    userId: string,
    input: CreateStockAdjustmentInput,
  ) {
    const adjustmentResult = await db.transaction((tx) =>
      this.inventoryStockService.applyManualAdjustment(
        {
          shopId,
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

    if (adjustmentResult.lowStockEvent) {
      await this.alertsService.dispatchLowStockAlert(
        adjustmentResult.lowStockEvent,
      );
    }

    return {
      adjustment: adjustmentResult.adjustment,
      batch: adjustmentResult.batch,
    };
  }
}
