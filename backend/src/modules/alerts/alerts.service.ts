import { db } from "../../db/client";
import type { Notification } from "../../db/schema";
import type { DbExecutor } from "../../shared/db/executor";
import { logger } from "../../shared/logger";
import { AccountingRepository } from "../accounting/accounting.repository";
import { AdminSettingsService } from "../admin-settings/admin-settings.service";
import { InventoryRepository } from "../inventory/inventory.repository";
import { NotificationsRepository } from "../notifications/notifications.repository";
import { emailService } from "../notifications/email/email.service";
import { AlertsRepository } from "./alerts.repository";

const STOCK_NOTIFICATION_TYPES = [
  "low_stock",
  "near_expiry",
  "expired_stock",
] as const;
const FINANCIAL_NOTIFICATION_TYPES = [
  "customer_due",
  "supplier_payable",
] as const;

type DeliveryChannel = "in_app" | "email" | "whatsapp";

export interface LowStockAlertEvent {
  shopId: string;
  medicineId: string;
}

const toDateString = (value: Date) => value.toISOString().slice(0, 10);

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getMetadataString = (
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) => {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
};

const getMetadataNumber = (
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) => {
  const value = metadata?.[key];
  return typeof value === "number" ? value : undefined;
};

const getFinancialSeverity = (amount: number) => {
  if (amount >= 10000) {
    return "critical" as const;
  }

  if (amount >= 1000) {
    return "warning" as const;
  }

  return "info" as const;
};

export class AlertsService {
  constructor(
    private readonly alertsRepository = new AlertsRepository(),
    private readonly notificationsRepository = new NotificationsRepository(),
    private readonly inventoryRepository = new InventoryRepository(),
    private readonly accountingRepository = new AccountingRepository(),
    private readonly adminSettingsService = new AdminSettingsService(),
  ) {}

