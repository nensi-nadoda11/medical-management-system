export const ADMIN_PERMISSION_KEYS = [
  "medicines.view",
  "medicines.create",
  "medicines.edit",
  "suppliers.view",
  "suppliers.create",
  "suppliers.edit",
  "purchases.view",
  "purchases.create",
  "purchases.finalize",
  "purchaseReturns.view",
  "purchaseReturns.create",
  "purchaseReturns.complete",
  "inventory.view",
  "inventory.adjust",
  "billing.view",
  "billing.create",
  "billing.complete",
  "billing.return",
  "reports.view",
  "reports.financial",
  "customers.view",
  "customers.create",
  "customers.edit",
  "payments.view",
  "payments.create",
  "shop.view",
  "shop.manage",
  "users.view",
  "users.manage",
  "settings.view",
  "settings.manage",
] as const;

export type AdminPermissionKey = (typeof ADMIN_PERMISSION_KEYS)[number];
export type AdminRole = "admin" | "staff" | "accountant";

export interface PermissionCatalogItem {
  key: AdminPermissionKey;
  group:
    | "medicines"
    | "suppliers"
    | "purchases"
    | "purchaseReturns"
    | "inventory"
    | "billing"
    | "reports"
    | "customers"
    | "payments"
    | "shop"
    | "users"
    | "settings";
  label: string;
  description: string;
}

export interface PermissionCatalogResponse {
  permissions: PermissionCatalogItem[];
  availableKeys: AdminPermissionKey[];
}

export interface RolePermissionConfig {
  role: AdminRole;
  source: "default" | "custom";
  permissions: AdminPermissionKey[];
}

export interface UserPermissionDetail {
  user: {
    id: string;
    fullName: string;
    email: string;
    role: AdminRole;
    isActive: boolean;
  };
  inheritedPermissions: AdminPermissionKey[];
  overrides: {
    allow: AdminPermissionKey[];
    deny: AdminPermissionKey[];
  };
  effectivePermissions: AdminPermissionKey[];
}

export interface NotificationChannelsSummary {
  email: {
    enabled: boolean;
    recipientMode: "shop_admins";
    lowStockEnabled: boolean;
    expiryEnabled: boolean;
  };
  whatsapp: {
    enabled: boolean;
    recipientMode: "shop_admins" | "provider_only" | "disabled";
    lowStockEnabled: boolean;
    expiryEnabled: boolean;
  };
}

export interface AdminShopSettings {
  shopId: string;
  defaultLowStockThreshold: number;
  lowStockAlertsEnabled: boolean;
  lowStockEmailAlertsEnabled: boolean;
  nearExpiryAlertDays: number;
  expiryAlertsEnabled: boolean;
  expiryEmailAlertsEnabled: boolean;
  invoicePrefix: string;
  allowPartialPayments: boolean;
  allowHeldBills: boolean;
  allowStaffSalesReturn: boolean;
  allowInventoryAdjustment: boolean;
  allowDraftPurchases: boolean;
  preferFefo: boolean;
  notificationChannels: NotificationChannelsSummary;
  primaryAlertRecipients: Array<{
    id: string;
    fullName: string;
    email: string;
    mobileNumber: string | null;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateRolePermissionsPayload {
  permissions: AdminPermissionKey[];
}

export interface UpdateUserPermissionOverridesPayload {
  allow: AdminPermissionKey[];
  deny: AdminPermissionKey[];
}

export interface UpdateAdminShopSettingsPayload {
  defaultLowStockThreshold: number;
  lowStockAlertsEnabled: boolean;
  lowStockEmailAlertsEnabled: boolean;
  nearExpiryAlertDays: number;
  expiryAlertsEnabled: boolean;
  expiryEmailAlertsEnabled: boolean;
  invoicePrefix: string;
  allowPartialPayments: boolean;
  allowHeldBills: boolean;
  allowStaffSalesReturn: boolean;
  allowInventoryAdjustment: boolean;
  allowDraftPurchases: boolean;
  preferFefo: boolean;
}

export interface AdminAuditLogItem {
  id: string;
  action: string;
  targetType: "role_permission" | "user_permission_override" | "shop_setting";
  targetId: string | null;
  targetLabel: string | null;
  actor: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminAuditLogList {
  items: AdminAuditLogItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
