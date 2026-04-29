import { db } from "../../db/client";
import { AppError } from "../../shared/errors/app-error";
import { logger } from "../../shared/logger";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { AlertsService } from "../alerts/alerts.service";
import type { PublicUser } from "../auth/auth.types";
import { BranchesService } from "../branches/branches.service";
import { realtimeService } from "../realtime/realtime.service";
import { StockTransfersRepository } from "./stock-transfers.repository";
import type {
  CreateStockTransferInput,
  ListSourceBatchesQuery,
  ListStockTransfersQuery,
} from "./stock-transfers.validation";

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (expiryDate < today) {
    return "expired" as const;
  }

  return "active" as const;
};

export class StockTransfersService {
  constructor(
    private readonly stockTransfersRepository = new StockTransfersRepository(),
    private readonly branchesService = new BranchesService(),
    private readonly auditLogsService = new AuditLogsService(),
    private readonly alertsService = new AlertsService(),
  ) {}

  async listTransfers(shopId: string, query: ListStockTransfersQuery) {
    const [items, total] = await Promise.all([
      this.stockTransfersRepository.listTransfers(shopId, query.page, query.pageSize),
      this.stockTransfersRepository.countTransfers(shopId),
    ]);
    const toBranchIds = [...new Set(items.map((row) => row.transfer.toBranchId))];
    const toBranchMap = new Map<
      string,
      Awaited<ReturnType<StockTransfersRepository["findBranchById"]>>
    >();

    await Promise.all(
      toBranchIds.map(async (branchId) => {
        const branch = await this.stockTransfersRepository.findBranchById(shopId, branchId);
        toBranchMap.set(branchId, branch);
      }),
    );

    return {
      items: items.map((row) => {
        const toBranch = toBranchMap.get(row.transfer.toBranchId);

        return {
          id: row.transfer.id,
          fromBranch: row.fromBranch,
          toBranch: {
            id: row.transfer.toBranchId,
            name: toBranch?.name ?? "Unknown branch",
            code: toBranch?.code ?? "N/A",
          },
          status: row.transfer.status,
          notes: row.transfer.notes,
          createdAt: row.transfer.createdAt,
          completedAt: row.transfer.completedAt,
          cancelledAt: row.transfer.cancelledAt,
          createdBy: row.createdBy,
        };
      }),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize) || 1,
      },
    };
  }

  async listAvailableSourceBatches(
    shopId: string,
    query: ListSourceBatchesQuery,
    actor: PublicUser,
  ) {
    const access = await this.branchesService.resolveRequestBranchContext({
      shopId,
      userId: actor.id,
      role: actor.role,
      requestedBranchId: query.branchId,
    });

    const rows = await this.stockTransfersRepository.listAvailableSourceBatches(
      shopId,
      access.currentBranch.id,
      query.search,
      query.pageSize,
    );

    return rows.map((row) => ({
      batch: row.batch,
      medicine: {
        id: row.medicine.id,
        medicineName: row.medicine.medicineName,
        genericName: row.medicine.genericName,
        form: row.medicine.form,
        unit: row.medicine.unit,
      },
    }));
  }

  async createTransfer(shopId: string, input: CreateStockTransferInput, actor: PublicUser) {
    const [fromBranch, toBranch] = await Promise.all([
      this.stockTransfersRepository.findBranchById(shopId, input.fromBranchId),
      this.stockTransfersRepository.findBranchById(shopId, input.toBranchId),
    ]);

    if (!fromBranch || !toBranch) {
      throw buildAppError(404, "BRANCH_NOT_FOUND", "Branch not found.");
    }

    if (fromBranch.id === toBranch.id) {
      throw buildAppError(
        400,
        "TRANSFER_BRANCH_CONFLICT",
        "Source and destination branches must be different.",
      );
    }

    const batches = await this.stockTransfersRepository.findBatchesByIds(
      shopId,
      fromBranch.id,
      [...new Set(input.items.map((item) => item.sourceBatchId))],
    );
    const batchMap = new Map(batches.map((batch) => [batch.id, batch]));

    for (const item of input.items) {
      const batch = batchMap.get(item.sourceBatchId);

      if (!batch || batch.medicineId !== item.medicineId) {
        throw buildAppError(
          400,
          "TRANSFER_BATCH_INVALID",
          "One or more transfer rows reference an invalid source batch.",
        );
      }

      if (batch.quantityAvailable < item.quantity) {
        throw buildAppError(
          400,
          "TRANSFER_STOCK_INSUFFICIENT",
          `Insufficient stock in batch ${batch.batchNumber}.`,
        );
      }
    }

    const transfer = await db.transaction(async (tx) => {
      const created = await this.stockTransfersRepository.createTransfer(
        {
          shopId,
          fromBranchId: fromBranch.id,
          toBranchId: toBranch.id,
          status: "draft",
          notes: input.notes,
          createdByUserId: actor.id,
        },
        input.items.map((item) => ({
          medicineId: item.medicineId,
          sourceBatchId: item.sourceBatchId,
          quantity: item.quantity,
        })),
        tx,
      );

      await this.auditLogsService.record(
        {
          actor,
          module: "inventory",
          action: "stock_transfer_created",
          entityType: "stock_transfer",
          entityId: created.id,
          severity: "important",
          title: "Stock transfer drafted",
          description: `Stock transfer from ${fromBranch.name} to ${toBranch.name} was drafted.`,
          metadata: {
            branchId: fromBranch.id,
            fromBranchId: fromBranch.id,
            toBranchId: toBranch.id,
          },
        },
        tx,
      );

      return created;
    });

    return transfer;
  }

  async completeTransfer(shopId: string, transferId: string, actor: PublicUser) {
    const syncTargets = new Map<string, Set<string>>();
    const completed = await db.transaction(async (tx) => {
      const transfer = await this.stockTransfersRepository.findTransferById(
        shopId,
        transferId,
        tx,
      );

      if (!transfer) {
        throw buildAppError(404, "TRANSFER_NOT_FOUND", "Stock transfer not found.");
      }

      if (transfer.status !== "draft") {
        throw buildAppError(
          400,
          "TRANSFER_NOT_COMPLETABLE",
          "Only draft transfers can be completed.",
        );
      }

      const items = await this.stockTransfersRepository.listTransferItemsByTransferId(
        transferId,
        tx,
      );
      const sourceBatches = await this.stockTransfersRepository.findBatchesByIds(
        shopId,
        transfer.fromBranchId,
        items.map((item) => item.sourceBatchId),
        tx,
      );
      const sourceBatchMap = new Map(sourceBatches.map((batch) => [batch.id, batch]));

      for (const item of items) {
        const sourceBatch = sourceBatchMap.get(item.sourceBatchId);

        if (!sourceBatch) {
          throw buildAppError(404, "BATCH_NOT_FOUND", "Source batch not found.");
        }

        const sourceNextQty = sourceBatch.quantityAvailable - item.quantity;

        if (sourceNextQty < 0) {
          throw buildAppError(
            400,
            "TRANSFER_STOCK_INSUFFICIENT",
            `Insufficient stock in batch ${sourceBatch.batchNumber}.`,
          );
        }

        const updatedSourceBatch =
          await this.stockTransfersRepository.changeBatchQuantity(
            shopId,
            transfer.fromBranchId,
            sourceBatch.id,
            -item.quantity,
            getBatchStatus(sourceBatch.expiryDate, sourceNextQty),
            tx,
          );

        if (!updatedSourceBatch) {
          throw buildAppError(
            409,
            "TRANSFER_SOURCE_CONFLICT",
            "Source stock changed while completing the transfer.",
          );
        }

        const destinationBatch =
          await this.stockTransfersRepository.upsertDestinationBatch(
            {
              shopId,
              branchId: transfer.toBranchId,
              medicineId: sourceBatch.medicineId,
              batchNumber: sourceBatch.batchNumber,
              batchNumberNormalized: sourceBatch.batchNumberNormalized,
              expiryDate: sourceBatch.expiryDate,
              purchaseRate: sourceBatch.purchaseRate,
              saleRate: sourceBatch.saleRate,
              mrp: sourceBatch.mrp,
              gstPercent: sourceBatch.gstPercent,
              quantityReceived: item.quantity,
              quantityAvailable: item.quantity,
              status: getBatchStatus(
                sourceBatch.expiryDate,
                item.quantity,
              ),
            },
            tx,
          );

        await this.stockTransfersRepository.updateTransferItemDestinationBatch(
          item.id,
          destinationBatch.id,
          tx,
        );

        await this.stockTransfersRepository.createStockTransaction(
          {
            shopId,
            branchId: transfer.fromBranchId,
            medicineId: sourceBatch.medicineId,
            batchId: sourceBatch.id,
            transactionType: "transfer_out",
            quantityIn: 0,
            quantityOut: item.quantity,
            balanceAfter: updatedSourceBatch.quantityAvailable,
            referenceType: "stock_transfer_item",
            referenceId: item.id,
            notes: `Transfer out to branch ${transfer.toBranchId}`,
            createdByUserId: actor.id,
          },
          tx,
        );

        await this.stockTransfersRepository.createStockTransaction(
          {
            shopId,
            branchId: transfer.toBranchId,
            medicineId: destinationBatch.medicineId,
            batchId: destinationBatch.id,
            transactionType: "transfer_in",
            quantityIn: item.quantity,
            quantityOut: 0,
            balanceAfter: destinationBatch.quantityAvailable,
            referenceType: "stock_transfer_item",
            referenceId: item.id,
            notes: `Transfer in from branch ${transfer.fromBranchId}`,
            createdByUserId: actor.id,
          },
          tx,
        );

        const branchSet =
          syncTargets.get(sourceBatch.medicineId) ?? new Set<string>();
        branchSet.add(transfer.fromBranchId);
        branchSet.add(transfer.toBranchId);
        syncTargets.set(sourceBatch.medicineId, branchSet);
      }

      const completedTransfer = await this.stockTransfersRepository.updateTransfer(
        transfer.id,
        {
          status: "completed",
          completedAt: new Date(),
        },
        tx,
      );

      await this.auditLogsService.record(
        {
          actor,
          module: "inventory",
          action: "stock_transfer_completed",
          entityType: "stock_transfer",
          entityId: transfer.id,
          severity: "critical",
          title: "Stock transfer completed",
          description: "A stock transfer was completed successfully.",
          metadata: {
            branchId: transfer.fromBranchId,
            fromBranchId: transfer.fromBranchId,
            toBranchId: transfer.toBranchId,
          },
        },
        tx,
      );

      return completedTransfer;
    });

    try {
      for (const [medicineId, branchIds] of syncTargets.entries()) {
        for (const branchId of branchIds) {
          await this.alertsService.syncMedicineAlerts(shopId, branchId, medicineId);
        }
      }

      const emailDispatchBranches = new Set<string>();

      for (const branchIds of syncTargets.values()) {
        for (const branchId of branchIds) {
          emailDispatchBranches.add(branchId);
        }
      }
 
      for (const branchId of emailDispatchBranches) {
        await this.alertsService.dispatchPendingInventoryAlertEmails(
          shopId,
          branchId,
        );
      }
    } catch (error) {
      logger.error("Stock transfer completed but alert sync failed", {
        transferId,
        shopId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    realtimeService.publish({
      type: "inventory_changed",
      shopId,
      reason: "stock_transfer_completed",
      metadata: {
        transferId,
      },
    });
    realtimeService.publish({
      type: "notification_changed",
      shopId,
      reason: "stock_transfer_completed",
      metadata: {
        transferId,
      },
    });

    return completed;
  }

  async cancelTransfer(shopId: string, transferId: string, actor: PublicUser) {
    const transfer = await this.stockTransfersRepository.findTransferById(shopId, transferId);

    if (!transfer) {
      throw buildAppError(404, "TRANSFER_NOT_FOUND", "Stock transfer not found.");
    }

    if (transfer.status !== "draft") {
      throw buildAppError(
        400,
        "TRANSFER_NOT_CANCELLABLE",
        "Only draft transfers can be cancelled.",
      );
    }

    return db.transaction(async (tx) => {
      const cancelled = await this.stockTransfersRepository.updateTransfer(
        transfer.id,
        {
          status: "cancelled",
          cancelledAt: new Date(),
        },
        tx,
      );

      await this.auditLogsService.record(
        {
          actor,
          module: "inventory",
          action: "stock_transfer_cancelled",
          entityType: "stock_transfer",
          entityId: transfer.id,
          severity: "important",
          title: "Stock transfer cancelled",
          description: "A draft stock transfer was cancelled.",
          metadata: {
            branchId: transfer.fromBranchId,
            fromBranchId: transfer.fromBranchId,
            toBranchId: transfer.toBranchId,
          },
        },
        tx,
      );

      return cancelled;
    });
  }
}
