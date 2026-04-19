import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  sql,
} from "drizzle-orm";

import {
  medicineBatches,
  medicines,
  saleItems,
  saleReturnItems,
  saleReturns,
  sales,
  shops,
  users,
} from "../../db/schema";
import { getDbExecutor, type DbExecutor } from "../../shared/db/executor";
import type { ListSalesReturnsQuery } from "./sales-returns.validation";

const buildSalesReturnFilters = (shopId: string, query: ListSalesReturnsQuery) => {
  const filters = [eq(saleReturns.shopId, shopId)];

  if (query.search) {
    filters.push(
      or(
        like(saleReturns.returnNumberNormalized, `%${query.search}%`),
        like(sales.billNumberNormalized, `%${query.search}%`),
        sql`lower(coalesce(${sales.customerName}, '')) like ${`%${query.search}%`}`,
        like(sales.customerPhone, `%${query.search}%`),
      )!,
    );
  }

  if (query.saleId) {
    filters.push(eq(saleReturns.saleId, query.saleId));
  }

  if (query.status) {
    filters.push(eq(saleReturns.status, query.status));
  }

  if (query.refundStatus) {
    filters.push(eq(saleReturns.refundStatus, query.refundStatus));
  }

  if (query.dateFrom) {
    filters.push(
      gte(
        sql`coalesce(${saleReturns.completedAt}, ${saleReturns.createdAt})`,
        query.dateFrom,
      ),
    );
  }

  if (query.dateTo) {
    filters.push(
      lte(
        sql`coalesce(${saleReturns.completedAt}, ${saleReturns.createdAt})`,
        query.dateTo,
      ),
    );
  }

  return and(...filters);
};

export class SalesReturnsRepository {
  async getShopById(shopId: string, executor?: DbExecutor) {
    const [shop] = await getDbExecutor(executor)
      .select({
        id: shops.id,
        invoicePrefix: shops.invoicePrefix,
      })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1);

