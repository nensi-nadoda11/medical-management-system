import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  inArray,
  like,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";

import {
  manufacturers,
  medicineBatches,
  medicineCategories,
  medicines,
  purchaseItems,
  stockAdjustments,
  stockTransactions,
} from "../../db/schema";
import { getDbExecutor, type DbExecutor } from "../../shared/db/executor";
import type {
  ListExpiryReportQuery,
  ListInventorySummaryQuery,
  ListStockTransactionsQuery,
} from "./inventory.validation";

const availableQuantityExpr = sql<number>`
  coalesce(
    sum(
      case
        when ${medicineBatches.quantityAvailable} > 0
          and ${medicineBatches.expiryDate} >= now()
        then ${medicineBatches.quantityAvailable}
        else 0
      end
    ),
    0
  )
`;

const onHandQuantityExpr = sql<number>`
  coalesce(
    sum(
      case
        when ${medicineBatches.quantityAvailable} > 0
        then ${medicineBatches.quantityAvailable}
        else 0
      end
    ),
    0
  )
`;

const activeBatchCountExpr = sql<number>`
  coalesce(
    sum(
      case
        when ${medicineBatches.quantityAvailable} > 0
          and ${medicineBatches.expiryDate} >= now()
        then 1
        else 0
      end
    ),
    0
  )
`;

const resolvedReorderLevelExpr = (defaultThreshold: number) => sql<number>`
  case
    when ${medicines.reorderLevel} > 0 then ${medicines.reorderLevel}
    else ${defaultThreshold}
  end
`;

const buildLowStockHavingExpr = (
  reorderLevelExpr: ReturnType<typeof resolvedReorderLevelExpr>,
) => sql`
  ${availableQuantityExpr} <= ${reorderLevelExpr}
  and not (${availableQuantityExpr} = 0 and ${onHandQuantityExpr} > 0)
`;

const inventoryBaseFilters = (
  shopId: string,
  branchId: string,
  query: ListInventorySummaryQuery,
) => {
  const filters = [eq(medicines.shopId, shopId)];

  if (query.search) {
    filters.push(
      or(
        sql`lower(${medicines.medicineNameNormalized}) like ${`%${query.search.toLowerCase()}%`}`,
        sql`lower(${medicines.genericNameNormalized}) like ${`%${query.search.toLowerCase()}%`}`,
        like(medicines.barcode, `%${query.search}%`),
      )!,
    );
  }

  if (query.categoryId) {
    filters.push(eq(medicines.categoryId, query.categoryId));
  }

  if (query.manufacturerId) {
    filters.push(eq(medicines.manufacturerId, query.manufacturerId));
  }

  if (query.medicineStatus) {
    filters.push(eq(medicines.status, query.medicineStatus));
  }

  if (query.batchStatus) {
    const batchStatusCondition =
      query.batchStatus === "expired"
        ? and(
            eq(medicineBatches.shopId, shopId),
            eq(medicineBatches.branchId, branchId),
            eq(medicineBatches.medicineId, medicines.id),
            ne(medicineBatches.quantityAvailable, 0),
            lte(medicineBatches.expiryDate, new Date()),
          )
        : query.batchStatus === "exhausted"
          ? and(
              eq(medicineBatches.shopId, shopId),
              eq(medicineBatches.branchId, branchId),
              eq(medicineBatches.medicineId, medicines.id),
              eq(medicineBatches.quantityAvailable, 0),
            )
          : and(
              eq(medicineBatches.shopId, shopId),
              eq(medicineBatches.branchId, branchId),
              eq(medicineBatches.medicineId, medicines.id),
              gte(medicineBatches.expiryDate, new Date()),
              sql`${medicineBatches.quantityAvailable} > 0`,
            );

    filters.push(
      exists(
        getDbExecutor()
          .select({ id: medicineBatches.id })
          .from(medicineBatches)
          .where(batchStatusCondition),
      ),
    );
  }

  return and(...filters);
};

