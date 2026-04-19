import { apiRequest } from "../../../lib/api";
import type {
  NotificationItem,
  NotificationsParams,
  NotificationsResponse,
  NotificationSummary,
  NotificationUnreadCount,
} from "../../../types/notification";

const cleanParams = (
  params: Record<string, string | number | boolean | undefined>,
) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
  );

const notificationsRootKey = ["notifications"] as const;

export const notificationsQueryKeys = {
  all: notificationsRootKey,
  list: (params: NotificationsParams) =>
    [...notificationsRootKey, "list", params] as const,
  summary: [...notificationsRootKey, "summary"] as const,
  unreadCount: [...notificationsRootKey, "unread-count"] as const,
};

export const listNotifications = (params: NotificationsParams) =>
  apiRequest<NotificationsResponse>({
    method: "GET",
    url: "/notifications",
    params: cleanParams({
      page: params.page,
      pageSize: params.pageSize,
      type: params.type,
      severity: params.severity,
      isRead: params.isRead,
      isAcknowledged: params.isAcknowledged,
      activeOnly: params.activeOnly,
    }),
  });

export const getNotificationSummary = () =>
  apiRequest<NotificationSummary>({
    method: "GET",
    url: "/notifications/summary",
  });

export const getNotificationUnreadCount = () =>
  apiRequest<NotificationUnreadCount>({
    method: "GET",
    url: "/notifications/unread-count",
  });

export const markNotificationAsRead = (notificationId: string) =>
  apiRequest<NotificationItem>({
    method: "PATCH",
    url: `/notifications/${notificationId}/read`,
  });

export const acknowledgeNotification = (notificationId: string) =>
  apiRequest<NotificationItem>({
    method: "PATCH",
    url: `/notifications/${notificationId}/acknowledge`,
  });

export const bulkMarkNotificationsRead = (ids?: string[]) =>
  apiRequest<{ updatedCount: number }>({
    method: "PATCH",
    url: "/notifications/read",
    data: ids?.length ? { ids } : {},
  });
