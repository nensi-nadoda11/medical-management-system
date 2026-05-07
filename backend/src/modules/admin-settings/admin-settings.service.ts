import { db } from "../../db/client";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/app-error";
import type { DbExecutor } from "../../shared/db/executor";
import { runDbReads } from "../../shared/db/run-db-reads";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { UsersRepository } from "../users/users.repository";
import type { PublicUser, UserRole } from "../auth/auth.types";
import {
  DEFAULT_ROLE_PERMISSIONS,
  ESSENTIAL_ADMIN_PERMISSIONS,
  PERMISSION_CATALOG,
  PERMISSIONS,
  normalizePermissionSet,
  resolveEffectivePermissions,
  type PermissionKey,
} from "./admin-settings.permissions";
import { AdminSettingsRepository } from "./admin-settings.repository";
import type {
  ListAdminAuditLogsQuery,
  UpdateShopSettingsInput,
  UpdateUserPermissionOverridesInput,
} from "./admin-settings.validation";

const buildAppError = (statusCode: number, code: string, message: string) =>
  new AppError({
    statusCode,
    code,
    message,
  });

type ShopSettingsDefaults = {
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
};

const SHOP_SETTINGS_DEFAULTS: ShopSettingsDefaults = {
  defaultLowStockThreshold: 10,
  lowStockAlertsEnabled: true,
  lowStockEmailAlertsEnabled: true,
  nearExpiryAlertDays: 30,
  expiryAlertsEnabled: true,
  expiryEmailAlertsEnabled: true,
  invoicePrefix: "INV",
  allowPartialPayments: true,
  allowHeldBills: true,
  allowStaffSalesReturn: true,
  allowInventoryAdjustment: true,
  allowDraftPurchases: true,
  preferFefo: true,
};

export type ResolvedShopSettings = ShopSettingsDefaults & {
  shopId: string;
  notificationChannels: {
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
  };
  primaryAlertRecipients: Array<{
    id: string;
    fullName: string;
    email: string;
    mobileNumber: string | null;
  }>;
  updatedAt?: Date;
  createdAt?: Date;
};

export class AdminSettingsService {
  constructor(
    private readonly adminSettingsRepository = new AdminSettingsRepository(),
    private readonly usersRepository = new UsersRepository(),
    private readonly auditLogsService = new AuditLogsService(),
  ) {}

  getPermissionCatalog() {
    return {
      permissions: PERMISSION_CATALOG,
      availableKeys: PERMISSIONS,
    };
  }

  async getRolePermissions(shopId: string) {
    const [configs, rows] = await Promise.all([
      this.adminSettingsRepository.listRolePermissionConfigs(shopId),
      this.adminSettingsRepository.listRolePermissions(shopId),
    ]);

    const configuredRoles = new Set(configs.map((config) => config.role));

    return (["admin", "staff", "accountant"] as const).map((role) => {
      const configuredPermissions = rows
        .filter((row) => row.role === role)
        .map((row) => row.permission);

      const permissions = configuredRoles.has(role)
        ? normalizePermissionSet(configuredPermissions)
        : DEFAULT_ROLE_PERMISSIONS[role];

      return {
        role,
        source: configuredRoles.has(role) ? "custom" : "default",
        permissions,
      };
    });
  }

  async getUserPermissionDetail(shopId: string, userId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user || user.shopId !== shopId) {
      throw buildAppError(404, "USER_NOT_FOUND", "User not found.");
    }

    const [rolePermissions, overrides] = await Promise.all([
      this.resolveRolePermissions(shopId, user.role),
      this.adminSettingsRepository.listUserPermissionOverrides(shopId, userId),
    ]);

