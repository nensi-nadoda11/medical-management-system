import { AppError } from "../../shared/errors/app-error";
import { InventoryRepository } from "./inventory.repository";
import { AlertsService, type LowStockAlertEvent } from "../alerts/alerts.service";
import type { DbExecutor } from "../../shared/db/executor";

const buildAppError = (statusCode: number, code: string, message: string) =>
  new AppError({
    statusCode,
    code,
    message,
  });

const getBatchStatus = (expiryDate: Date, quantityAvailable: number) => {
  if (quantityAvailable <= 0) {
    return "exhausted" as const;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  if (expiryDate < todayStart) {
    return "expired" as const;
  }

  return "active" as const;
};

export class InventoryStockService {
  constructor(
    private readonly inventoryRepository = new InventoryRepository(),
    private readonly alertsService = new AlertsService(),
  ) {}

  async postPurchaseStock(
    input: {
      shopId: string;
      purchaseId: string;
      createdByUserId: string;
      items: Array<{
        id: string;
        medicineId: string;
        batchNumber: string;
        batchNumberNormalized: string;
        expiryDate: Date;
        quantity: number;
        freeQuantity: number;
        purchaseRate: string;
        saleRate: string;
        mrp: string;
        gstPercent: number;
      }>;
    },
    executor: DbExecutor,
  ) {
    const lowStockEvents: LowStockAlertEvent[] = [];
    const touchedMedicineIds = new Set<string>();
    const postedBatches: Array<{ purchaseItemId: string; batchId: string }> = [];

    for (const item of input.items) {
      const totalQuantity = item.quantity + item.freeQuantity;
      const batch = await this.inventoryRepository.upsertPurchaseBatch(
        {
          shopId: input.shopId,
          medicineId: item.medicineId,
          batchNumber: item.batchNumber,
          batchNumberNormalized: item.batchNumberNormalized,
          expiryDate: item.expiryDate,
          purchaseRate: item.purchaseRate,
          saleRate: item.saleRate,
          mrp: item.mrp,
          gstPercent: item.gstPercent,
          quantityReceived: totalQuantity,
          quantityAvailable: totalQuantity,
          status: getBatchStatus(item.expiryDate, totalQuantity),
        },
        executor,
      );

      await this.inventoryRepository.createStockTransaction(
        {
          shopId: input.shopId,
          medicineId: item.medicineId,
          batchId: batch.id,
          transactionType: "purchase_in",
          quantityIn: totalQuantity,
          quantityOut: 0,
          balanceAfter: batch.quantityAvailable,
          referenceType: "purchase_item",
          referenceId: item.id,
          notes: `Stock posted from purchase ${input.purchaseId}`,
          createdByUserId: input.createdByUserId,
        },
        executor,
      );

      postedBatches.push({
        purchaseItemId: item.id,
        batchId: batch.id,
      });
      touchedMedicineIds.add(item.medicineId);
    }

    for (const medicineId of touchedMedicineIds) {
      const event = await this.alertsService.evaluateLowStockTransition(
        input.shopId,
        medicineId,
        executor,
      );

      if (event) {
        lowStockEvents.push(event);
      }
    }

    return {
      lowStockEvents,
      postedBatches,
    };
  }

  async applyManualAdjustment(
    input: {
      shopId: string;
      medicineId: string;
      batchId: string;
      adjustmentType: "in" | "out";
      quantity: number;
      reason: string;
      notes?: string;
      createdByUserId: string;
    },
    executor: DbExecutor,
  ) {
    const batch = await this.inventoryRepository.findBatchById(
      input.shopId,
      input.batchId,
      executor,
    );

    if (!batch || batch.medicineId !== input.medicineId) {
      throw buildAppError(404, "BATCH_NOT_FOUND", "Batch not found.");
    }

    const quantityDelta =
      input.adjustmentType === "in" ? input.quantity : -input.quantity;
    const nextAvailableQuantity = batch.quantityAvailable + quantityDelta;

    if (nextAvailableQuantity < 0) {
      throw buildAppError(
        400,
        "INSUFFICIENT_BATCH_STOCK",
        "Adjustment quantity exceeds available stock.",
      );
    }

    const updatedBatch = await this.inventoryRepository.changeBatchQuantity(
      {
        batchId: input.batchId,
        shopId: input.shopId,
        quantityDelta,
        nextStatus: getBatchStatus(batch.expiryDate, nextAvailableQuantity),
      },
      executor,
    );

    if (!updatedBatch) {
      throw buildAppError(
        409,
        "STOCK_ADJUSTMENT_CONFLICT",
        "Stock changed while applying the adjustment. Please retry.",
      );
    }

    const adjustment = await this.inventoryRepository.createStockAdjustment(
      {
        shopId: input.shopId,
        medicineId: input.medicineId,
        batchId: input.batchId,
        adjustmentType: input.adjustmentType,
        quantity: input.quantity,
        reason: input.reason,
        notes: input.notes,
        createdByUserId: input.createdByUserId,
      },
      executor,
    );

    if (!adjustment) {
      throw new Error("Failed to create stock adjustment.");
    }

    await this.inventoryRepository.createStockTransaction(
      {
        shopId: input.shopId,
        medicineId: input.medicineId,
        batchId: input.batchId,
        transactionType:
          input.adjustmentType === "in" ? "adjustment_in" : "adjustment_out",
        quantityIn: input.adjustmentType === "in" ? input.quantity : 0,
        quantityOut: input.adjustmentType === "out" ? input.quantity : 0,
        balanceAfter: updatedBatch.quantityAvailable,
        referenceType: "stock_adjustment",
        referenceId: adjustment.id,
        notes: input.notes ?? input.reason,
        createdByUserId: input.createdByUserId,
      },
      executor,
    );

    const lowStockEvent = await this.alertsService.evaluateLowStockTransition(
      input.shopId,
      input.medicineId,
      executor,
    );

    return {
      adjustment,
      batch: updatedBatch,
      lowStockEvent,
    };
  }
}
