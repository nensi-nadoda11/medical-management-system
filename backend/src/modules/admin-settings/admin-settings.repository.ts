import { and, count, desc, eq, inArray } from "drizzle-orm";

import {
  adminAuditLogs,
  shopRolePermissionConfigs,
  shopRolePermissions,
  shops,
  shopSettings,
  userPermissionOverrides,
  users,
} from "../../db/schema";
import { getDbExecutor, type DbExecutor } from "../../shared/db/executor";
import type { UserRole } from "../auth/auth.types";
import type { PermissionKey } from "./admin-settings.permissions";
import type { ListAdminAuditLogsQuery } from "./admin-settings.validation";

export class AdminSettingsRepository {
  async findShopById(shopId: string, executor?: DbExecutor) {
    const [shop] = await getDbExecutor(executor)
      .select()
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1);

    return shop ?? null;
  }

  async findShopSettings(shopId: string, executor?: DbExecutor) {
    const [settings] = await getDbExecutor(executor)
      .select()
      .from(shopSettings)
      .where(eq(shopSettings.shopId, shopId))
      .limit(1);

    return settings ?? null;
  }

  async upsertShopSettings(
    payload: typeof shopSettings.$inferInsert,
    executor: DbExecutor,
  ) {
    const now = new Date();
    const [settings] = await getDbExecutor(executor)
      .insert(shopSettings)
      .values({
        ...payload,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: shopSettings.shopId,
        set: {
          ...payload,
          updatedAt: now,
        },
      })
      .returning();

    return settings ?? null;
  }

  async updateShopInvoicePrefix(
    shopId: string,
    invoicePrefix: string,
    executor: DbExecutor,
  ) {
    const [shop] = await getDbExecutor(executor)
      .update(shops)
      .set({
        invoicePrefix,
        updatedAt: new Date(),
      })
      .where(eq(shops.id, shopId))
      .returning();

    return shop ?? null;
  }

  async listRolePermissionConfigs(shopId: string, executor?: DbExecutor) {
    return getDbExecutor(executor)
      .select()
      .from(shopRolePermissionConfigs)
      .where(eq(shopRolePermissionConfigs.shopId, shopId));
  }

  async listRolePermissions(shopId: string, executor?: DbExecutor) {
    return getDbExecutor(executor)
      .select()
      .from(shopRolePermissions)
      .where(eq(shopRolePermissions.shopId, shopId));
  }

  async replaceRolePermissions(
    input: {
      shopId: string;
      role: UserRole;
      permissions: PermissionKey[];
      updatedByUserId: string;
    },
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const now = new Date();

    await database
      .insert(shopRolePermissionConfigs)
      .values({
        shopId: input.shopId,
        role: input.role,
        updatedByUserId: input.updatedByUserId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          shopRolePermissionConfigs.shopId,
          shopRolePermissionConfigs.role,
        ],
        set: {
          updatedByUserId: input.updatedByUserId,
          updatedAt: now,
        },
      });

    await database
      .delete(shopRolePermissions)
      .where(
        and(
          eq(shopRolePermissions.shopId, input.shopId),
          eq(shopRolePermissions.role, input.role),
        ),
      );

    if (!input.permissions.length) {
      return [];
    }

    return database
      .insert(shopRolePermissions)
      .values(
        input.permissions.map((permission) => ({
          shopId: input.shopId,
          role: input.role,
          permission,
          createdAt: now,
        })),
      )
      .returning();
  }

  async listUserPermissionOverrides(
    shopId: string,
    userId: string,
    executor?: DbExecutor,
  ) {
    return getDbExecutor(executor)
      .select()
      .from(userPermissionOverrides)
      .where(
        and(
          eq(userPermissionOverrides.shopId, shopId),
          eq(userPermissionOverrides.userId, userId),
        ),
      );
  }

  async replaceUserPermissionOverrides(
    input: {
      shopId: string;
      userId: string;
      allow: PermissionKey[];
      deny: PermissionKey[];
    },
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const now = new Date();

    await database
      .delete(userPermissionOverrides)
      .where(
        and(
          eq(userPermissionOverrides.shopId, input.shopId),
          eq(userPermissionOverrides.userId, input.userId),
        ),
      );

    const values = [
      ...input.allow.map((permission) => ({
        shopId: input.shopId,
        userId: input.userId,
        permission,
        effect: "allow" as const,
        createdAt: now,
      })),
      ...input.deny.map((permission) => ({
        shopId: input.shopId,
        userId: input.userId,
        permission,
        effect: "deny" as const,
        createdAt: now,
      })),
    ];

    if (!values.length) {
      return [];
    }

    return database.insert(userPermissionOverrides).values(values).returning();
  }

  async createAuditLog(
    payload: typeof adminAuditLogs.$inferInsert,
    executor: DbExecutor,
  ) {
    const [log] = await getDbExecutor(executor)
      .insert(adminAuditLogs)
      .values(payload)
      .returning();

    return log ?? null;
  }

  async listAuditLogs(shopId: string, query: ListAdminAuditLogsQuery) {
    return getDbExecutor()
      .select()
      .from(adminAuditLogs)
      .where(eq(adminAuditLogs.shopId, shopId))
      .orderBy(desc(adminAuditLogs.createdAt), desc(adminAuditLogs.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countAuditLogs(shopId: string) {
    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(adminAuditLogs)
      .where(eq(adminAuditLogs.shopId, shopId));

    return result?.total ?? 0;
  }

  async listUsersByIds(userIds: string[], executor?: DbExecutor) {
    if (!userIds.length) {
      return [];
    }

    return getDbExecutor(executor)
      .select({
        id: users.id,
        shopId: users.shopId,
        role: users.role,
        fullName: users.fullName,
        email: users.email,
        isActive: users.isActive,
      })
      .from(users)
      .where(inArray(users.id, userIds));
  }

  async listAdminEmailRecipients(shopId: string, executor?: DbExecutor) {
    return getDbExecutor(executor)
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        mobileNumber: users.mobileNumber,
      })
      .from(users)
      .where(
        and(
          eq(users.shopId, shopId),
          eq(users.role, "admin"),
          eq(users.isActive, true),
        ),
      );
  }
}
