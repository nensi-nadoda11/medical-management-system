import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  like,
  or,
  sql,
} from "drizzle-orm";

import {
  branches,
  medicineBatches,
  medicines,
  stockTransferItems,
  stockTransfers,
  stockTransactions,
  users,
} from "../../db/schema";
import { getDbExecutor, type DbExecutor } from "../../shared/db/executor";

export class StockTransfersRepository {
  async findBranchById(shopId: string, branchId: string, executor?: DbExecutor) {
    const [branch] = await getDbExecutor(executor)
      .select()
      .from(branches)
      .where(and(eq(branches.shopId, shopId), eq(branches.id, branchId)))
      .limit(1);

    return branch ?? null;
  }

  async listAvailableSourceBatches(
    shopId: string,
    branchId: string,
    search: string | undefined,
    pageSize: number,
    executor?: DbExecutor,
  ) {
    const filters = [
      eq(medicineBatches.shopId, shopId),
      eq(medicineBatches.branchId, branchId),
      gte(medicineBatches.quantityAvailable, 1),
    ];

    if (search) {
      filters.push(
        or(
          like(medicines.medicineNameNormalized, `%${search}%`),
          like(medicines.genericNameNormalized, `%${search}%`),
          like(medicineBatches.batchNumberNormalized, `%${search}%`),
        )!,
      );
    }

    return getDbExecutor(executor)
      .select({
        batch: medicineBatches,
        medicine: medicines,
      })
      .from(medicineBatches)
      .innerJoin(medicines, eq(medicineBatches.medicineId, medicines.id))
      .where(and(...filters))
      .orderBy(
        asc(medicines.medicineNameNormalized),
        asc(medicineBatches.expiryDate),
        asc(medicineBatches.id),
      )
      .limit(pageSize);
  }

  async findBatchesByIds(
    shopId: string,
    branchId: string,
    batchIds: string[],
    executor?: DbExecutor,
  ) {
    if (!batchIds.length) {
      return [];
    }

    return getDbExecutor(executor)
      .select()
      .from(medicineBatches)
      .where(
        and(
          eq(medicineBatches.shopId, shopId),
          eq(medicineBatches.branchId, branchId),
          inArray(medicineBatches.id, batchIds),
        ),
      );
  }

  async createTransfer(
    payload: typeof stockTransfers.$inferInsert,
    items: Array<Omit<typeof stockTransferItems.$inferInsert, "transferId" | "shopId">>,
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [transfer] = await database
      .insert(stockTransfers)
      .values(payload)
      .returning();

    if (!transfer) {
      throw new Error("Failed to create stock transfer.");
    }

    if (items.length) {
      await database.insert(stockTransferItems).values(
        items.map((item) => ({
          ...item,
          transferId: transfer.id,
          shopId: payload.shopId,
        })),
      );
    }

    return transfer;
  }

  async findTransferById(shopId: string, transferId: string, executor?: DbExecutor) {
    const [transfer] = await getDbExecutor(executor)
      .select()
      .from(stockTransfers)
      .where(and(eq(stockTransfers.shopId, shopId), eq(stockTransfers.id, transferId)))
      .limit(1);

    return transfer ?? null;
  }

  async updateTransfer(
    transferId: string,
    payload: Partial<typeof stockTransfers.$inferInsert>,
    executor: DbExecutor,
  ) {
    const [transfer] = await getDbExecutor(executor)
      .update(stockTransfers)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(stockTransfers.id, transferId))
      .returning();

    return transfer ?? null;
  }

  async listTransferItemsByTransferId(transferId: string, executor?: DbExecutor) {
    return getDbExecutor(executor)
      .select()
      .from(stockTransferItems)
      .where(eq(stockTransferItems.transferId, transferId))
      .orderBy(asc(stockTransferItems.createdAt), asc(stockTransferItems.id));
  }

  async updateTransferItemDestinationBatch(
    transferItemId: string,
    destinationBatchId: string,
    executor: DbExecutor,
  ) {
    await getDbExecutor(executor)
      .update(stockTransferItems)
      .set({
        destinationBatchId,
      })
      .where(eq(stockTransferItems.id, transferItemId));
  }

  async changeBatchQuantity(
    shopId: string,
    branchId: string,
    batchId: string,
    quantityDelta: number,
    nextStatus: "active" | "exhausted" | "expired",
    executor: DbExecutor,
  ) {
    const filters = [
      eq(medicineBatches.shopId, shopId),
      eq(medicineBatches.branchId, branchId),
      eq(medicineBatches.id, batchId),
    ];

    if (quantityDelta < 0) {
      filters.push(gte(medicineBatches.quantityAvailable, Math.abs(quantityDelta)));
    }

    const [batch] = await getDbExecutor(executor)
      .update(medicineBatches)
      .set({
        quantityAvailable: sql`${medicineBatches.quantityAvailable} + ${quantityDelta}`,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(and(...filters))
      .returning();

    return batch ?? null;
  }

  async upsertDestinationBatch(
    payload: typeof medicineBatches.$inferInsert,
    executor: DbExecutor,
  ) {
    const now = new Date();
    const [batch] = await getDbExecutor(executor)
      .insert(medicineBatches)
      .values({
        ...payload,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          medicineBatches.shopId,
          medicineBatches.branchId,
          medicineBatches.medicineId,
          medicineBatches.batchNumberNormalized,
          medicineBatches.expiryDate,
        ],
        set: {
          quantityReceived: sql`${medicineBatches.quantityReceived} + ${payload.quantityReceived}`,
          quantityAvailable: sql`${medicineBatches.quantityAvailable} + ${payload.quantityAvailable}`,
          purchaseRate: payload.purchaseRate,
          saleRate: payload.saleRate,
          mrp: payload.mrp,
          gstPercent: payload.gstPercent,
          status: payload.status,
          updatedAt: now,
        },
      })
      .returning();

    if (!batch) {
      throw new Error("Failed to upsert destination batch.");
    }

    return batch;
  }

  async createStockTransaction(
    payload: typeof stockTransactions.$inferInsert,
    executor: DbExecutor,
  ) {
    const [transaction] = await getDbExecutor(executor)
      .insert(stockTransactions)
      .values(payload)
      .returning();

    return transaction ?? null;
  }

  async listTransfers(shopId: string, page: number, pageSize: number, executor?: DbExecutor) {
    return getDbExecutor(executor)
      .select({
        transfer: stockTransfers,
        fromBranch: {
          id: sql<string>`${branches.id}`.as("from_branch_id"),
          name: sql<string>`${branches.name}`.as("from_branch_name"),
          code: sql<string>`${branches.code}`.as("from_branch_code"),
        },
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(stockTransfers)
      .innerJoin(branches, eq(stockTransfers.fromBranchId, branches.id))
      .innerJoin(users, eq(stockTransfers.createdByUserId, users.id))
      .where(eq(stockTransfers.shopId, shopId))
      .orderBy(desc(stockTransfers.createdAt), desc(stockTransfers.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
  }

  async countTransfers(shopId: string, executor?: DbExecutor) {
    const [result] = await getDbExecutor(executor)
      .select({ total: count() })
      .from(stockTransfers)
      .where(eq(stockTransfers.shopId, shopId));

    return result?.total ?? 0;
  }
}
