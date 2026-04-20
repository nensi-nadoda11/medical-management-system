import { and, asc, count, desc, eq } from "drizzle-orm";

import { db } from "../../db/client";
import {
  backupRecords,
  importJobRows,
  importJobs,
  users,
} from "../../db/schema";
import { getDbExecutor, type DbExecutor } from "../../shared/db/executor";
import type {
  ListBackupsQuery,
  ListImportJobsQuery,
} from "./data-management.validation";

export class DataManagementRepository {
  async createImportJob(
    payload: typeof importJobs.$inferInsert,
    executor?: DbExecutor,
  ) {
    const [job] = await getDbExecutor(executor)
      .insert(importJobs)
      .values(payload)
      .returning();

    return job ?? null;
  }

  async updateImportJob(
    jobId: string,
    payload: Partial<typeof importJobs.$inferInsert>,
    executor?: DbExecutor,
  ) {
    const [job] = await getDbExecutor(executor)
      .update(importJobs)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(importJobs.id, jobId))
      .returning();

    return job ?? null;
  }

  async replaceImportRows(
    jobId: string,
    rows: Array<typeof importJobRows.$inferInsert>,
    executor?: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    await database.delete(importJobRows).where(eq(importJobRows.jobId, jobId));

    if (!rows.length) {
      return [];
    }

    return database.insert(importJobRows).values(rows).returning();
  }

  async findImportJobById(shopId: string, jobId: string) {
    const [job] = await db
      .select({
        job: importJobs,
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
        },
      })
      .from(importJobs)
      .innerJoin(users, eq(importJobs.createdByUserId, users.id))
      .where(and(eq(importJobs.id, jobId), eq(importJobs.shopId, shopId)))
      .limit(1);

    return job ?? null;
  }

  async listImportRows(shopId: string, jobId: string) {
    return db
      .select()
      .from(importJobRows)
      .where(and(eq(importJobRows.jobId, jobId), eq(importJobRows.shopId, shopId)))
      .orderBy(asc(importJobRows.rowNumber), asc(importJobRows.id));
  }

  async listImportJobs(shopId: string, query: ListImportJobsQuery) {
    const filters = [eq(importJobs.shopId, shopId)];

    if (query.importType) {
      filters.push(eq(importJobs.importType, query.importType));
    }

    if (query.status) {
      filters.push(eq(importJobs.status, query.status));
    }

    return db
      .select({
        job: importJobs,
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
        },
      })
      .from(importJobs)
      .innerJoin(users, eq(importJobs.createdByUserId, users.id))
      .where(and(...filters))
      .orderBy(desc(importJobs.createdAt), desc(importJobs.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countImportJobs(shopId: string, query: Pick<ListImportJobsQuery, "importType" | "status">) {
    const filters = [eq(importJobs.shopId, shopId)];

    if (query.importType) {
      filters.push(eq(importJobs.importType, query.importType));
    }

    if (query.status) {
      filters.push(eq(importJobs.status, query.status));
    }

    const [result] = await db
      .select({ total: count() })
      .from(importJobs)
      .where(and(...filters));

    return result?.total ?? 0;
  }

  async createBackupRecord(
    payload: typeof backupRecords.$inferInsert,
    executor?: DbExecutor,
  ) {
    const [record] = await getDbExecutor(executor)
      .insert(backupRecords)
      .values(payload)
      .returning();

    return record ?? null;
  }

  async updateBackupRecord(
    backupId: string,
    payload: Partial<typeof backupRecords.$inferInsert>,
    executor?: DbExecutor,
  ) {
    const [record] = await getDbExecutor(executor)
      .update(backupRecords)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(backupRecords.id, backupId))
      .returning();

    return record ?? null;
  }

  async findBackupById(shopId: string, backupId: string) {
    const [record] = await db
      .select({
        backup: backupRecords,
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
        },
      })
      .from(backupRecords)
      .innerJoin(users, eq(backupRecords.createdByUserId, users.id))
      .where(and(eq(backupRecords.id, backupId), eq(backupRecords.shopId, shopId)))
      .limit(1);

    return record ?? null;
  }

  async listBackups(shopId: string, query: ListBackupsQuery) {
    const filters = [eq(backupRecords.shopId, shopId)];

    if (query.status) {
      filters.push(eq(backupRecords.status, query.status));
    }

    return db
      .select({
        backup: backupRecords,
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
        },
      })
      .from(backupRecords)
      .innerJoin(users, eq(backupRecords.createdByUserId, users.id))
      .where(and(...filters))
      .orderBy(desc(backupRecords.createdAt), desc(backupRecords.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countBackups(shopId: string, query: Pick<ListBackupsQuery, "status">) {
    const filters = [eq(backupRecords.shopId, shopId)];

    if (query.status) {
      filters.push(eq(backupRecords.status, query.status));
    }

    const [result] = await db
      .select({ total: count() })
      .from(backupRecords)
      .where(and(...filters));

    return result?.total ?? 0;
  }
}