  async syncMedicineAlerts(
    shopId: string,
    medicineId: string,
    executor?: DbExecutor,
  ) {
    const settings = await this.adminSettingsService.getResolvedShopSettings(
      shopId,
      executor,
    );
    const detail = await this.inventoryRepository.getInventoryMedicineDetail(
      shopId,
      medicineId,
      executor,
    );

    if (!detail) {
      return;
    }

    const currentAvailableQuantity = Number(detail.availableQuantity ?? 0);
    const reorderLevel =
      detail.medicine.reorderLevel > 0
        ? detail.medicine.reorderLevel
        : settings.defaultLowStockThreshold;
    const isLowStock = currentAvailableQuantity <= reorderLevel;
    const now = new Date();
    const existingState = await this.alertsRepository.findLowStockAlertState(
      shopId,
      medicineId,
      executor,
    );
    const wasLowStock = existingState?.isLowStock ?? false;

    await this.alertsRepository.upsertLowStockAlertState(
      {
        shopId,
        medicineId,
        isLowStock,
        currentAvailableQuantity,
        reorderLevel,
        enteredLowStockAt: isLowStock
          ? wasLowStock
            ? existingState?.enteredLowStockAt ?? now
            : now
          : null,
        resolvedAt: isLowStock ? null : wasLowStock ? now : existingState?.resolvedAt ?? null,
        lastAlertSentAt:
          isLowStock && !wasLowStock ? now : existingState?.lastAlertSentAt ?? null,
      },
      executor ?? db,
    );

    if (settings.lowStockAlertsEnabled && isLowStock) {
      await this.ensureActiveNotification(
        {
          shopId,
          conditionKey: `low_stock:${medicineId}`,
          type: "low_stock",
          severity: currentAvailableQuantity === 0 ? "critical" : "warning",
          entityType: "medicine",
          entityId: medicineId,
          title: `${detail.medicine.medicineName} is running low`,
          message: `Available stock is ${currentAvailableQuantity} against reorder level ${reorderLevel}.`,
          deliveryChannels: settings.lowStockEmailAlertsEnabled
            ? ["in_app", "email"]
            : ["in_app"],
          emailRequested: settings.lowStockEmailAlertsEnabled,
          metadata: {
            medicineId,
            medicineName: detail.medicine.medicineName,
            availableQuantity: currentAvailableQuantity,
            reorderLevel,
            actionPath: "/app/reports/low-stock",
            actionLabel: "Open low stock report",
          },
        },
        executor,
      );
    } else {
      await this.resolveCondition(shopId, `low_stock:${medicineId}`, executor);
    }

    const todayStart = startOfToday();
    const nearExpiryLimit = new Date(todayStart);
    nearExpiryLimit.setDate(nearExpiryLimit.getDate() + settings.nearExpiryAlertDays);

    for (const batch of detail.batches) {
      const nearExpiryKey = `near_expiry:${batch.id}`;
      const expiredKey = `expired_stock:${batch.id}`;
      const quantityAvailable = Number(batch.quantityAvailable ?? 0);
      const isExpired = batch.expiryDate < todayStart;
      const isNearExpiry =
        !isExpired && batch.expiryDate >= todayStart && batch.expiryDate <= nearExpiryLimit;

      if (!settings.expiryAlertsEnabled || quantityAvailable <= 0) {
        await this.resolveCondition(shopId, nearExpiryKey, executor);
        await this.resolveCondition(shopId, expiredKey, executor);
        continue;
      }

      if (isExpired) {
        await this.resolveCondition(shopId, nearExpiryKey, executor);
        await this.ensureActiveNotification(
          {
            shopId,
            conditionKey: expiredKey,
            type: "expired_stock",
            severity: "critical",
            entityType: "medicine_batch",
            entityId: batch.id,
            title: `${detail.medicine.medicineName} batch ${batch.batchNumber} has expired`,
            message: `Batch ${batch.batchNumber} expired on ${toDateString(batch.expiryDate)} with ${quantityAvailable} units still available.`,
            deliveryChannels: settings.expiryEmailAlertsEnabled
              ? ["in_app", "email"]
              : ["in_app"],
            emailRequested: settings.expiryEmailAlertsEnabled,
            metadata: {
              medicineId,
              medicineName: detail.medicine.medicineName,
              batchId: batch.id,
              batchNumber: batch.batchNumber,
              expiryDate: batch.expiryDate.toISOString(),
              quantityAvailable,
              actionPath: "/app/reports/expiry",
              actionLabel: "Open expiry report",
            },
          },
          executor,
        );
        continue;
      }

      if (isNearExpiry) {
        await this.resolveCondition(shopId, expiredKey, executor);
        await this.ensureActiveNotification(
          {
            shopId,
            conditionKey: nearExpiryKey,
            type: "near_expiry",
            severity: "warning",
            entityType: "medicine_batch",
            entityId: batch.id,
            title: `${detail.medicine.medicineName} batch ${batch.batchNumber} is nearing expiry`,
            message: `Batch ${batch.batchNumber} expires on ${toDateString(batch.expiryDate)} with ${quantityAvailable} units available.`,
            deliveryChannels: settings.expiryEmailAlertsEnabled
              ? ["in_app", "email"]
              : ["in_app"],
            emailRequested: settings.expiryEmailAlertsEnabled,
            metadata: {
              medicineId,
              medicineName: detail.medicine.medicineName,
              batchId: batch.id,
              batchNumber: batch.batchNumber,
              expiryDate: batch.expiryDate.toISOString(),
              quantityAvailable,
              actionPath: "/app/reports/expiry",
              actionLabel: "Open expiry report",
            },
          },
          executor,
        );
        continue;
      }

      await this.resolveCondition(shopId, nearExpiryKey, executor);
      await this.resolveCondition(shopId, expiredKey, executor);
    }
  }

