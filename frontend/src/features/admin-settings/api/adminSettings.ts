import { apiRequest } from "../../../lib/api";
import type {
  AdminAuditLogList,
  AdminRole,
  AdminShopSettings,
  PermissionCatalogResponse,
  RolePermissionConfig,
  UpdateAdminShopSettingsPayload,
  UpdateRolePermissionsPayload,
  UpdateUserPermissionOverridesPayload,
  UserPermissionDetail,
} from "../../../types/admin-settings";

export const adminSettingsQueryKeys = {
  all: ["admin-settings"] as const,
  catalog: ["admin-settings", "catalog"] as const,
  roles: ["admin-settings", "roles"] as const,
  shopSettings: ["admin-settings", "shop-settings"] as const,
  userDetail: (userId?: string | null) =>
    ["admin-settings", "user-detail", userId ?? "none"] as const,
  auditLogs: ["admin-settings", "audit-logs"] as const,
};

export const getPermissionCatalog = () =>
  apiRequest<PermissionCatalogResponse>({
    method: "GET",
    url: "/admin-settings/permissions/catalog",
  });

export const getRolePermissions = () =>
  apiRequest<RolePermissionConfig[]>({
    method: "GET",
    url: "/admin-settings/permissions/roles",
  });

export const updateRolePermissions = (
  role: AdminRole,
  payload: UpdateRolePermissionsPayload,
) =>
  apiRequest<RolePermissionConfig[]>({
    method: "PUT",
    url: `/admin-settings/permissions/roles/${role}`,
    data: payload,
  });

export const getUserPermissionDetail = (userId: string) =>
  apiRequest<UserPermissionDetail>({
    method: "GET",
    url: `/admin-settings/permissions/users/${userId}`,
  });

export const updateUserPermissionOverrides = (
  userId: string,
  payload: UpdateUserPermissionOverridesPayload,
) =>
  apiRequest<UserPermissionDetail>({
    method: "PUT",
    url: `/admin-settings/permissions/users/${userId}`,
    data: payload,
  });

export const getAdminShopSettings = () =>
  apiRequest<AdminShopSettings>({
    method: "GET",
    url: "/admin-settings/shop-settings",
  });

export const updateAdminShopSettings = (payload: UpdateAdminShopSettingsPayload) =>
  apiRequest<AdminShopSettings>({
    method: "PATCH",
    url: "/admin-settings/shop-settings",
    data: payload,
  });

export const getAdminAuditLogs = () =>
  apiRequest<AdminAuditLogList>({
    method: "GET",
    url: "/admin-settings/audit-logs",
  });
