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
  ne,
  or,
  sql,
} from "drizzle-orm";

import {
  medicineBatches,
  medicines,
  purchaseItems,
  purchaseReturnItems,
  purchaseReturns,
  purchases,
  shops,
  suppliers,
  users,
} from "../../db/schema";
import { getDbExecutor, type DbExecutor } from "../../shared/db/executor";
import type { ListPurchaseReturnsQuery } from "./purchase-returns.validation";

const buildPurchaseReturnFilters = (
  shopId: string,
  query: ListPurchaseReturnsQuery,
) => {
  const filters = [eq(purchaseReturns.shopId, shopId)];

  if (query.search) {
    filters.push(
      or(
        like(purchaseReturns.returnNumberNormalized, `%${query.search}%`),
        like(purchases.purchaseNumberNormalized, `%${query.search}%`),
        like(suppliers.supplierNameNormalized, `%${query.search}%`),
        like(suppliers.mobileNumber, `%${query.search}%`),
      )!,
    );
  }

  if (query.purchaseId) {
    filters.push(eq(purchaseReturns.purchaseId, query.purchaseId));
  }

  if (query.supplierId) {
    filters.push(eq(purchaseReturns.supplierId, query.supplierId));
  }

  if (query.status) {
    filters.push(eq(purchaseReturns.status, query.status));
  }

  if (query.dateFrom) {
    filters.push(
      gte(
        sql`coalesce(${purchaseReturns.completedAt}, ${purchaseReturns.createdAt})`,
        query.dateFrom,
      ),
    );
  }

  if (query.dateTo) {
    filters.push(
      lte(
        sql`coalesce(${purchaseReturns.completedAt}, ${purchaseReturns.createdAt})`,
        query.dateTo,
      ),
    );
  }

  return and(...filters);
};