  async syncCustomerDueNotification(shopId: string, customerId: string) {
    const summary = await this.accountingRepository.getCustomerFinancialSummary(
      shopId,
      customerId,
    );
    const conditionKey = `customer_due:${customerId}`;

    if (!summary) {
      await this.resolveCondition(shopId, conditionKey);
      return;
    }

    const outstandingAmount = Number(summary.summary.outstandingAmount ?? 0);
    const openBillCount = Number(summary.summary.openBillCount ?? 0);

    if (outstandingAmount <= 0 || openBillCount <= 0) {
      await this.resolveCondition(shopId, conditionKey);
      return;
    }

    await this.ensureActiveNotification({
      shopId,
      conditionKey,
      type: "customer_due",
      severity: getFinancialSeverity(outstandingAmount),
      entityType: "customer",
      entityId: customerId,
      title: `${summary.customer.fullName} has outstanding dues`,
      message: `${summary.customer.fullName} has ${openBillCount} open bill(s) with Rs ${summary.summary.outstandingAmount} pending.`,
      deliveryChannels: ["in_app"],
      emailRequested: false,
      metadata: {
        customerId,
        customerCode: summary.customer.customerCode,
        customerName: summary.customer.fullName,
        outstandingAmount,
        openBillCount,
        actionPath: `/app/accounting/customers/${customerId}`,
        actionLabel: "Open customer ledger",
      },
    });
  }

  async syncSupplierPayableNotification(shopId: string, supplierId: string) {
    const summary = await this.accountingRepository.getSupplierFinancialSummary(
      shopId,
      supplierId,
    );
    const conditionKey = `supplier_payable:${supplierId}`;

    if (!summary) {
      await this.resolveCondition(shopId, conditionKey);
      return;
    }

    const outstandingAmount = Number(summary.summary.outstandingAmount ?? 0);
    const openPurchaseCount = Number(summary.summary.openPurchaseCount ?? 0);

    if (outstandingAmount <= 0 || openPurchaseCount <= 0) {
      await this.resolveCondition(shopId, conditionKey);
      return;
    }

    await this.ensureActiveNotification({
      shopId,
      conditionKey,
      type: "supplier_payable",
      severity: getFinancialSeverity(outstandingAmount),
      entityType: "supplier",
      entityId: supplierId,
      title: `${summary.supplier.supplierName} has pending payables`,
      message: `${summary.supplier.supplierName} has ${openPurchaseCount} open purchase(s) with Rs ${summary.summary.outstandingAmount} pending.`,
      deliveryChannels: ["in_app"],
      emailRequested: false,
      metadata: {
        supplierId,
        supplierName: summary.supplier.supplierName,
        companyName: summary.supplier.companyName,
        outstandingAmount,
        openPurchaseCount,
        actionPath: `/app/accounting/suppliers/${supplierId}`,
        actionLabel: "Open supplier ledger",
      },
    });
  }

