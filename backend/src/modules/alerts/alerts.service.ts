import { InventoryRepository } from "../inventory/inventory.repository";
import { emailService } from "../notifications/email/email.service";
import { AlertsRepository } from "./alerts.repository";
import type { DbExecutor } from "../../shared/db/executor";
import { logger } from "../../shared/logger";

export interface LowStockAlertEvent {
  shopId: string;
  medicineId: string;
  medicineName: string;
  currentAvailableQuantity: number;
  reorderLevel: number;
}

export class AlertsService {
  constructor(
    private readonly alertsRepository = new AlertsRepository(),
    private readonly inventoryRepository = new InventoryRepository(),
  ) {}

  async evaluateLowStockTransition(
    shopId: string,
    medicineId: string,
    executor: DbExecutor,
  ): Promise<LowStockAlertEvent | null> {
    const snapshot = await this.inventoryRepository.getMedicineStockSnapshot(
      shopId,
      medicineId,
      executor,
    );

    if (!snapshot) {
      return null;
    }

    const currentAvailableQuantity = Number(snapshot.availableQuantity ?? 0);
    const reorderLevel = snapshot.medicine.reorderLevel;
    const isLowStock = currentAvailableQuantity <= reorderLevel;
    const now = new Date();

    const existingState = await this.alertsRepository.findLowStockAlertState(
      shopId,
      medicineId,
      executor,
    );

    const wasLowStock = existingState?.isLowStock ?? false;
    const enteredLowStockAt = isLowStock
      ? wasLowStock
        ? existingState?.enteredLowStockAt ?? now
        : now
      : null;
    const resolvedAt = isLowStock ? null : wasLowStock ? now : existingState?.resolvedAt ?? null;
    const lastAlertSentAt =
      isLowStock && !wasLowStock
        ? now
        : existingState?.lastAlertSentAt ?? null;

    await this.alertsRepository.upsertLowStockAlertState(
      {
        shopId,
        medicineId,
        isLowStock,
        currentAvailableQuantity,
        reorderLevel,
        enteredLowStockAt,
        resolvedAt,
        lastAlertSentAt,
      },
      executor,
    );

    if (!isLowStock || wasLowStock) {
      return null;
    }

    return {
      shopId,
      medicineId,
      medicineName: snapshot.medicine.medicineName,
      currentAvailableQuantity,
      reorderLevel,
    };
  }

  async dispatchLowStockAlert(event: LowStockAlertEvent) {
    const recipients = await this.alertsRepository.listAdminEmailRecipients(
      event.shopId,
    );

    if (!recipients.length) {
      logger.warn("Skipping low stock alert because no admin recipients were found", {
        shopId: event.shopId,
        medicineId: event.medicineId,
      });
      return;
    }

    const detail = await this.inventoryRepository.getInventoryMedicineDetail(
      event.shopId,
      event.medicineId,
    );

    const batchSummary =
      detail?.batches
        .filter((batch) => Number(batch.quantityAvailable) > 0)
        .slice(0, 3)
        .map(
          (batch) =>
            `${batch.batchNumber} | qty ${batch.quantityAvailable} | exp ${batch.expiryDate.toISOString().slice(0, 10)}`,
        ) ?? [];

    await Promise.all(
      recipients.map(async ({ shop, user }) => {
        try {
          await emailService.sendLowStockAlert({
            to: user.email,
            recipientName: user.fullName,
            shopName: shop.name,
            medicineName: event.medicineName,
            currentAvailableQuantity: event.currentAvailableQuantity,
            reorderLevel: event.reorderLevel,
            batchSummary,
          });
        } catch (error) {
          logger.error("Failed to send low stock alert email", {
            shopId: event.shopId,
            medicineId: event.medicineId,
            recipientUserId: user.id,
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }),
    );
  }
}
