import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  or,
  sql,
} from "drizzle-orm";

import { notifications } from "../../db/schema";
import { getDbExecutor, type DbExecutor } from "../../shared/db/executor";

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

type NotificationListFilters = {
  allowedTypes?: NotificationType[];
  type?: NotificationType;
  severity?: NotificationSeverity;
  isRead?: boolean;
  isAcknowledged?: boolean;
  activeOnly?: boolean;
};

const buildFilters = (shopId: string, filters: NotificationListFilters) => {
  const conditions = [eq(notifications.shopId, shopId)];

  if (filters.allowedTypes?.length) {
    conditions.push(inArray(notifications.type, filters.allowedTypes));
  }

  if (filters.type) {
    conditions.push(eq(notifications.type, filters.type));
  }

  if (filters.severity) {
    conditions.push(eq(notifications.severity, filters.severity));
  }

  if (filters.isRead === true) {
    conditions.push(isNotNull(notifications.readAt));
  }

  if (filters.isRead === false) {
    conditions.push(isNull(notifications.readAt));
  }

  if (filters.isAcknowledged === true) {
    conditions.push(isNotNull(notifications.acknowledgedAt));
  }

  if (filters.isAcknowledged === false) {
    conditions.push(isNull(notifications.acknowledgedAt));
  }

  if (filters.activeOnly) {
    conditions.push(eq(notifications.isActive, true));
  }

  return and(...conditions);
};

export class NotificationsRepository {
  async lockCondition(
    shopId: string,
    conditionKey: string,
    executor: DbExecutor,
  ) {
    await getDbExecutor(executor).execute(
      sql`select pg_advisory_xact_lock(hashtext(${`notification:${shopId}:${conditionKey}`}))`,
    );
  }

  async createNotification(
    payload: typeof notifications.$inferInsert,
    executor?: DbExecutor,
  ) {
    const now = new Date();
    const [notification] = await getDbExecutor(executor)
      .insert(notifications)
      .values({
        ...payload,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return notification ?? null;
  }

  async updateNotification(
    id: string,
    shopId: string,
    payload: Partial<typeof notifications.$inferInsert>,
    executor?: DbExecutor,
  ) {
    const [notification] = await getDbExecutor(executor)
      .update(notifications)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(and(eq(notifications.id, id), eq(notifications.shopId, shopId)))
      .returning();

    return notification ?? null;
  }

  async findById(shopId: string, id: string, executor?: DbExecutor) {
    const [notification] = await getDbExecutor(executor)
      .select()
      .from(notifications)
      .where(and(eq(notifications.shopId, shopId), eq(notifications.id, id)))
      .limit(1);

    return notification ?? null;
  }

  async findActiveByConditionKey(
    shopId: string,
    conditionKey: string,
    executor?: DbExecutor,
  ) {
    const [notification] = await getDbExecutor(executor)
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.shopId, shopId),
          eq(notifications.conditionKey, conditionKey),
          eq(notifications.isActive, true),
        ),
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(1);

    return notification ?? null;
  }