  async syncShopAlerts(shopId: string) {
    const settings = await this.adminSettingsService.getResolvedShopSettings(shopId);
    const activeStockNotifications =
      await this.notificationsRepository.listActiveByTypes(
        shopId,
        [...STOCK_NOTIFICATION_TYPES],
      );
    const currentStockKeys = new Set<string>();

    if (settings.lowStockAlertsEnabled) {
      const lowStockRows = await this.alertsRepository.listCurrentLowStockMedicines(
        shopId,
        settings.defaultLowStockThreshold,
      );

      for (const row of lowStockRows) {
        const conditionKey = `low_stock:${row.medicineId}`;
        currentStockKeys.add(conditionKey);

        await this.ensureActiveNotification({
          shopId,
          conditionKey,
          type: "low_stock",
          severity: Number(row.availableQuantity) === 0 ? "critical" : "warning",
          entityType: "medicine",
          entityId: row.medicineId,
          title: `${row.medicineName} is running low`,
          message: `Available stock is ${Number(row.availableQuantity)} against reorder level ${Number(row.reorderLevel)}.`,
          deliveryChannels: settings.lowStockEmailAlertsEnabled
            ? ["in_app", "email"]
            : ["in_app"],
          emailRequested: settings.lowStockEmailAlertsEnabled,
          metadata: {
            medicineId: row.medicineId,
            medicineName: row.medicineName,
            availableQuantity: Number(row.availableQuantity),
            reorderLevel: Number(row.reorderLevel),
            actionPath: "/app/reports/low-stock",
            actionLabel: "Open low stock report",
          },
        });
      }
    }

    if (settings.expiryAlertsEnabled) {
      const todayStart = startOfToday();
      const expiryRows = await this.alertsRepository.listCurrentExpiryBatches(
        shopId,
        settings.nearExpiryAlertDays,
      );

      for (const row of expiryRows) {
        const isExpired = row.expiryDate < todayStart;
        const conditionKey = `${isExpired ? "expired_stock" : "near_expiry"}:${row.batchId}`;
        currentStockKeys.add(conditionKey);

        await this.ensureActiveNotification({
          shopId,
          conditionKey,
          type: isExpired ? "expired_stock" : "near_expiry",
          severity: isExpired ? "critical" : "warning",
          entityType: "medicine_batch",
          entityId: row.batchId,
          title: isExpired
            ? `${row.medicineName} batch ${row.batchNumber} has expired`
            : `${row.medicineName} batch ${row.batchNumber} is nearing expiry`,
          message: isExpired
            ? `Batch ${row.batchNumber} expired on ${toDateString(row.expiryDate)} with ${row.quantityAvailable} units still available.`
            : `Batch ${row.batchNumber} expires on ${toDateString(row.expiryDate)} with ${row.quantityAvailable} units available.`,
          deliveryChannels: settings.expiryEmailAlertsEnabled
            ? ["in_app", "email"]
            : ["in_app"],
          emailRequested: settings.expiryEmailAlertsEnabled,
          metadata: {
            medicineId: row.medicineId,
            medicineName: row.medicineName,
            batchId: row.batchId,
            batchNumber: row.batchNumber,
            expiryDate: row.expiryDate.toISOString(),
            quantityAvailable: row.quantityAvailable,
            actionPath: "/app/reports/expiry",
            actionLabel: "Open expiry report",
          },
        });
      }
    }

    const staleStockKeys = activeStockNotifications
      .map((notification) => notification.conditionKey)
      .filter((conditionKey) => !currentStockKeys.has(conditionKey));

    await this.notificationsRepository.resolveActiveByConditionKeys(
      shopId,
      staleStockKeys,
    );

    const activeFinancialNotifications =
      await this.notificationsRepository.listActiveByTypes(
        shopId,
        [...FINANCIAL_NOTIFICATION_TYPES],
      );
    const currentFinancialKeys = new Set<string>();
    const [customers, suppliers] = await Promise.all([
      this.accountingRepository.listOutstandingCustomers(shopId, {
        search: undefined,
        page: 1,
        pageSize: 5000,
        sortBy: "outstandingAmount",
        sortOrder: "desc",
      }),
      this.accountingRepository.listOutstandingSuppliers(shopId, {
        search: undefined,
        page: 1,
        pageSize: 5000,
        sortBy: "outstandingAmount",
        sortOrder: "desc",
      }),
    ]);

    for (const item of customers) {
      const outstandingAmount = Number(item.summary.outstandingAmount ?? 0);
      const openBillCount = Number(item.summary.openBillCount ?? 0);

      if (outstandingAmount <= 0 || openBillCount <= 0) {
        continue;
      }

      const conditionKey = `customer_due:${item.customer.id}`;
      currentFinancialKeys.add(conditionKey);

      await this.ensureActiveNotification({
        shopId,
        conditionKey,
        type: "customer_due",
        severity: getFinancialSeverity(outstandingAmount),
        entityType: "customer",
        entityId: item.customer.id,
        title: `${item.customer.fullName} has outstanding dues`,
        message: `${item.customer.fullName} has ${openBillCount} open bill(s) with Rs ${item.summary.outstandingAmount} pending.`,
        deliveryChannels: ["in_app"],
        emailRequested: false,
        metadata: {
          customerId: item.customer.id,
          customerCode: item.customer.customerCode,
          customerName: item.customer.fullName,
          outstandingAmount,
          openBillCount,
          actionPath: `/app/accounting/customers/${item.customer.id}`,
          actionLabel: "Open customer ledger",
        },
      });
    }

    for (const item of suppliers) {
      const outstandingAmount = Number(item.summary.outstandingAmount ?? 0);
      const openPurchaseCount = Number(item.summary.openPurchaseCount ?? 0);

      if (outstandingAmount <= 0 || openPurchaseCount <= 0) {
        continue;
      }

      const conditionKey = `supplier_payable:${item.supplier.id}`;
      currentFinancialKeys.add(conditionKey);

      await this.ensureActiveNotification({
        shopId,
        conditionKey,
        type: "supplier_payable",
        severity: getFinancialSeverity(outstandingAmount),
        entityType: "supplier",
        entityId: item.supplier.id,
        title: `${item.supplier.supplierName} has pending payables`,
        message: `${item.supplier.supplierName} has ${openPurchaseCount} open purchase(s) with Rs ${item.summary.outstandingAmount} pending.`,
        deliveryChannels: ["in_app"],
        emailRequested: false,
        metadata: {
          supplierId: item.supplier.id,
          supplierName: item.supplier.supplierName,
          companyName: item.supplier.companyName,
          outstandingAmount,
          openPurchaseCount,
          actionPath: `/app/accounting/suppliers/${item.supplier.id}`,
          actionLabel: "Open supplier ledger",
        },
      });
    }

    const staleFinancialKeys = activeFinancialNotifications
      .map((notification) => notification.conditionKey)
      .filter((conditionKey) => !currentFinancialKeys.has(conditionKey));

    await this.notificationsRepository.resolveActiveByConditionKeys(
      shopId,
      staleFinancialKeys,
    );
  }

