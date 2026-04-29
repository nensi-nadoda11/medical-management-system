import type { PaginatedResponse } from "./common";

export type NotificationType =
  | "low_stock"
  | "supplier_reorder"
  | "near_expiry"
  | "expired_stock"
  | "customer_due"
  | "supplier_payable"
  | "system_alert";

export type NotificationSeverity = "info" | "warning" | "critical";
export type NotificationEmailStatus = "pending" | "sent" | "failed" | "skipped";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  entityType: "medicine" | "medicine_batch" | "customer" | "supplier" | "system";
  entityId: string | null;
  deliveryChannels: string[];
  emailStatus: NotificationEmailStatus;
  isActive: boolean;
  isRead: boolean;
  isAcknowledged: boolean;
  actionPath?: string;
  actionLabel?: string;
  readAt: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface NotificationsParams {
  page: number;
  pageSize: number;
  type?: NotificationType;
  severity?: NotificationSeverity;
  isRead?: boolean;
  isAcknowledged?: boolean;
  activeOnly?: boolean;
}

export type NotificationsResponse = PaginatedResponse<NotificationItem>;

export interface NotificationSummary {
  unreadCount: number;
  criticalCount: number;
  latest: NotificationItem[];
}

export interface NotificationUnreadCount {
  unreadCount: number;
}
