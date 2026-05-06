import { env } from "../../config/env";
import { logger } from "../../shared/logger";
import { BranchesRepository } from "../branches/branches.repository";
import { InventoryRepository } from "../inventory/inventory.repository";
import { realtimeService } from "../realtime/realtime.service";
import { AlertsService } from "./alerts.service";

export class AlertsScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private hasLoggedBranchSchemaSkip = false;

  constructor(
    private readonly branchesRepository = new BranchesRepository(),
    private readonly inventoryRepository = new InventoryRepository(),
    private readonly alertsService = new AlertsService(),
  ) {}

  start() {
    if (!env.ALERT_SYNC_ENABLED || this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runCycle();
    }, env.ALERT_SYNC_INTERVAL_MS);

    void this.runCycle();
    logger.info("Alerts scheduler started", {
      intervalMs: env.ALERT_SYNC_INTERVAL_MS,
    });
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runCycle() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const isBranchingSchemaReady =
        await this.branchesRepository.isBranchingSchemaReady();

      if (!isBranchingSchemaReady) {
        if (!this.hasLoggedBranchSchemaSkip) {
          logger.warn("Alerts scheduler skipped because branching schema is not ready");
          this.hasLoggedBranchSchemaSkip = true;
        }
        return;
      }

      this.hasLoggedBranchSchemaSkip = false;

      const activeBranches = await this.branchesRepository.listActiveBranches();
      const touchedShopIds = new Set<string>();

      for (const branch of activeBranches) {
        await this.inventoryRepository.syncBatchStatuses(branch.shopId, branch.id);
        await this.alertsService.syncShopAlerts(branch.shopId, branch.id);
        touchedShopIds.add(branch.shopId);
        realtimeService.publish({
          type: "inventory_changed",
          shopId: branch.shopId,
          branchId: branch.id,
          reason: "alerts_scheduler_sync",
          metadata: {
            branchId: branch.id,
          },
        });
        realtimeService.publish({
          type: "notification_changed",
          shopId: branch.shopId,
          branchId: branch.id,
          reason: "alerts_scheduler_sync",
          metadata: {
            branchId: branch.id,
          },
        });
      }

      await Promise.all(
        [...touchedShopIds].map((shopId) =>
          this.alertsService.dispatchPendingInventoryAlertEmails(shopId),
        ),
      );
    } catch (error) {
      logger.error("Alerts scheduler cycle failed", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      this.isRunning = false;
    }
  }
}