  async dispatchPendingInventoryAlertEmails(shopId: string) {
    const [pendingNotifications, recipients] = await Promise.all([
      this.notificationsRepository.listPendingInventoryEmailNotifications(shopId),
      this.alertsRepository.listAdminEmailRecipients(shopId),
    ]);

    if (!pendingNotifications.length) {
      return;
    }

    if (!recipients.length) {
      await Promise.all(
        pendingNotifications.map((notification) =>
          this.notificationsRepository.updateNotification(notification.id, shopId, {
            emailStatus: "skipped",
          }),
        ),
      );
      return;
    }

    for (const notification of pendingNotifications) {
      try {
        await Promise.all(
          recipients.map(({ shop, user }) =>
            this.sendInventoryEmail(notification, {
              shopName: shop.name,
              recipientName: user.fullName,
              to: user.email,
            }),
          ),
        );

        await this.notificationsRepository.updateNotification(notification.id, shopId, {
          emailStatus: "sent",
        });
      } catch (error) {
        logger.error("Failed to send inventory alert email", {
          shopId,
          notificationId: notification.id,
          type: notification.type,
          message: error instanceof Error ? error.message : "Unknown error",
        });

        await this.notificationsRepository.updateNotification(notification.id, shopId, {
          emailStatus: "failed",
        });
      }
    }
  }

  async dispatchLowStockAlert(event: LowStockAlertEvent) {
    await this.syncMedicineAlerts(event.shopId, event.medicineId);
    await this.dispatchPendingInventoryAlertEmails(event.shopId);
  }

