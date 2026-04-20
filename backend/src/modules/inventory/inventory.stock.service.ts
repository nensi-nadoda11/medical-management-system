import { AppError } from "../../shared/errors/app-error";
import { InventoryRepository } from "./inventory.repository";
import { AlertsService } from "../alerts/alerts.service";
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

const resolveBranchId = (batchBranchId: string | null, fallbackBranchId?: string) =>
  batchBranchId ?? fallbackBranchId;

export class InventoryStockService {
  constructor(
    private readonly inventoryRepository = new InventoryRepository(),
    private readonly alertsService = new AlertsService(),
  ) {}

  async postPurchaseStock(
    input: {
      shopId: string;
      branchId?: string;
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
    if (!input.branchId) {
      throw buildAppError(
        500,
        "BRANCH_CONTEXT_MISSING",
        "Branch context is required to post purchase stock.",
      );
    }

    const branchId = input.branchId;
    const touchedMedicineIds = new Set<string>();
    const postedBatches: Array<{ purchaseItemId: string; batchId: string }> = [];

    for (const item of input.items) {
      const totalQuantity = item.quantity + item.freeQuantity;
      const batch = await this.inventoryRepository.upsertPurchaseBatch(
        {
          shopId: input.shopId,
          branchId,
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
          branchId,
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
      await this.alertsService.syncMedicineAlerts(
        input.shopId,
        branchId,
        medicineId,
        executor,
      );
    }

    return {
      lowStockEvents: [],
      postedBatches,
    };
  }

  async applyManualAdjustment(
    input: {
      shopId: string;
      branchId?: string;
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
      input.branchId,
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

    const batchBranchId = resolveBranchId(batch.branchId, input.branchId);

    if (!batchBranchId) {
      throw buildAppError(500, "BRANCH_CONTEXT_MISSING", "Batch branch is missing.");
    }

    const updatedBatch = await this.inventoryRepository.changeBatchQuantity(
      {
        batchId: input.batchId,
        shopId: input.shopId,
        branchId: batchBranchId,
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
        branchId: batchBranchId,
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
        branchId: batchBranchId,
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

    await this.alertsService.syncMedicineAlerts(
      input.shopId,
      batchBranchId,
      input.medicineId,
      executor,
    );

    return {
      adjustment,
      batch: updatedBatch,
      lowStockEvent: null,
    };
  }

  async depleteSaleStock(
    input: {
      shopId: string;
      branchId?: string;
      saleId: string;
      createdByUserId: string;
      items: Array<{
        id: string;
        medicineId: string;
        batchId: string;
        quantity: number;
      }>;
    },
    executor: DbExecutor,
  ) {
    const touchedMedicineIds = new Set<string>();
    const touchedMedicineBranchIds = new Map<string, string>();

    for (const item of input.items) {
      const batch = await this.inventoryRepository.findBatchById(
        input.shopId,
        input.branchId,
        item.batchId,
        executor,
      );

      if (!batch || batch.medicineId !== item.medicineId) {
        throw buildAppError(404, "BATCH_NOT_FOUND", "Batch not found.");
      }

      if (batch.expiryDate < new Date()) {
        throw buildAppError(
          400,
          "BATCH_EXPIRED",
          `Batch ${batch.batchNumber} is expired and cannot be sold.`,
        );
      }

      const nextAvailableQuantity = batch.quantityAvailable - item.quantity;
      const batchBranchId = resolveBranchId(batch.branchId, input.branchId);

      if (!batchBranchId) {
        throw buildAppError(500, "BRANCH_CONTEXT_MISSING", "Batch branch is missing.");
      }

      if (nextAvailableQuantity < 0) {
        throw buildAppError(
          400,
          "INSUFFICIENT_BATCH_STOCK",
          `Insufficient stock for batch ${batch.batchNumber}.`,
        );
      }

      const updatedBatch = await this.inventoryRepository.changeBatchQuantity(
        {
          batchId: item.batchId,
          shopId: input.shopId,
          branchId: batchBranchId,
          quantityDelta: -item.quantity,
          nextStatus: getBatchStatus(batch.expiryDate, nextAvailableQuantity),
        },
        executor,
      );

      if (!updatedBatch) {
        throw buildAppError(
          409,
          "SALE_STOCK_CONFLICT",
          "Stock changed while completing the bill. Please retry.",
        );
      }

      await this.inventoryRepository.createStockTransaction(
        {
          shopId: input.shopId,
          branchId: batchBranchId,
          medicineId: item.medicineId,
          batchId: item.batchId,
          transactionType: "sale_out",
          quantityIn: 0,
          quantityOut: item.quantity,
          balanceAfter: updatedBatch.quantityAvailable,
          referenceType: "sale_item",
          referenceId: item.id,
          notes: `Stock deducted for sale ${input.saleId}`,
          createdByUserId: input.createdByUserId,
        },
        executor,
      );

      touchedMedicineIds.add(item.medicineId);
      touchedMedicineBranchIds.set(item.medicineId, batchBranchId);
    }

    for (const medicineId of touchedMedicineIds) {
      const alertBranchId = input.branchId ?? touchedMedicineBranchIds.get(medicineId);

      if (!alertBranchId) {
        throw buildAppError(500, "BRANCH_CONTEXT_MISSING", "Alert branch is missing.");
      }

      await this.alertsService.syncMedicineAlerts(
        input.shopId,
        alertBranchId,
        medicineId,
        executor,
      );
    }

    return {
      lowStockEvents: [],
    };
  }

  async depletePurchaseReturnStock(
    input: {
      shopId: string;
      branchId?: string;
      purchaseReturnId: string;
      createdByUserId: string;
      items: Array<{
        id: string;
        medicineId: string;
        batchId: string;
        quantity: number;
      }>;
    },
    executor: DbExecutor,
  ) {
    const touchedMedicineIds = new Set<string>();
    const touchedMedicineBranchIds = new Map<string, string>();

    for (const item of input.items) {
      const batch = await this.inventoryRepository.findBatchById(
        input.shopId,
        input.branchId,
        item.batchId,
        executor,
      );

      if (!batch || batch.medicineId !== item.medicineId) {
        throw buildAppError(404, "BATCH_NOT_FOUND", "Batch not found.");
      }

      const nextAvailableQuantity = batch.quantityAvailable - item.quantity;
      const batchBranchId = resolveBranchId(batch.branchId, input.branchId);

      if (!batchBranchId) {
        throw buildAppError(500, "BRANCH_CONTEXT_MISSING", "Batch branch is missing.");
      }

      if (nextAvailableQuantity < 0) {
        throw buildAppError(
          400,
          "INSUFFICIENT_BATCH_STOCK",
          `Insufficient stock for batch ${batch.batchNumber}.`,
        );
      }

      const updatedBatch = await this.inventoryRepository.changeBatchQuantity(
        {
          batchId: item.batchId,
          shopId: input.shopId,
          branchId: batchBranchId,
          quantityDelta: -item.quantity,
          nextStatus: getBatchStatus(batch.expiryDate, nextAvailableQuantity),
        },
        executor,
      );

      if (!updatedBatch) {
        throw buildAppError(
          409,
          "PURCHASE_RETURN_STOCK_CONFLICT",
          "Stock changed while completing the purchase return. Please retry.",
        );
      }

      await this.inventoryRepository.createStockTransaction(
        {
          shopId: input.shopId,
          branchId: batchBranchId,
          medicineId: item.medicineId,
          batchId: item.batchId,
          transactionType: "purchase_return_out",
          quantityIn: 0,
          quantityOut: item.quantity,
          balanceAfter: updatedBatch.quantityAvailable,
          referenceType: "purchase_return_item",
          referenceId: item.id,
          notes: `Stock deducted for purchase return ${input.purchaseReturnId}`,
          createdByUserId: input.createdByUserId,
        },
        executor,
      );

      touchedMedicineIds.add(item.medicineId);
      touchedMedicineBranchIds.set(item.medicineId, batchBranchId);
    }

    for (const medicineId of touchedMedicineIds) {
      const alertBranchId = input.branchId ?? touchedMedicineBranchIds.get(medicineId);

      if (!alertBranchId) {
        throw buildAppError(500, "BRANCH_CONTEXT_MISSING", "Alert branch is missing.");
      }

      await this.alertsService.syncMedicineAlerts(
        input.shopId,
        alertBranchId,
        medicineId,
        executor,
      );
    }

    return {
      lowStockEvents: [],
    };
  }

  async restoreSaleReturnStock(
    input: {
      shopId: string;
      branchId?: string;
      saleReturnId: string;
      createdByUserId: string;
      items: Array<{
        id: string;
        medicineId: string;
        batchId: string;
        quantity: number;
      }>;
    },
    executor: DbExecutor,
  ) {
    const touchedMedicineIds = new Set<string>();
    const touchedMedicineBranchIds = new Map<string, string>();

    for (const item of input.items) {
      const batch = await this.inventoryRepository.findBatchById(
        input.shopId,
        input.branchId,
        item.batchId,
        executor,
      );

      if (!batch || batch.medicineId !== item.medicineId) {
        throw buildAppError(404, "BATCH_NOT_FOUND", "Batch not found.");
      }

      const nextAvailableQuantity = batch.quantityAvailable + item.quantity;
      const batchBranchId = resolveBranchId(batch.branchId, input.branchId);

      if (!batchBranchId) {
        throw buildAppError(500, "BRANCH_CONTEXT_MISSING", "Batch branch is missing.");
      }

      const updatedBatch = await this.inventoryRepository.changeBatchQuantity(
        {
          batchId: item.batchId,
          shopId: input.shopId,
          branchId: batchBranchId,
          quantityDelta: item.quantity,
          nextStatus: getBatchStatus(batch.expiryDate, nextAvailableQuantity),
        },
        executor,
      );

      if (!updatedBatch) {
        throw buildAppError(
          409,
          "SALE_RETURN_STOCK_CONFLICT",
          "Stock changed while completing the return. Please retry.",
        );
      }

      await this.inventoryRepository.createStockTransaction(
        {
          shopId: input.shopId,
          branchId: batchBranchId,
          medicineId: item.medicineId,
          batchId: item.batchId,
          transactionType: "sales_return_in",
          quantityIn: item.quantity,
          quantityOut: 0,
          balanceAfter: updatedBatch.quantityAvailable,
          referenceType: "sale_return_item",
          referenceId: item.id,
          notes: `Stock restored for sales return ${input.saleReturnId}`,
          createdByUserId: input.createdByUserId,
        },
        executor,
      );

      touchedMedicineIds.add(item.medicineId);
      touchedMedicineBranchIds.set(item.medicineId, batchBranchId);
    }

    for (const medicineId of touchedMedicineIds) {
      const alertBranchId = input.branchId ?? touchedMedicineBranchIds.get(medicineId);

      if (!alertBranchId) {
        throw buildAppError(500, "BRANCH_CONTEXT_MISSING", "Alert branch is missing.");
      }

      await this.alertsService.syncMedicineAlerts(
        input.shopId,
        alertBranchId,
        medicineId,
        executor,
      );
    }

    return {
      lowStockEvents: [],
    };
  }
}