    return shop ?? null;
  }

  async lockReturnSequence(shopId: string, executor: DbExecutor) {
    await getDbExecutor(executor).execute(
      sql`select pg_advisory_xact_lock(hashtext(${`sale_returns:${shopId}`}))`,
    );
  }

  async getNextReturnSequence(shopId: string, executor: DbExecutor) {
    const [result] = await getDbExecutor(executor)
      .select({
        nextSequence: sql<number>`coalesce(max(${saleReturns.returnSequence}), 0) + 1`,
      })
      .from(saleReturns)
      .where(eq(saleReturns.shopId, shopId));

    return Number(result?.nextSequence ?? 1);
  }

  async findSaleById(shopId: string, saleId: string, executor?: DbExecutor) {
    const [sale] = await getDbExecutor(executor)
      .select()
      .from(sales)
      .where(and(eq(sales.id, saleId), eq(sales.shopId, shopId)))
      .limit(1);

    return sale ?? null;
  }

  async findSaleWithCreatorById(shopId: string, saleId: string, executor?: DbExecutor) {
    const [record] = await getDbExecutor(executor)
      .select({
        sale: sales,
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(sales)
      .innerJoin(users, eq(sales.createdByUserId, users.id))
      .where(and(eq(sales.id, saleId), eq(sales.shopId, shopId)))
      .limit(1);

    return record ?? null;
  }

  async listSaleItemsWithRelationsBySaleId(
    shopId: string,
    saleId: string,
    executor?: DbExecutor,
  ) {
    return getDbExecutor(executor)
      .select({
        item: saleItems,
        medicine: {
          id: medicines.id,
          medicineName: medicines.medicineName,
          genericName: medicines.genericName,
          form: medicines.form,
          unit: medicines.unit,
        },
        batch: {
          id: medicineBatches.id,
          batchNumber: medicineBatches.batchNumber,
          expiryDate: medicineBatches.expiryDate,
          status: medicineBatches.status,
          quantityAvailable: medicineBatches.quantityAvailable,
        },
      })
      .from(saleItems)
      .innerJoin(medicines, eq(saleItems.medicineId, medicines.id))
      .innerJoin(medicineBatches, eq(saleItems.batchId, medicineBatches.id))
      .where(and(eq(saleItems.saleId, saleId), eq(saleItems.shopId, shopId)))
      .orderBy(asc(saleItems.createdAt), asc(saleItems.id));
  }

  async getCompletedReturnedQuantitiesBySaleItemIds(
    shopId: string,
    saleItemIds: string[],
    executor?: DbExecutor,
  ) {
    if (!saleItemIds.length) {
      return [];
    }

    return getDbExecutor(executor)
      .select({
        saleItemId: saleReturnItems.saleItemId,
        quantity: sql<number>`coalesce(sum(${saleReturnItems.quantity}), 0)`,
      })
      .from(saleReturnItems)
      .innerJoin(saleReturns, eq(saleReturnItems.returnId, saleReturns.id))
      .where(
        and(
          eq(saleReturns.shopId, shopId),
          eq(saleReturns.status, "completed"),
          inArray(saleReturnItems.saleItemId, saleItemIds),
        ),
      )
      .groupBy(saleReturnItems.saleItemId);
  }

  async findSalesReturnById(shopId: string, returnId: string, executor?: DbExecutor) {
    const [record] = await getDbExecutor(executor)
      .select()
      .from(saleReturns)
      .where(and(eq(saleReturns.id, returnId), eq(saleReturns.shopId, shopId)))
      .limit(1);

    return record ?? null;
  }

  async findSalesReturnDetailById(
    shopId: string,
    returnId: string,
    executor?: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [record] = await database
      .select({
        saleReturn: saleReturns,
        sale: sales,
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(saleReturns)
      .innerJoin(sales, eq(saleReturns.saleId, sales.id))
      .innerJoin(users, eq(saleReturns.createdByUserId, users.id))
      .where(and(eq(saleReturns.id, returnId), eq(saleReturns.shopId, shopId)))
      .limit(1);

    if (!record) {
      return null;
    }

    const completedBy = record.saleReturn.completedByUserId
      ? (
          await database
            .select({
              id: users.id,
              fullName: users.fullName,
              role: users.role,
            })
            .from(users)
            .where(eq(users.id, record.saleReturn.completedByUserId))
            .limit(1)
        )[0] ?? null
      : null;

    const items = await database
      .select({
        item: saleReturnItems,
        saleItem: saleItems,
        medicine: {
          id: medicines.id,
          medicineName: medicines.medicineName,
          genericName: medicines.genericName,
          form: medicines.form,
          unit: medicines.unit,
        },
        batch: {
          id: medicineBatches.id,
          batchNumber: medicineBatches.batchNumber,
          expiryDate: medicineBatches.expiryDate,
          status: medicineBatches.status,
          quantityAvailable: medicineBatches.quantityAvailable,
        },
      })
      .from(saleReturnItems)
      .innerJoin(saleItems, eq(saleReturnItems.saleItemId, saleItems.id))
      .innerJoin(medicines, eq(saleReturnItems.medicineId, medicines.id))
      .innerJoin(medicineBatches, eq(saleReturnItems.batchId, medicineBatches.id))
      .where(eq(saleReturnItems.returnId, returnId))
      .orderBy(asc(saleReturnItems.createdAt), asc(saleReturnItems.id));

    return {
      ...record,
      completedBy,
      items,
    };
  }

  async listSalesReturns(shopId: string, query: ListSalesReturnsQuery) {
    const orderBy =
      query.sortBy === "returnNumber"
        ? [
            query.sortOrder === "asc"
              ? asc(saleReturns.returnNumberNormalized)
              : desc(saleReturns.returnNumberNormalized),
            desc(saleReturns.id),
          ]
        : query.sortBy === "totalReturnAmount"
          ? [
              query.sortOrder === "asc"
                ? asc(saleReturns.totalReturnAmount)
                : desc(saleReturns.totalReturnAmount),
              desc(saleReturns.id),
            ]
          : query.sortBy === "completedAt"
            ? [
                query.sortOrder === "asc"
                  ? asc(sql`coalesce(${saleReturns.completedAt}, ${saleReturns.createdAt})`)
                  : desc(
                      sql`coalesce(${saleReturns.completedAt}, ${saleReturns.createdAt})`,
                    ),
                desc(saleReturns.id),
              ]
            : [
                query.sortOrder === "asc"
                  ? asc(saleReturns.createdAt)
                  : desc(saleReturns.createdAt),
                desc(saleReturns.id),
              ];

    return getDbExecutor()
      .select({
        saleReturn: saleReturns,
        sale: {
          id: sales.id,
          billNumber: sales.billNumber,
          customerId: sales.customerId,
          customerName: sales.customerName,
          customerPhone: sales.customerPhone,
          completedAt: sales.completedAt,
        },
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(saleReturns)
      .innerJoin(sales, eq(saleReturns.saleId, sales.id))
      .innerJoin(users, eq(saleReturns.createdByUserId, users.id))
      .where(buildSalesReturnFilters(shopId, query))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countSalesReturns(shopId: string, query: ListSalesReturnsQuery) {
    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(saleReturns)
      .innerJoin(sales, eq(saleReturns.saleId, sales.id))
      .where(buildSalesReturnFilters(shopId, query));

    return result?.total ?? 0;
  }

  async createSalesReturn(
    payload: typeof saleReturns.$inferInsert,
    items: Array<Omit<typeof saleReturnItems.$inferInsert, "returnId" | "shopId">>,
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [saleReturn] = await database.insert(saleReturns).values(payload).returning();

    if (!saleReturn) {
      throw new Error("Failed to create sales return.");
    }

    const createdItems = items.length
      ? await database
          .insert(saleReturnItems)
          .values(
            items.map((item) => ({
              ...item,
              returnId: saleReturn.id,
              shopId: payload.shopId,
            })),
          )
          .returning()
      : [];

    return {
      saleReturn,
      items: createdItems,
    };
  }

  async updateSalesReturn(
    returnId: string,
    payload: Partial<typeof saleReturns.$inferInsert>,
    executor: DbExecutor,
  ) {
    const [saleReturn] = await getDbExecutor(executor)
      .update(saleReturns)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(saleReturns.id, returnId))
      .returning();

    return saleReturn ?? null;
  }

  async replaceSalesReturnItems(
    returnId: string,
    shopId: string,
    items: Array<Omit<typeof saleReturnItems.$inferInsert, "returnId" | "shopId">>,
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    await database.delete(saleReturnItems).where(eq(saleReturnItems.returnId, returnId));

    if (!items.length) {
      return [];
    }

    return database
      .insert(saleReturnItems)
      .values(
        items.map((item) => ({
          ...item,
          returnId,
          shopId,
        })),
      )
      .returning();
  }

  async listSalesReturnItemsByReturnId(returnId: string, executor?: DbExecutor) {
    return getDbExecutor(executor)
      .select()
      .from(saleReturnItems)
      .where(eq(saleReturnItems.returnId, returnId))
      .orderBy(asc(saleReturnItems.createdAt), asc(saleReturnItems.id));
  }
}