  private async ensureActiveNotification(
    input: {
      shopId: string;
      conditionKey: string;
      type: "low_stock" | "near_expiry" | "expired_stock" | "customer_due" | "supplier_payable";
      severity: "info" | "warning" | "critical";
      entityType: "medicine" | "medicine_batch" | "customer" | "supplier";
      entityId: string;
      title: string;
      message: string;
      deliveryChannels: DeliveryChannel[];
      emailRequested: boolean;
      metadata: Record<string, unknown>;
    },
    executor?: DbExecutor,
  ) {
    const run = async (tx: DbExecutor) => {
      await this.notificationsRepository.lockCondition(
        input.shopId,
        input.conditionKey,
        tx,
      );

      const existing = await this.notificationsRepository.findActiveByConditionKey(
        input.shopId,
        input.conditionKey,
        tx,
      );
      const nextEmailStatus = input.emailRequested
        ? existing?.emailStatus === "skipped"
          ? "pending"
          : existing?.emailStatus ?? "pending"
        : existing?.emailStatus === "pending"
          ? "skipped"
          : existing?.emailStatus ?? "skipped";

      if (existing) {
        return this.notificationsRepository.updateNotification(
          existing.id,
          input.shopId,
          {
            title: input.title,
            message: input.message,
            severity: input.severity,
            deliveryChannels: input.deliveryChannels,
            emailStatus: nextEmailStatus,
            metadata: input.metadata,
          },
          tx,
        );
      }

      return this.notificationsRepository.createNotification(
        {
          shopId: input.shopId,
          type: input.type,
          title: input.title,
          message: input.message,
          severity: input.severity,
          entityType: input.entityType,
          entityId: input.entityId,
          conditionKey: input.conditionKey,
          metadata: input.metadata,
          deliveryChannels: input.deliveryChannels,
          emailStatus: input.emailRequested ? "pending" : "skipped",
          isActive: true,
        },
        tx,
      );
    };

    if (executor) {
      return run(executor);
    }

    return db.transaction(run);
  }

  private async resolveCondition(
    shopId: string,
    conditionKey: string,
    executor?: DbExecutor,
  ) {
    const run = async (tx: DbExecutor) => {
      await this.notificationsRepository.lockCondition(shopId, conditionKey, tx);
      await this.notificationsRepository.resolveActiveByConditionKeys(
        shopId,
        [conditionKey],
        tx,
      );
    };

    if (executor) {
      await run(executor);
      return;
    }

    await db.transaction(run);
  }

  private async sendInventoryEmail(
    notification: Notification,
    recipient: {
      to: string;
      recipientName: string;
      shopName: string;
    },
  ) {
    const metadata = notification.metadata ?? {};

    if (notification.type === "low_stock") {
      await emailService.sendLowStockAlert({
        to: recipient.to,
        recipientName: recipient.recipientName,
        shopName: recipient.shopName,
        medicineName: getMetadataString(metadata, "medicineName") ?? notification.title,
        currentAvailableQuantity:
          getMetadataNumber(metadata, "availableQuantity") ?? 0,
        reorderLevel: getMetadataNumber(metadata, "reorderLevel") ?? 0,
      });
      return;
    }

    const payload: {
      to: string;
      recipientName: string;
      shopName: string;
      title: string;
      message: string;
      medicineName: string;
      batchNumber?: string;
      expiryDate?: string;
      quantityAvailable?: number;
      tone: "near_expiry" | "expired";
    } = {
      to: recipient.to,
      recipientName: recipient.recipientName,
      shopName: recipient.shopName,
      title: notification.title,
      message: notification.message,
      medicineName:
        getMetadataString(metadata, "medicineName") ?? notification.title,
      tone: notification.type === "expired_stock" ? "expired" : "near_expiry",
    };
    const batchNumber = getMetadataString(metadata, "batchNumber");
    const expiryDate = getMetadataString(metadata, "expiryDate");
    const quantityAvailable = getMetadataNumber(metadata, "quantityAvailable");

    if (batchNumber) {
      payload.batchNumber = batchNumber;
    }

    if (expiryDate) {
      payload.expiryDate = expiryDate;
    }

    if (quantityAvailable !== undefined) {
      payload.quantityAvailable = quantityAvailable;
    }

    await emailService.sendInventoryAttentionAlert(payload);
  }
}
