import { AppError } from "../../shared/errors/app-error";
import type { Notification } from "../../db/schema";
import { AlertsService } from "../alerts/alerts.service";
import type { PublicUser } from "../auth/auth.types";
import { NotificationsRepository, type NotificationType } from "./notifications.repository";
import type {
  BulkMarkNotificationsReadInput,
  ListNotificationsQuery,
} from "./notifications.validation";

const buildAppError = (statusCode: number, code: string, message: string) =>
  new AppError({
    statusCode,
    code,
    message,
  });

const STOCK_NOTIFICATION_TYPES: NotificationType[] = [
  "low_stock",
  "near_expiry",
  "expired_stock",
];
const FINANCIAL_NOTIFICATION_TYPES: NotificationType[] = [
  "customer_due",
  "supplier_payable",
];

const getString = (value: unknown) => (typeof value === "string" ? value : undefined);

export class NotificationsService {
  constructor(
    private readonly notificationsRepository = new NotificationsRepository(),
    private readonly alertsService = new AlertsService(),
  ) {}

  async listNotifications(
    shopId: string,
    user: PublicUser,
    query: ListNotificationsQuery,
  ) {
    await this.alertsService.syncShopAlerts(shopId);
    void this.alertsService.dispatchPendingInventoryAlertEmails(shopId);

    const allowedTypes = this.getAllowedTypes(user);

    if (!allowedTypes.length) {
      return this.buildPaginatedResponse([], 0, query.page, query.pageSize);
    }

    const filters = {
      page: query.page,
      pageSize: query.pageSize,
      activeOnly: query.activeOnly,
      allowedTypes,
      ...(query.type ? { type: query.type } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.isRead !== undefined ? { isRead: query.isRead } : {}),
      ...(query.isAcknowledged !== undefined
        ? { isAcknowledged: query.isAcknowledged }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.notificationsRepository.listNotifications(shopId, filters),
      this.notificationsRepository.countNotifications(shopId, filters),
    ]);

    return this.buildPaginatedResponse(
      items.map((item) => this.toResponse(item)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async getUnreadCount(shopId: string, user: PublicUser) {
    await this.alertsService.syncShopAlerts(shopId);
    void this.alertsService.dispatchPendingInventoryAlertEmails(shopId);

    const allowedTypes = this.getAllowedTypes(user);

    return {
      unreadCount: await this.notificationsRepository.countUnread(
        shopId,
        allowedTypes,
      ),
    };
  }

  async getSummary(shopId: string, user: PublicUser) {
    await this.alertsService.syncShopAlerts(shopId);
    void this.alertsService.dispatchPendingInventoryAlertEmails(shopId);

    const allowedTypes = this.getAllowedTypes(user);

    if (!allowedTypes.length) {
      return {
        unreadCount: 0,
        criticalCount: 0,
        latest: [],
      };
    }

    const [unreadCount, criticalCount, latest] = await Promise.all([
      this.notificationsRepository.countUnread(shopId, allowedTypes),
      this.notificationsRepository.countCriticalActive(shopId, allowedTypes),
      this.notificationsRepository.listLatest(shopId, allowedTypes, 6),
    ]);

    return {
      unreadCount,
      criticalCount,
      latest: latest.map((item) => this.toResponse(item)),
    };
  }

  async markAsRead(shopId: string, user: PublicUser, notificationId: string) {
    const current = await this.getAccessibleNotification(shopId, user, notificationId);

    const updated =
      (await this.notificationsRepository.markAsRead(shopId, notificationId)) ??
      current;

    return this.toResponse(updated);
  }

  async acknowledge(
    shopId: string,
    user: PublicUser,
    notificationId: string,
  ) {
    const current = await this.getAccessibleNotification(shopId, user, notificationId);

    const updated =
      (await this.notificationsRepository.acknowledge(
        shopId,
        notificationId,
        user.id,
      )) ?? current;

    return this.toResponse(updated);
  }

  async bulkMarkRead(
    shopId: string,
    user: PublicUser,
    input: BulkMarkNotificationsReadInput,
  ) {
    const allowedTypes = this.getAllowedTypes(user);
    const updated = await this.notificationsRepository.bulkMarkRead(
      shopId,
      allowedTypes,
      input.ids,
    );

    return {
      updatedCount: updated.length,
    };
  }

  private async getAccessibleNotification(
    shopId: string,
    user: PublicUser,
    notificationId: string,
  ) {
    const notification = await this.notificationsRepository.findById(
      shopId,
      notificationId,
    );

    if (!notification) {
      throw buildAppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
    }

    const allowedTypes = this.getAllowedTypes(user);

    if (!allowedTypes.includes(notification.type)) {
      throw buildAppError(
        404,
        "NOTIFICATION_NOT_FOUND",
        "Notification not found.",
      );
    }

    return notification;
  }

  private getAllowedTypes(user: PublicUser): NotificationType[] {
    if (user.role === "admin") {
      return [
        "low_stock",
        "near_expiry",
        "expired_stock",
        "customer_due",
        "supplier_payable",
        "system_alert",
      ];
    }

    const allowed = new Set<NotificationType>();

    if (
      user.permissions.includes("inventory.view") ||
      user.permissions.includes("reports.financial")
    ) {
      STOCK_NOTIFICATION_TYPES.forEach((type) => allowed.add(type));
    }

    if (user.permissions.includes("payments.view")) {
      FINANCIAL_NOTIFICATION_TYPES.forEach((type) => allowed.add(type));
    }

    return [...allowed];
  }

  private toResponse(notification: Notification) {
    const metadata = notification.metadata ?? {};

    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      severity: notification.severity,
      entityType: notification.entityType,
      entityId: notification.entityId,
      deliveryChannels: notification.deliveryChannels,
      emailStatus: notification.emailStatus,
      isActive: notification.isActive,
      isRead: Boolean(notification.readAt),
      isAcknowledged: Boolean(notification.acknowledgedAt),
      actionPath: getString(metadata.actionPath),
      actionLabel: getString(metadata.actionLabel),
      readAt: notification.readAt,
      acknowledgedAt: notification.acknowledgedAt,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      metadata,
    };
  }

  private buildPaginatedResponse<T>(
    items: T[],
    total: number,
    page: number,
    pageSize: number,
  ) {
    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }
}