  async listActiveByTypes(
    shopId: string,
    types: NotificationType[],
    executor?: DbExecutor,
  ) {
    if (!types.length) {
      return [];
    }

    return getDbExecutor(executor)
      .select({
        id: notifications.id,
        type: notifications.type,
        entityId: notifications.entityId,
        conditionKey: notifications.conditionKey,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.shopId, shopId),
          eq(notifications.isActive, true),
          inArray(notifications.type, types),
        ),
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id));
  }

  async listActiveConditionKeysByPrefix(
    shopId: string,
    prefix: string,
    executor?: DbExecutor,
  ) {
    return getDbExecutor(executor)
      .select({
        conditionKey: notifications.conditionKey,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.shopId, shopId),
          eq(notifications.isActive, true),
          like(notifications.conditionKey, `${prefix}%`),
        ),
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id));
  }

  async resolveActiveByConditionKeys(
    shopId: string,
    conditionKeys: string[],
    executor?: DbExecutor,
  ) {
    if (!conditionKeys.length) {
      return [];
    }

    return getDbExecutor(executor)
      .update(notifications)
      .set({
        isActive: false,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(notifications.shopId, shopId),
          eq(notifications.isActive, true),
          inArray(notifications.conditionKey, conditionKeys),
        ),
      )
      .returning();
  }

  async listNotifications(
    shopId: string,
    filters: NotificationListFilters & { page: number; pageSize: number },
    executor?: DbExecutor,
  ) {
    return getDbExecutor(executor)
      .select()
      .from(notifications)
      .where(buildFilters(shopId, filters))
      .orderBy(
        asc(sql`case when ${notifications.readAt} is null then 0 else 1 end`),
        desc(sql`case when ${notifications.isActive} then 1 else 0 end`),
        desc(notifications.createdAt),
        desc(notifications.id),
      )
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize);
  }

  async countNotifications(
    shopId: string,
    filters: NotificationListFilters,
    executor?: DbExecutor,
  ) {
    const [result] = await getDbExecutor(executor)
      .select({ total: count() })
      .from(notifications)
      .where(buildFilters(shopId, filters));

    return result?.total ?? 0;
  }

  async countUnread(
    shopId: string,
    allowedTypes: NotificationType[],
    executor?: DbExecutor,
  ) {
    if (!allowedTypes.length) {
      return 0;
    }

    const [result] = await getDbExecutor(executor)
      .select({ total: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.shopId, shopId),
          inArray(notifications.type, allowedTypes),
          isNull(notifications.readAt),
        ),
      );

    return result?.total ?? 0;
  }

  async countCriticalActive(
    shopId: string,
    allowedTypes: NotificationType[],
    executor?: DbExecutor,
  ) {
    if (!allowedTypes.length) {
      return 0;
    }

    const [result] = await getDbExecutor(executor)
      .select({ total: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.shopId, shopId),
          inArray(notifications.type, allowedTypes),
          eq(notifications.severity, "critical"),
          eq(notifications.isActive, true),
        ),
      );

    return result?.total ?? 0;
  }

  async listLatest(
    shopId: string,
    allowedTypes: NotificationType[],
    limit: number,
    executor?: DbExecutor,
  ) {
    if (!allowedTypes.length) {
      return [];
    }

    const freshnessCondition = or(
      isNull(notifications.readAt),
      gt(notifications.readAt, sql`now() - interval '24 hours'`),
    );

    return getDbExecutor(executor)
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.shopId, shopId),
          inArray(notifications.type, allowedTypes),
          freshnessCondition,
        ),
      )
      .orderBy(
        asc(sql`case when ${notifications.readAt} is null then 0 else 1 end`),
        desc(sql`case when ${notifications.isActive} then 1 else 0 end`),
        desc(notifications.createdAt),
        desc(notifications.id),
      )
      .limit(limit);
  }

  async markAsRead(shopId: string, id: string, executor?: DbExecutor) {
    const [notification] = await getDbExecutor(executor)
      .update(notifications)
      .set({
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(notifications.shopId, shopId),
          eq(notifications.id, id),
          isNull(notifications.readAt),
        ),
      )
      .returning();

    return notification ?? null;
  }

  async acknowledge(
    shopId: string,
    id: string,
    acknowledgedByUserId: string,
    executor?: DbExecutor,
  ) {
    const now = new Date();
    const [notification] = await getDbExecutor(executor)
      .update(notifications)
      .set({
        acknowledgedAt: now,
        acknowledgedByUserId,
        readAt: sql`coalesce(${notifications.readAt}, ${now})`,
        updatedAt: now,
      })
      .where(
        and(
          eq(notifications.shopId, shopId),
          eq(notifications.id, id),
          isNull(notifications.acknowledgedAt),
        ),
      )
      .returning();

    return notification ?? null;
  }

  async bulkMarkRead(
    shopId: string,
    allowedTypes: NotificationType[],
    ids?: string[],
    executor?: DbExecutor,
  ) {
    if (!allowedTypes.length) {
      return [];
    }

    const conditions = [
      eq(notifications.shopId, shopId),
      inArray(notifications.type, allowedTypes),
      isNull(notifications.readAt),
    ];

    if (ids?.length) {
      conditions.push(inArray(notifications.id, ids));
    }

    return getDbExecutor(executor)
      .update(notifications)
      .set({
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(...conditions))
      .returning();
  }

  async listPendingInventoryEmailNotifications(
    shopId: string,
    executor?: DbExecutor,
  ) {
    return getDbExecutor(executor)
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.shopId, shopId),
          eq(notifications.isActive, true),
          or(
            eq(notifications.emailStatus, "pending"),
            and(
              eq(notifications.emailStatus, "failed"),
              lt(notifications.retryCount, 3),
            ),
          ),
          inArray(notifications.type, [
            "low_stock",
            "supplier_reorder",
            "near_expiry",
            "expired_stock",
          ]),
        ),
      )
      .orderBy(asc(notifications.createdAt), asc(notifications.id))
      .limit(50);
  }
}
