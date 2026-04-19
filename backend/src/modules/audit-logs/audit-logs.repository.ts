import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { auditLogs, users } from "../../db/schema";
import { getDbExecutor, type DbExecutor } from "../../shared/db/executor";
import type {
  ListAuditLogsQuery,
  ListRecentActivityQuery,
} from "./audit-logs.validation";

const buildFilters = (shopId: string, query: Partial<ListAuditLogsQuery>) => {
  const filters = [eq(auditLogs.shopId, shopId)];

  if (query.module) {
    filters.push(eq(auditLogs.module, query.module));
  }

  if (query.action) {
    filters.push(eq(auditLogs.action, query.action));
  }

  if (query.actorUserId) {
    filters.push(eq(auditLogs.actorUserId, query.actorUserId));
  }

  if (query.severity) {
    filters.push(eq(auditLogs.severity, query.severity));
  }

  if (query.dateFrom) {
    filters.push(gte(auditLogs.createdAt, query.dateFrom));
  }

  if (query.dateTo) {
    filters.push(lte(auditLogs.createdAt, query.dateTo));
  }

  if (query.search) {
    filters.push(
      or(
        sql`lower(${auditLogs.title}) like ${`%${query.search.toLowerCase()}%`}`,
        sql`lower(${auditLogs.description}) like ${`%${query.search.toLowerCase()}%`}`,
        sql`lower(${auditLogs.entityId}) like ${`%${query.search.toLowerCase()}%`}`,
      )!,
    );
  }

  return and(...filters);
};

export class AuditLogsRepository {
  async createAuditLog(
    payload: typeof auditLogs.$inferInsert,
    executor?: DbExecutor,
  ) {
    const [record] = await getDbExecutor(executor)
      .insert(auditLogs)
      .values(payload)
      .returning();

    return record ?? null;
  }

  async listAuditLogs(shopId: string, query: ListAuditLogsQuery, executor?: DbExecutor) {
    return getDbExecutor(executor)
      .select({
        log: auditLogs,
        actor: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
        },
      })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(buildFilters(shopId, query))
      .orderBy(
        query.sortOrder === "asc"
          ? asc(auditLogs.createdAt)
          : desc(auditLogs.createdAt),
        query.sortOrder === "asc" ? asc(auditLogs.id) : desc(auditLogs.id),
      )
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countAuditLogs(shopId: string, query: ListAuditLogsQuery, executor?: DbExecutor) {
    const [result] = await getDbExecutor(executor)
      .select({ total: count() })
      .from(auditLogs)
      .where(buildFilters(shopId, query));

    return result?.total ?? 0;
  }

  async findAuditLogById(shopId: string, auditLogId: string, executor?: DbExecutor) {
    const [record] = await getDbExecutor(executor)
      .select({
        log: auditLogs,
        actor: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
        },
      })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(and(eq(auditLogs.shopId, shopId), eq(auditLogs.id, auditLogId)))
      .limit(1);

    return record ?? null;
  }

  async listRecentActivity(
    shopId: string,
    query: ListRecentActivityQuery,
    executor?: DbExecutor,
  ) {
    return getDbExecutor(executor)
      .select({
        log: auditLogs,
        actor: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
        },
      })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(eq(auditLogs.shopId, shopId))
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(query.limit);
  }
}