    const allow = normalizePermissionSet(
      overrides
        .filter((override) => override.effect === "allow")
        .map((override) => override.permission),
    );
    const deny = normalizePermissionSet(
      overrides
        .filter((override) => override.effect === "deny")
        .map((override) => override.permission),
    );

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      inheritedPermissions: rolePermissions,
      overrides: {
        allow,
        deny,
      },
      effectivePermissions: resolveEffectivePermissions({
        rolePermissions,
        allow,
        deny,
      }),
    };
  }

  async updateRolePermissions(
    shopId: string,
    role: UserRole,
    permissions: string[],
    actorUser: PublicUser,
  ) {
    const normalizedPermissions = normalizePermissionSet(permissions);

    if (
      role === "admin" &&
      ESSENTIAL_ADMIN_PERMISSIONS.some(
        (permission) => !normalizedPermissions.includes(permission),
      )
    ) {
      throw buildAppError(
        400,
        "ADMIN_ROLE_PROTECTED",
        "Admin role must retain essential admin control permissions.",
      );
    }

    const currentPermissions = await this.resolveRolePermissions(shopId, role);

    if (role === actorUser.role) {
      const actorOverrides = await this.adminSettingsRepository.listUserPermissionOverrides(
        shopId,
        actorUser.id,
      );
      const actorAllow = normalizePermissionSet(
        actorOverrides
          .filter((override) => override.effect === "allow")
          .map((override) => override.permission),
      );
      const actorDeny = normalizePermissionSet(
        actorOverrides
          .filter((override) => override.effect === "deny")
          .map((override) => override.permission),
      );
      const nextEffective = resolveEffectivePermissions({
        rolePermissions: normalizedPermissions,
        allow: actorAllow,
        deny: actorDeny,
      });

      this.assertEssentialAdminPermissions(actorUser.role, nextEffective);
    }

    await db.transaction(async (tx) => {
      await this.adminSettingsRepository.replaceRolePermissions(
        {
          shopId,
          role,
          permissions: normalizedPermissions,
          updatedByUserId: actorUser.id,
        },
        tx,
      );

      await this.adminSettingsRepository.createAuditLog(
        {
          shopId,
          actorUserId: actorUser.id,
          targetType: "role_permission",
          targetId: role,
          action: "role_permissions_updated",
          oldValue: {
            role,
            permissions: currentPermissions,
          },
          newValue: {
            role,
            permissions: normalizedPermissions,
          },
        },
        tx,
      );

      await this.auditLogsService.record(
        {
          actor: actorUser,
          module: "permissions",
          action: "role_permissions_updated",
          entityType: "role",
          entityId: role,
          severity: "critical",
          title: `${role} role permissions updated`,
          description: `Role permissions for ${role} were updated.`,
          beforeData: {
            role,
            permissions: currentPermissions,
          },
          afterData: {
            role,
            permissions: normalizedPermissions,
          },
        },
        tx,
      );
    });

    return this.getRolePermissions(shopId);
  }

  async updateUserPermissionOverrides(
    shopId: string,
    userId: string,
    input: UpdateUserPermissionOverridesInput,
    actorUser: PublicUser,
  ) {
    const user = await this.usersRepository.findById(userId);

    if (!user || user.shopId !== shopId) {
      throw buildAppError(404, "USER_NOT_FOUND", "User not found.");
    }

    const allow = normalizePermissionSet(input.allow);
    const deny = normalizePermissionSet(input.deny);
    const currentDetail = await this.getUserPermissionDetail(shopId, userId);
    const nextEffective = resolveEffectivePermissions({
      rolePermissions: currentDetail.inheritedPermissions,
      allow,
      deny,
    });

    if (user.id === actorUser.id) {
      this.assertEssentialAdminPermissions(actorUser.role, nextEffective);
    }

    await db.transaction(async (tx) => {
      await this.adminSettingsRepository.replaceUserPermissionOverrides(
        {
          shopId,
          userId,
          allow,
          deny,
        },
        tx,
      );

      await this.adminSettingsRepository.createAuditLog(
        {
          shopId,
          actorUserId: actorUser.id,
          targetType: "user_permission_override",
          targetId: userId,
          action: "user_permission_overrides_updated",
          oldValue: currentDetail.overrides as Record<string, unknown>,
          newValue: {
            allow,
            deny,
          },
        },
        tx,
      );

      await this.auditLogsService.record(
        {
          actor: actorUser,
          module: "permissions",
          action: "user_permission_overrides_updated",
          entityType: "user",
          entityId: userId,
          severity: "critical",
          title: `Permission overrides updated for ${user.fullName}`,
          description: `User-specific permission overrides were updated for ${user.fullName}.`,
          beforeData: currentDetail.overrides as Record<string, unknown>,
          afterData: {
            allow,
            deny,
          },
          metadata: {
            targetUserId: userId,
            targetUserRole: user.role,
            targetUserName: user.fullName,
          },
        },
        tx,
      );
    });

    return this.getUserPermissionDetail(shopId, userId);
  }

  async resolveRolePermissions(
    shopId: string,
    role: UserRole,
    executor?: DbExecutor,
  ) {
    const [configs, rows] = await runDbReads(
      [
        () => this.adminSettingsRepository.listRolePermissionConfigs(shopId, executor),
        () => this.adminSettingsRepository.listRolePermissions(shopId, executor),
      ] as const,
      executor,
    );

    const hasCustomRoleConfig = configs.some((config) => config.role === role);

    if (!hasCustomRoleConfig) {
      return DEFAULT_ROLE_PERMISSIONS[role];
    }

    return normalizePermissionSet(
      rows.filter((row) => row.role === role).map((row) => row.permission),
    );
  }

  async resolveEffectivePermissionsForUser(input: {
    shopId: string;
    userId: string;
    role: UserRole;
    executor?: DbExecutor;
  }) {
    const [rolePermissions, overrides] = await runDbReads(
      [
        () => this.resolveRolePermissions(input.shopId, input.role, input.executor),
        () =>
          this.adminSettingsRepository.listUserPermissionOverrides(
            input.shopId,
            input.userId,
            input.executor,
          ),
      ] as const,
      input.executor,
    );

    return resolveEffectivePermissions({
      rolePermissions,
      allow: normalizePermissionSet(
        overrides
          .filter((override) => override.effect === "allow")
          .map((override) => override.permission),
      ),
      deny: normalizePermissionSet(
        overrides
          .filter((override) => override.effect === "deny")
          .map((override) => override.permission),
      ),
    });
  }

  async getShopSettings(shopId: string) {
    const [shop, settings, recipients] = await Promise.all([
      this.adminSettingsRepository.findShopById(shopId),
      this.adminSettingsRepository.findShopSettings(shopId),
      this.adminSettingsRepository.listAdminEmailRecipients(shopId),
    ]);

    if (!shop) {
      throw buildAppError(404, "SHOP_NOT_FOUND", "Shop not found.");
    }

    return this.buildResolvedShopSettings(shopId, settings, recipients);
  }

  async getResolvedShopSettings(shopId: string, executor?: DbExecutor) {
    const [shop, settings, recipients] = await runDbReads(
      [
        () => this.adminSettingsRepository.findShopById(shopId, executor),
        () => this.adminSettingsRepository.findShopSettings(shopId, executor),
        () => this.adminSettingsRepository.listAdminEmailRecipients(shopId, executor),
      ] as const,
      executor,
    );

    if (!shop) {
      throw buildAppError(404, "SHOP_NOT_FOUND", "Shop not found.");
    }

    return this.buildResolvedShopSettings(
      shopId,
      settings,
      recipients,
    );
  }

  async updateShopSettings(
    shopId: string,
    input: UpdateShopSettingsInput,
    actorUser: PublicUser,
  ) {
    const current = await this.getShopSettings(shopId);

    const nextSettings = { ...input };

    await db.transaction(async (tx) => {
      await this.adminSettingsRepository.upsertShopSettings(
        {
          ...nextSettings,
          shopId,
        },
        tx,
      );

      await this.adminSettingsRepository.updateShopInvoicePrefix(
        shopId,
        input.invoicePrefix,
        tx,
      );

      await this.adminSettingsRepository.createAuditLog(
        {
          shopId,
          actorUserId: actorUser.id,
          targetType: "shop_setting",
          targetId: shopId,
          action: "shop_settings_updated",
          oldValue: {
            ...SHOP_SETTINGS_DEFAULTS,
            ...current,
            primaryAlertRecipients: undefined,
            notificationChannels: undefined,
          } as Record<string, unknown>,
          newValue: nextSettings as Record<string, unknown>,
        },
        tx,
      );

      await this.auditLogsService.record(
        {
          actor: actorUser,
          module: "settings",
          action: "shop_settings_updated",
          entityType: "shop",
          entityId: shopId,
          severity: "critical",
          title: "Shop operational settings updated",
          description: "Admin operational settings were updated.",
          beforeData: {
            ...SHOP_SETTINGS_DEFAULTS,
            ...current,
            primaryAlertRecipients: undefined,
            notificationChannels: undefined,
          } as Record<string, unknown>,
          afterData: nextSettings as Record<string, unknown>,
        },
        tx,
      );
    });

    return this.getShopSettings(shopId);
  }

  async listAuditLogs(shopId: string, query: ListAdminAuditLogsQuery) {
    const [rows, total] = await Promise.all([
      this.adminSettingsRepository.listAuditLogs(shopId, query),
      this.adminSettingsRepository.countAuditLogs(shopId),
    ]);

    const userIds = [
      ...new Set(
        rows
          .flatMap((row) => [row.actorUserId, row.targetId ?? ""])
          .filter((value) => /^[0-9a-f-]{36}$/i.test(value)),
      ),
    ];
    const users = await this.adminSettingsRepository.listUsersByIds(userIds);
    const userMap = new Map(users.map((user) => [user.id, user]));

    return {
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        targetLabel:
          row.targetType === "role_permission"
            ? `${row.targetId} role`
            : row.targetType === "shop_setting"
              ? "Shop settings"
              : userMap.get(row.targetId ?? "")?.fullName ?? row.targetId,
        actor:
          userMap.get(row.actorUserId)
            ? {
                id: row.actorUserId,
                fullName: userMap.get(row.actorUserId)!.fullName,
                email: userMap.get(row.actorUserId)!.email,
              }
            : null,
        oldValue: row.oldValue,
        newValue: row.newValue,
        createdAt: row.createdAt,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize) || 1,
      },
    };
  }

  private buildResolvedShopSettings(
    shopId: string,
    settings: Awaited<ReturnType<AdminSettingsRepository["findShopSettings"]>>,
    recipients: Awaited<ReturnType<AdminSettingsRepository["listAdminEmailRecipients"]>>,
  ): ResolvedShopSettings {
    const emailChannelEnabled = recipients.some((recipient) => Boolean(recipient.email));
    const whatsappProviderEnabled = env.WHATSAPP_PROVIDER === "console" || Boolean(env.TWILIO_WHATSAPP_FROM_NUMBER);
    const whatsappRecipientEnabled = recipients.some((recipient) => Boolean(recipient.mobileNumber));
    const whatsappChannelEnabled = whatsappProviderEnabled && whatsappRecipientEnabled;
    const lowStockExternalAlertsEnabled =
      settings?.lowStockEmailAlertsEnabled ??
      SHOP_SETTINGS_DEFAULTS.lowStockEmailAlertsEnabled;
    const expiryExternalAlertsEnabled =
      settings?.expiryEmailAlertsEnabled ??
      SHOP_SETTINGS_DEFAULTS.expiryEmailAlertsEnabled;

    return {
      shopId,
      defaultLowStockThreshold:
        settings?.defaultLowStockThreshold ??
        SHOP_SETTINGS_DEFAULTS.defaultLowStockThreshold,
      lowStockAlertsEnabled:
        settings?.lowStockAlertsEnabled ??
        SHOP_SETTINGS_DEFAULTS.lowStockAlertsEnabled,
      lowStockEmailAlertsEnabled:
        settings?.lowStockEmailAlertsEnabled ??
        SHOP_SETTINGS_DEFAULTS.lowStockEmailAlertsEnabled,
      nearExpiryAlertDays:
        settings?.nearExpiryAlertDays ?? SHOP_SETTINGS_DEFAULTS.nearExpiryAlertDays,
      expiryAlertsEnabled:
        settings?.expiryAlertsEnabled ?? SHOP_SETTINGS_DEFAULTS.expiryAlertsEnabled,
      expiryEmailAlertsEnabled:
        settings?.expiryEmailAlertsEnabled ??
        SHOP_SETTINGS_DEFAULTS.expiryEmailAlertsEnabled,
      invoicePrefix:
        settings?.invoicePrefix ??
        SHOP_SETTINGS_DEFAULTS.invoicePrefix,
      allowPartialPayments:
        settings?.allowPartialPayments ??
        SHOP_SETTINGS_DEFAULTS.allowPartialPayments,
      allowHeldBills:
        settings?.allowHeldBills ?? SHOP_SETTINGS_DEFAULTS.allowHeldBills,
      allowStaffSalesReturn:
        settings?.allowStaffSalesReturn ??
        SHOP_SETTINGS_DEFAULTS.allowStaffSalesReturn,
      allowInventoryAdjustment:
        settings?.allowInventoryAdjustment ??
        SHOP_SETTINGS_DEFAULTS.allowInventoryAdjustment,
      allowDraftPurchases:
        settings?.allowDraftPurchases ??
        SHOP_SETTINGS_DEFAULTS.allowDraftPurchases,
      preferFefo: settings?.preferFefo ?? SHOP_SETTINGS_DEFAULTS.preferFefo,
      notificationChannels: {
        email: {
          enabled: emailChannelEnabled,
          recipientMode: "shop_admins",
          lowStockEnabled: emailChannelEnabled && lowStockExternalAlertsEnabled,
          expiryEnabled: emailChannelEnabled && expiryExternalAlertsEnabled,
        },
        whatsapp: {
          enabled: whatsappChannelEnabled,
          recipientMode: whatsappChannelEnabled
            ? "shop_admins"
            : whatsappProviderEnabled
              ? "provider_only"
              : "disabled",
          lowStockEnabled: whatsappChannelEnabled && lowStockExternalAlertsEnabled,
          expiryEnabled: whatsappChannelEnabled && expiryExternalAlertsEnabled,
        },
      },
      primaryAlertRecipients: recipients,
      ...(settings?.createdAt ? { createdAt: settings.createdAt } : {}),
      ...(settings?.updatedAt ? { updatedAt: settings.updatedAt } : {}),
    };
  }

  private assertEssentialAdminPermissions(
    role: UserRole,
    effectivePermissions: PermissionKey[],
  ) {
    if (role !== "admin") {
      return;
    }

    const missing = ESSENTIAL_ADMIN_PERMISSIONS.filter(
      (permission) => !effectivePermissions.includes(permission),
    );

    if (missing.length) {
      throw buildAppError(
        400,
        "SELF_LOCKOUT_BLOCKED",
        "This change would remove essential admin control permissions from your account.",
      );
    }
  }
}