export class InventoryRepository {
  async syncBatchStatuses(
    shopId: string,
    branchIdOrExecutor?: string | DbExecutor,
    executor?: DbExecutor,
  ) {
    const branchId =
      typeof branchIdOrExecutor === "string" ? branchIdOrExecutor : undefined;
    const database = getDbExecutor(
      typeof branchIdOrExecutor === "string" ? executor : branchIdOrExecutor,
    );
    const now = new Date();

    await database
      .update(medicineBatches)
      .set({
        status: "expired",
        updatedAt: now,
      })
      .where(
        and(
          eq(medicineBatches.shopId, shopId),
          ...(branchId ? [eq(medicineBatches.branchId, branchId)] : []),
          sql`${medicineBatches.quantityAvailable} > 0`,
          lte(medicineBatches.expiryDate, now),
          ne(medicineBatches.status, "expired"),
        ),
      );

    await database
      .update(medicineBatches)
      .set({
        status: "exhausted",
        updatedAt: now,
      })
      .where(
        and(
          eq(medicineBatches.shopId, shopId),
          ...(branchId ? [eq(medicineBatches.branchId, branchId)] : []),
          eq(medicineBatches.quantityAvailable, 0),
          ne(medicineBatches.status, "exhausted"),
        ),
      );

    await database
      .update(medicineBatches)
      .set({
        status: "active",
        updatedAt: now,
      })
      .where(
        and(
          eq(medicineBatches.shopId, shopId),
          ...(branchId ? [eq(medicineBatches.branchId, branchId)] : []),
          sql`${medicineBatches.quantityAvailable} > 0`,
          gte(medicineBatches.expiryDate, now),
          ne(medicineBatches.status, "active"),
        ),
      );
  }

  async upsertPurchaseBatch(
    input: {
      shopId: string;
      branchId: string;
      medicineId: string;
      batchNumber: string;
      batchNumberNormalized: string;
      expiryDate: Date;
      purchaseRate: string;
      saleRate: string;
      mrp: string;
      gstPercent: number;
      quantityReceived: number;
      quantityAvailable: number;
      status: "active" | "exhausted" | "expired";
    },
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const now = new Date();
    const [batch] = await database
      .insert(medicineBatches)
      .values({
        ...input,
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
          batchNumber: input.batchNumber,
          purchaseRate: input.purchaseRate,
          saleRate: input.saleRate,
          mrp: input.mrp,
          gstPercent: input.gstPercent,
          quantityReceived: sql`${medicineBatches.quantityReceived} + ${input.quantityReceived}`,
          quantityAvailable: sql`${medicineBatches.quantityAvailable} + ${input.quantityAvailable}`,
          status: input.status,
          updatedAt: now,
        },
      })
      .returning();

    if (!batch) {
      throw new Error("Failed to upsert medicine batch.");
    }