export class PurchaseReturnsRepository {
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
      sql`select pg_advisory_xact_lock(hashtext(${`purchase_returns:${shopId}`}))`,
    );
  }

  async getNextReturnSequence(shopId: string, executor: DbExecutor) {
    const [result] = await getDbExecutor(executor)
      .select({
        nextSequence: sql<number>`coalesce(max(${purchaseReturns.returnSequence}), 0) + 1`,
      })
      .from(purchaseReturns)
      .where(eq(purchaseReturns.shopId, shopId));

    return Number(result?.nextSequence ?? 1);
  }

  async findPurchaseById(shopId: string, purchaseId: string, executor?: DbExecutor) {
    const [purchase] = await getDbExecutor(executor)
      .select()
      .from(purchases)
      .where(and(eq(purchases.id, purchaseId), eq(purchases.shopId, shopId)))
      .limit(1);

    return purchase ?? null;
  }

  async findPurchaseWithRelationsById(
    shopId: string,
    purchaseId: string,
    executor?: DbExecutor,
  ) {
    const [record] = await getDbExecutor(executor)
      .select({
        purchase: purchases,
        supplier: {
          id: suppliers.id,
          supplierName: suppliers.supplierName,
          companyName: suppliers.companyName,
          contactPerson: suppliers.contactPerson,
          mobileNumber: suppliers.mobileNumber,
          email: suppliers.email,
          status: suppliers.status,
        },
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(purchases)
      .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
      .innerJoin(users, eq(purchases.createdByUserId, users.id))
      .where(and(eq(purchases.id, purchaseId), eq(purchases.shopId, shopId)))
      .limit(1);

    return record ?? null;
  }

  async listPurchaseItemsWithRelationsByPurchaseId(
    shopId: string,
    purchaseId: string,
    executor?: DbExecutor,
  ) {
    return getDbExecutor(executor)
      .select({
        item: purchaseItems,
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
      .from(purchaseItems)
      .innerJoin(medicines, eq(purchaseItems.medicineId, medicines.id))
      .innerJoin(medicineBatches, eq(purchaseItems.medicineBatchId, medicineBatches.id))
      .where(and(eq(purchaseItems.purchaseId, purchaseId), eq(purchaseItems.shopId, shopId)))
      .orderBy(asc(purchaseItems.createdAt), asc(purchaseItems.id));
  }

  async getCompletedReturnedQuantitiesByPurchaseItemIds(
    shopId: string,
    purchaseItemIds: string[],
    executor?: DbExecutor,
  ) {
    if (!purchaseItemIds.length) {
      return [];
    }

    return getDbExecutor(executor)
      .select({
        purchaseItemId: purchaseReturnItems.purchaseItemId,
        quantity: sql<number>`coalesce(sum(${purchaseReturnItems.quantity}), 0)`,
      })
      .from(purchaseReturnItems)
      .innerJoin(purchaseReturns, eq(purchaseReturnItems.returnId, purchaseReturns.id))
      .where(
        and(
          eq(purchaseReturns.shopId, shopId),
          eq(purchaseReturns.status, "completed"),
          inArray(purchaseReturnItems.purchaseItemId, purchaseItemIds),
        ),
      )
      .groupBy(purchaseReturnItems.purchaseItemId);
  }

  async findPurchaseReturnById(
    shopId: string,
    returnId: string,
    executor?: DbExecutor,
  ) {
    const [record] = await getDbExecutor(executor)
      .select()
      .from(purchaseReturns)
      .where(and(eq(purchaseReturns.id, returnId), eq(purchaseReturns.shopId, shopId)))
      .limit(1);

    return record ?? null;
  }

  async findPurchaseReturnDetailById(
    shopId: string,
    returnId: string,
    executor?: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [record] = await database
      .select({
        purchaseReturn: purchaseReturns,
        purchase: purchases,
        supplier: {
          id: suppliers.id,
          supplierName: suppliers.supplierName,
          companyName: suppliers.companyName,
          contactPerson: suppliers.contactPerson,
          mobileNumber: suppliers.mobileNumber,
          email: suppliers.email,
          status: suppliers.status,
        },
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(purchaseReturns)
      .innerJoin(purchases, eq(purchaseReturns.purchaseId, purchases.id))
      .innerJoin(suppliers, eq(purchaseReturns.supplierId, suppliers.id))
      .innerJoin(users, eq(purchaseReturns.createdByUserId, users.id))
      .where(and(eq(purchaseReturns.id, returnId), eq(purchaseReturns.shopId, shopId)))
      .limit(1);

    if (!record) {
      return null;
    }

    const completedBy = record.purchaseReturn.completedByUserId
      ? (
          await database
            .select({
              id: users.id,
              fullName: users.fullName,
              role: users.role,
            })
            .from(users)
            .where(eq(users.id, record.purchaseReturn.completedByUserId))
            .limit(1)
        )[0] ?? null
      : null;

    const items = await database
      .select({
        item: purchaseReturnItems,
        purchaseItem: purchaseItems,
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
      .from(purchaseReturnItems)
      .innerJoin(purchaseItems, eq(purchaseReturnItems.purchaseItemId, purchaseItems.id))
      .innerJoin(medicines, eq(purchaseReturnItems.medicineId, medicines.id))
      .innerJoin(medicineBatches, eq(purchaseReturnItems.batchId, medicineBatches.id))
      .where(eq(purchaseReturnItems.returnId, returnId))
      .orderBy(asc(purchaseReturnItems.createdAt), asc(purchaseReturnItems.id));

    return {
      ...record,
      completedBy,
      items,
    };
  }

  async listPurchaseReturns(shopId: string, query: ListPurchaseReturnsQuery) {
    const orderBy =
      query.sortBy === "returnNumber"
        ? [
            query.sortOrder === "asc"
              ? asc(purchaseReturns.returnNumberNormalized)
              : desc(purchaseReturns.returnNumberNormalized),
            desc(purchaseReturns.id),
          ]
        : query.sortBy === "totalReturnAmount"
          ? [
              query.sortOrder === "asc"
                ? asc(purchaseReturns.totalReturnAmount)
                : desc(purchaseReturns.totalReturnAmount),
              desc(purchaseReturns.id),
            ]
          : query.sortBy === "completedAt"
            ? [
                query.sortOrder === "asc"
                  ? asc(
                      sql`coalesce(${purchaseReturns.completedAt}, ${purchaseReturns.createdAt})`,
                    )
                  : desc(
                      sql`coalesce(${purchaseReturns.completedAt}, ${purchaseReturns.createdAt})`,
                    ),
                desc(purchaseReturns.id),
              ]
            : [
                query.sortOrder === "asc"
                  ? asc(purchaseReturns.createdAt)
                  : desc(purchaseReturns.createdAt),
                desc(purchaseReturns.id),
              ];

    return getDbExecutor()
      .select({
        purchaseReturn: purchaseReturns,
        purchase: {
          id: purchases.id,
          purchaseNumber: purchases.purchaseNumber,
          purchaseDate: purchases.purchaseDate,
          status: purchases.status,
        },
        supplier: {
          id: suppliers.id,
          supplierName: suppliers.supplierName,
          companyName: suppliers.companyName,
          mobileNumber: suppliers.mobileNumber,
        },
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(purchaseReturns)
      .innerJoin(purchases, eq(purchaseReturns.purchaseId, purchases.id))
      .innerJoin(suppliers, eq(purchaseReturns.supplierId, suppliers.id))
      .innerJoin(users, eq(purchaseReturns.createdByUserId, users.id))
      .where(buildPurchaseReturnFilters(shopId, query))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countPurchaseReturns(shopId: string, query: ListPurchaseReturnsQuery) {
    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(purchaseReturns)
      .innerJoin(purchases, eq(purchaseReturns.purchaseId, purchases.id))
      .innerJoin(suppliers, eq(purchaseReturns.supplierId, suppliers.id))
      .where(buildPurchaseReturnFilters(shopId, query));

    return result?.total ?? 0;
  }

  async listPurchaseReturnHistoryByPurchaseId(
    shopId: string,
    purchaseId: string,
    executor?: DbExecutor,
  ) {
    return getDbExecutor(executor)
      .select({
        purchaseReturn: purchaseReturns,
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(purchaseReturns)
      .innerJoin(users, eq(purchaseReturns.createdByUserId, users.id))
      .where(
        and(
          eq(purchaseReturns.shopId, shopId),
          eq(purchaseReturns.purchaseId, purchaseId),
        ),
      )
      .orderBy(desc(purchaseReturns.createdAt), desc(purchaseReturns.id));
  }

  async createPurchaseReturn(
    payload: typeof purchaseReturns.$inferInsert,
    items: Array<
      Omit<typeof purchaseReturnItems.$inferInsert, "returnId" | "shopId">
    >,
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [purchaseReturn] = await database
      .insert(purchaseReturns)
      .values(payload)
      .returning();

    if (!purchaseReturn) {
      throw new Error("Failed to create purchase return.");
    }

    const createdItems = items.length
      ? await database
          .insert(purchaseReturnItems)
          .values(
            items.map((item) => ({
              ...item,
              returnId: purchaseReturn.id,
              shopId: payload.shopId,
            })),
          )
          .returning()
      : [];

    return {
      purchaseReturn,
      items: createdItems,
    };
  }

  async updatePurchaseReturn(
    returnId: string,
    payload: Partial<typeof purchaseReturns.$inferInsert>,
    executor: DbExecutor,
  ) {
    const [purchaseReturn] = await getDbExecutor(executor)
      .update(purchaseReturns)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(purchaseReturns.id, returnId))
      .returning();

    return purchaseReturn ?? null;
  }

  async replacePurchaseReturnItems(
    returnId: string,
    shopId: string,
    items: Array<
      Omit<typeof purchaseReturnItems.$inferInsert, "returnId" | "shopId">
    >,
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    await database
      .delete(purchaseReturnItems)
      .where(eq(purchaseReturnItems.returnId, returnId));

    if (!items.length) {
      return [];
    }

    return database
      .insert(purchaseReturnItems)
      .values(
        items.map((item) => ({
          ...item,
          returnId,
          shopId,
        })),
      )
      .returning();
  }

  async listPurchaseReturnItemsByReturnId(
    returnId: string,
    executor?: DbExecutor,
  ) {
    return getDbExecutor(executor)
      .select()
      .from(purchaseReturnItems)
      .where(eq(purchaseReturnItems.returnId, returnId))
      .orderBy(asc(purchaseReturnItems.createdAt), asc(purchaseReturnItems.id));
  }

  async countPurchaseReturnsByPurchaseId(
    shopId: string,
    purchaseId: string,
    executor?: DbExecutor,
  ) {
    const [result] = await getDbExecutor(executor)
      .select({ total: count() })
      .from(purchaseReturns)
      .where(
        and(
          eq(purchaseReturns.shopId, shopId),
          eq(purchaseReturns.purchaseId, purchaseId),
          ne(purchaseReturns.status, "cancelled"),
        ),
      );

    return result?.total ?? 0;
  }
}