    return batch;
  }

  async findBatchById(
    shopId: string,
    branchId: string | undefined,
    batchId: string,
    executor?: DbExecutor,
  ) {
    const [batch] = await getDbExecutor(executor)
      .select()
      .from(medicineBatches)
      .where(
        and(
          eq(medicineBatches.id, batchId),
          eq(medicineBatches.shopId, shopId),
          ...(branchId ? [eq(medicineBatches.branchId, branchId)] : []),
        ),
      )
      .limit(1);

    return batch ?? null;
  }

  async changeBatchQuantity(
    input: {
      batchId: string;
      shopId: string;
      branchId?: string;
      quantityDelta: number;
      nextStatus: "active" | "exhausted" | "expired";
    },
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const filters = [
      eq(medicineBatches.id, input.batchId),
      eq(medicineBatches.shopId, input.shopId),
      ...(input.branchId ? [eq(medicineBatches.branchId, input.branchId)] : []),
    ];

    if (input.quantityDelta < 0) {
      filters.push(gte(medicineBatches.quantityAvailable, Math.abs(input.quantityDelta)));
    }

    const [batch] = await database
      .update(medicineBatches)
      .set({
        quantityAvailable: sql`${medicineBatches.quantityAvailable} + ${input.quantityDelta}`,
        status: input.nextStatus,
        updatedAt: new Date(),
      })
      .where(and(...filters))
      .returning();

    return batch ?? null;
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

  async createStockAdjustment(
    payload: typeof stockAdjustments.$inferInsert,
    executor: DbExecutor,
  ) {
    const [adjustment] = await getDbExecutor(executor)
      .insert(stockAdjustments)
      .values(payload)
      .returning();

    return adjustment ?? null;
  }

  async getMedicineStockSnapshot(
    shopId: string,
    branchId: string,
    medicineId: string,
    executor?: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [snapshot] = await database
      .select({
        medicine: medicines,
        availableQuantity: availableQuantityExpr,
      })
      .from(medicines)
      .leftJoin(
        medicineBatches,
        and(
          eq(medicineBatches.shopId, shopId),
          eq(medicineBatches.branchId, branchId),
          eq(medicineBatches.medicineId, medicines.id),
        ),
      )
      .where(and(eq(medicines.shopId, shopId), eq(medicines.id, medicineId)))
      .groupBy(medicines.id);

    return snapshot ?? null;
  }

  async listInventorySummary(
    shopId: string,
    branchId: string,
    query: ListInventorySummaryQuery,
    defaultThreshold: number,
  ) {
    const reorderLevelExpr = resolvedReorderLevelExpr(defaultThreshold);
    const orderBy =
      query.sortBy === "availableQuantity"
        ? query.sortOrder === "asc"
          ? asc(availableQuantityExpr)
          : desc(availableQuantityExpr)
        : query.sortBy === "reorderLevel"
          ? query.sortOrder === "asc"
            ? asc(reorderLevelExpr)
            : desc(reorderLevelExpr)
          : query.sortBy === "updatedAt"
            ? query.sortOrder === "asc"
              ? asc(medicines.updatedAt)
              : desc(medicines.updatedAt)
            : query.sortOrder === "asc"
              ? asc(medicines.medicineNameNormalized)
              : desc(medicines.medicineNameNormalized);

    const summaryQuery = getDbExecutor()
      .select({
        medicine: medicines,
        category: {
          id: medicineCategories.id,
          name: medicineCategories.name,
        },
        manufacturer: {
          id: manufacturers.id,
          name: manufacturers.name,
        },
        availableQuantity: availableQuantityExpr,
        onHandQuantity: onHandQuantityExpr.as("on_hand_quantity"),
        activeBatchCount: activeBatchCountExpr,
        effectiveReorderLevel: reorderLevelExpr,
      })
      .from(medicines)
      .innerJoin(medicineCategories, eq(medicines.categoryId, medicineCategories.id))
      .innerJoin(manufacturers, eq(medicines.manufacturerId, manufacturers.id))
      .leftJoin(
        medicineBatches,
        and(
          eq(medicineBatches.shopId, shopId),
          eq(medicineBatches.branchId, branchId),
          eq(medicineBatches.medicineId, medicines.id),
        ),
      )
      .where(inventoryBaseFilters(shopId, branchId, query))
      .groupBy(medicines.id, medicineCategories.id, manufacturers.id);

    if (query.lowStockOnly) {
      return summaryQuery
        .having(buildLowStockHavingExpr(reorderLevelExpr))
        .orderBy(orderBy, asc(medicines.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
    }

    return summaryQuery
      .orderBy(orderBy, asc(medicines.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countInventorySummary(
    shopId: string,
    branchId: string,
    query: ListInventorySummaryQuery,
    defaultThreshold: number,
  ) {
    const reorderLevelExpr = resolvedReorderLevelExpr(defaultThreshold);
    const groupedQuery = getDbExecutor()
      .select({ medicineId: medicines.id })
      .from(medicines)
      .leftJoin(
        medicineBatches,
        and(
          eq(medicineBatches.shopId, shopId),
          eq(medicineBatches.branchId, branchId),
          eq(medicineBatches.medicineId, medicines.id),
        ),
      )
      .where(inventoryBaseFilters(shopId, branchId, query))
      .groupBy(medicines.id, medicines.reorderLevel);

    const groupedSubquery = (query.lowStockOnly
      ? groupedQuery.having(buildLowStockHavingExpr(reorderLevelExpr))
      : groupedQuery
    ).as("inventory_summary");
    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(groupedSubquery);

    return result?.total ?? 0;
  }

  async getInventoryMedicineDetail(
    shopId: string,
    branchId: string,
    medicineId: string,
    defaultThreshold: number,
    executor?: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const reorderLevelExpr = resolvedReorderLevelExpr(defaultThreshold);
    const [medicineRecord] = await database
      .select({
        medicine: medicines,
        category: {
          id: medicineCategories.id,
          name: medicineCategories.name,
        },
        manufacturer: {
          id: manufacturers.id,
          name: manufacturers.name,
        },
        availableQuantity: availableQuantityExpr,
        onHandQuantity: onHandQuantityExpr.as("on_hand_quantity"),
        activeBatchCount: activeBatchCountExpr,
        effectiveReorderLevel: reorderLevelExpr,
      })
      .from(medicines)
      .innerJoin(medicineCategories, eq(medicines.categoryId, medicineCategories.id))
      .innerJoin(manufacturers, eq(medicines.manufacturerId, manufacturers.id))
      .leftJoin(
        medicineBatches,
        and(
          eq(medicineBatches.shopId, shopId),
          eq(medicineBatches.branchId, branchId),
          eq(medicineBatches.medicineId, medicines.id),
        ),
      )
      .where(and(eq(medicines.shopId, shopId), eq(medicines.id, medicineId)))
      .groupBy(medicines.id, medicineCategories.id, manufacturers.id)
      .limit(1);

    if (!medicineRecord) {
      return null;
    }

    const batches = await database
      .select()
      .from(medicineBatches)
      .where(
        and(
          eq(medicineBatches.shopId, shopId),
          eq(medicineBatches.branchId, branchId),
          eq(medicineBatches.medicineId, medicineId),
        ),
      )
      .orderBy(asc(medicineBatches.expiryDate), desc(medicineBatches.createdAt));

    return {
      ...medicineRecord,
      batches,
    };
  }

  async listStockTransactions(
    shopId: string,
    branchId: string,
    query: ListStockTransactionsQuery,
  ) {
    const filters = [
      eq(stockTransactions.shopId, shopId),
      eq(stockTransactions.branchId, branchId),
    ];

    if (query.medicineId) {
      filters.push(eq(stockTransactions.medicineId, query.medicineId));
    }

    if (query.batchId) {
      filters.push(eq(stockTransactions.batchId, query.batchId));
    }

    if (query.transactionType) {
      filters.push(eq(stockTransactions.transactionType, query.transactionType));
    }

    if (query.dateFrom) {
      filters.push(gte(stockTransactions.createdAt, query.dateFrom));
    }

    if (query.dateTo) {
      filters.push(lte(stockTransactions.createdAt, query.dateTo));
    }

    return getDbExecutor()
      .select({
        transaction: stockTransactions,
        medicine: {
          id: medicines.id,
          medicineName: medicines.medicineName,
          genericName: medicines.genericName,
        },
        batch: {
          id: medicineBatches.id,
          batchNumber: medicineBatches.batchNumber,
          expiryDate: medicineBatches.expiryDate,
          status: medicineBatches.status,
        },
      })
      .from(stockTransactions)
      .innerJoin(medicines, eq(stockTransactions.medicineId, medicines.id))
      .innerJoin(medicineBatches, eq(stockTransactions.batchId, medicineBatches.id))
      .where(and(...filters))
      .orderBy(
        query.sortOrder === "asc"
          ? asc(stockTransactions.createdAt)
          : desc(stockTransactions.createdAt),
        desc(stockTransactions.id),
      )
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countStockTransactions(
    shopId: string,
    branchId: string,
    query: ListStockTransactionsQuery,
  ) {
    const filters = [
      eq(stockTransactions.shopId, shopId),
      eq(stockTransactions.branchId, branchId),
    ];

    if (query.medicineId) {
      filters.push(eq(stockTransactions.medicineId, query.medicineId));
    }

    if (query.batchId) {
      filters.push(eq(stockTransactions.batchId, query.batchId));
    }

    if (query.transactionType) {
      filters.push(eq(stockTransactions.transactionType, query.transactionType));
    }

    if (query.dateFrom) {
      filters.push(gte(stockTransactions.createdAt, query.dateFrom));
    }

    if (query.dateTo) {
      filters.push(lte(stockTransactions.createdAt, query.dateTo));
    }

    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(stockTransactions)
      .where(and(...filters));

    return result?.total ?? 0;
  }

  async listExpiryReport(
    shopId: string,
    branchId: string,
    query: ListExpiryReportQuery,
  ) {
    const filters = [
      eq(medicineBatches.shopId, shopId),
      eq(medicineBatches.branchId, branchId),
    ];

    if (query.medicineId) {
      filters.push(eq(medicineBatches.medicineId, query.medicineId));
    }

    if (query.search) {
      filters.push(
        or(
          sql`lower(${medicines.medicineNameNormalized}) like ${`%${query.search.toLowerCase()}%`}`,
          sql`lower(${medicines.genericNameNormalized}) like ${`%${query.search.toLowerCase()}%`}`,
          sql`lower(${medicineBatches.batchNumberNormalized}) like ${`%${query.search.toLowerCase()}%`}`,
          like(medicines.barcode, `%${query.search}%`),
        )!,
      );
    }

    const now = new Date();
    const futureDate = new Date(now);
    if (query.expiryWindow !== "expired") {
      futureDate.setDate(
        futureDate.getDate() + Number.parseInt(query.expiryWindow, 10),
      );
      filters.push(gte(medicineBatches.expiryDate, now));
      filters.push(lte(medicineBatches.expiryDate, futureDate));
    } else {
      filters.push(lte(medicineBatches.expiryDate, now));
    }

    return getDbExecutor()
      .select({
        batch: medicineBatches,
        medicine: {
          id: medicines.id,
          medicineName: medicines.medicineName,
          genericName: medicines.genericName,
          reorderLevel: medicines.reorderLevel,
        },
      })
      .from(medicineBatches)
      .innerJoin(medicines, eq(medicineBatches.medicineId, medicines.id))
      .where(and(...filters))
      .orderBy(
        query.sortBy === "medicineName"
          ? asc(medicines.medicineNameNormalized)
          : asc(medicineBatches.expiryDate),
        asc(medicineBatches.id),
      )
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countExpiryReport(
    shopId: string,
    branchId: string,
    query: ListExpiryReportQuery,
  ) {
    const filters = [
      eq(medicineBatches.shopId, shopId),
      eq(medicineBatches.branchId, branchId),
    ];

    if (query.medicineId) {
      filters.push(eq(medicineBatches.medicineId, query.medicineId));
    }

    if (query.search) {
      filters.push(
        or(
          sql`lower(${medicines.medicineNameNormalized}) like ${`%${query.search.toLowerCase()}%`}`,
          sql`lower(${medicines.genericNameNormalized}) like ${`%${query.search.toLowerCase()}%`}`,
          sql`lower(${medicineBatches.batchNumberNormalized}) like ${`%${query.search.toLowerCase()}%`}`,
          like(medicines.barcode, `%${query.search}%`),
        )!,
      );
    }

    const now = new Date();
    const futureDate = new Date(now);
    if (query.expiryWindow !== "expired") {
      futureDate.setDate(
        futureDate.getDate() + Number.parseInt(query.expiryWindow, 10),
      );
      filters.push(gte(medicineBatches.expiryDate, now));
      filters.push(lte(medicineBatches.expiryDate, futureDate));
    } else {
      filters.push(lte(medicineBatches.expiryDate, now));
    }

    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(medicineBatches)
      .innerJoin(medicines, eq(medicineBatches.medicineId, medicines.id))
      .where(and(...filters));

    return result?.total ?? 0;
  }

  async getBatchesByIds(
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

  async deletePurchaseStockRecords(
    shopId: string,
    branchId: string,
    purchaseId: string,
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const purchaseItemRows = await database
      .select({
        id: purchaseItems.id,
        batchId: purchaseItems.medicineBatchId,
        medicineId: purchaseItems.medicineId,
      })
      .from(purchaseItems)
      .where(
        and(
          eq(purchaseItems.shopId, shopId),
          eq(purchaseItems.branchId, branchId),
          eq(purchaseItems.purchaseId, purchaseId),
        ),
      );

    const purchaseItemIds = purchaseItemRows.map((item) => item.id);

    if (!purchaseItemIds.length) {
      return {
        touchedMedicineIds: [],
      };
    }

    const transactions = await database
      .select()
      .from(stockTransactions)
      .where(
        and(
          eq(stockTransactions.shopId, shopId),
          eq(stockTransactions.branchId, branchId),
          eq(stockTransactions.referenceType, "purchase_item"),
          inArray(stockTransactions.referenceId, purchaseItemIds),
        ),
      );

    for (const tx of transactions) {
      await database
        .update(medicineBatches)
        .set({
          quantityReceived: sql`${medicineBatches.quantityReceived} - ${tx.quantityIn}`,
          quantityAvailable: sql`${medicineBatches.quantityAvailable} - ${tx.quantityIn}`,
          updatedAt: new Date(),
        })
        .where(eq(medicineBatches.id, tx.batchId));
    }

    await database
      .delete(stockTransactions)
      .where(
        and(
          eq(stockTransactions.shopId, shopId),
          eq(stockTransactions.branchId, branchId),
          eq(stockTransactions.referenceType, "purchase_item"),
          inArray(stockTransactions.referenceId, purchaseItemIds),
        ),
      );

    const touchedBatchIds = purchaseItemRows
      .map((item) => item.batchId)
      .filter((batchId): batchId is string => Boolean(batchId));

    if (touchedBatchIds.length) {
      await database
        .delete(medicineBatches)
        .where(
          and(
            eq(medicineBatches.shopId, shopId),
            eq(medicineBatches.branchId, branchId),
            inArray(medicineBatches.id, touchedBatchIds),
            eq(medicineBatches.quantityReceived, 0),
          ),
        );
    }

    await this.syncBatchStatuses(shopId, branchId, executor);

    return {
      touchedMedicineIds: [
        ...new Set(purchaseItemRows.map((item) => item.medicineId)),
      ],
    };
  }
}
