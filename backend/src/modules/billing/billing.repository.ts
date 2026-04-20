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
  sales,
  shops,
  users,
} from "../../db/schema";
import { getDbExecutor, type DbExecutor } from "../../shared/db/executor";
import type {
  ListBillsQuery,
  SearchSellableMedicinesQuery,
} from "./billing.validation";

const todayStart = () => {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
};

const buildSaleFilters = (shopId: string, branchId: string, query: ListBillsQuery) => {
  const filters = [eq(sales.shopId, shopId), eq(sales.branchId, branchId)];

  if (query.search) {
    filters.push(
      or(
        like(sales.billNumberNormalized, `%${query.search}%`),
        sql`lower(coalesce(${sales.customerName}, '')) like ${`%${query.search}%`}`,
        like(sales.customerPhone, `%${query.search}%`),
      )!,
    );
  }

  if (query.status) {
    filters.push(eq(sales.status, query.status));
  }

  if (query.paymentStatus) {
    filters.push(eq(sales.paymentStatus, query.paymentStatus));
  }

  if (query.dateFrom) {
    filters.push(
      gte(sql`coalesce(${sales.completedAt}, ${sales.createdAt})`, query.dateFrom),
    );
  }

  if (query.dateTo) {
    filters.push(
      lte(sql`coalesce(${sales.completedAt}, ${sales.createdAt})`, query.dateTo),
    );
  }

  return and(...filters);
};

const buildSellableMedicineFilters = (
  shopId: string,
  branchId: string,
  query: SearchSellableMedicinesQuery,
) => {
  const filters = [
    eq(medicines.shopId, shopId),
    eq(medicines.status, "active"),
    sql`exists (
      select 1
      from ${medicineBatches}
      where ${medicineBatches.shopId} = ${shopId}
        and ${medicineBatches.branchId} = ${branchId}
        and ${medicineBatches.medicineId} = ${medicines.id}
        and ${medicineBatches.quantityAvailable} > 0
        and ${medicineBatches.expiryDate} >= ${todayStart()}
    )`,
  ];

  if (query.search) {
    filters.push(
      or(
        like(medicines.medicineNameNormalized, `%${query.search}%`),
        like(medicines.genericNameNormalized, `%${query.search}%`),
        like(medicines.brandNameNormalized, `%${query.search}%`),
        like(medicines.barcode, `%${query.search}%`),
      )!,
    );
  }

  return and(...filters);
};

const availableQuantityExpr = sql<number>`
  coalesce(
    sum(
      case
        when ${medicineBatches.quantityAvailable} > 0
          and ${medicineBatches.expiryDate} >= ${todayStart()}
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
          and ${medicineBatches.expiryDate} >= ${todayStart()}
        then 1
        else 0
      end
    ),
    0
  )
`;

const nextExpiryExpr = sql<Date | null>`
  min(
    case
      when ${medicineBatches.quantityAvailable} > 0
        and ${medicineBatches.expiryDate} >= ${todayStart()}
      then ${medicineBatches.expiryDate}
      else null
    end
  )
`;

export class BillingRepository {
  async getShopById(shopId: string, executor?: DbExecutor) {
    const [shop] = await getDbExecutor(executor)
      .select({
        id: shops.id,
        name: shops.name,
        invoicePrefix: shops.invoicePrefix,
      })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1);

    return shop ?? null;
  }

  async lockBillSequence(shopId: string, executor: DbExecutor) {
    await getDbExecutor(executor).execute(
      sql`select pg_advisory_xact_lock(hashtext(${`sales:${shopId}`}))`,
    );
  }

  async getNextBillSequence(shopId: string, branchId: string, executor: DbExecutor) {
    const [result] = await getDbExecutor(executor)
      .select({
        nextSequence: sql<number>`coalesce(max(${sales.billSequence}), 0) + 1`,
      })
      .from(sales)
      .where(and(eq(sales.shopId, shopId), eq(sales.branchId, branchId)));

    return Number(result?.nextSequence ?? 1);
  }

  async findSaleById(
    shopId: string,
    branchId: string,
    saleId: string,
    executor?: DbExecutor,
  ) {
    const [sale] = await getDbExecutor(executor)
      .select()
      .from(sales)
      .where(
        and(eq(sales.id, saleId), eq(sales.shopId, shopId), eq(sales.branchId, branchId))
      )
      .limit(1);

    return sale ?? null;
  }

  async findSaleDetailById(
    shopId: string,
    branchId: string,
    saleId: string,
    executor?: DbExecutor,
  ) {
    const database = getDbExecutor(executor);

    const [saleRecord] = await database
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
      .where(
        and(eq(sales.id, saleId), eq(sales.shopId, shopId), eq(sales.branchId, branchId))
      )
      .limit(1);

    if (!saleRecord) {
      return null;
    }

    const [updatedBy] = await database
      .select({
        id: users.id,
        fullName: users.fullName,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, saleRecord.sale.updatedByUserId))
      .limit(1);

    const items = await database
      .select({
        item: saleItems,
        medicine: {
          id: medicines.id,
          medicineName: medicines.medicineName,
          genericName: medicines.genericName,
          form: medicines.form,
          unit: medicines.unit,
          prescriptionRequired: medicines.prescriptionRequired,
          status: medicines.status,
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
      .where(and(eq(saleItems.saleId, saleId), eq(saleItems.branchId, branchId)))
      .orderBy(asc(saleItems.createdAt), asc(saleItems.id));

    return {
      ...saleRecord,
      updatedBy: updatedBy ?? saleRecord.createdBy,
      items,
    };
  }

  async listSales(shopId: string, branchId: string, query: ListBillsQuery) {
    const orderBy =
      query.sortBy === "billNumber"
        ? [
            query.sortOrder === "asc"
              ? asc(sales.billNumberNormalized)
              : desc(sales.billNumberNormalized),
            desc(sales.id),
          ]
        : query.sortBy === "grandTotal"
          ? [
              query.sortOrder === "asc"
                ? asc(sales.grandTotal)
                : desc(sales.grandTotal),
              desc(sales.id),
            ]
          : query.sortBy === "completedAt"
            ? [
                query.sortOrder === "asc"
                  ? asc(sql`coalesce(${sales.completedAt}, ${sales.createdAt})`)
                  : desc(sql`coalesce(${sales.completedAt}, ${sales.createdAt})`),
                desc(sales.id),
              ]
            : [
                query.sortOrder === "asc"
                  ? asc(sales.createdAt)
                  : desc(sales.createdAt),
                desc(sales.id),
              ];

    return getDbExecutor()
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
      .where(buildSaleFilters(shopId, branchId, query))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countSales(shopId: string, branchId: string, query: ListBillsQuery) {
    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(sales)
      .where(buildSaleFilters(shopId, branchId, query));

    return result?.total ?? 0;
  }

  async createSale(
    payload: typeof sales.$inferInsert,
    items: Array<Omit<typeof saleItems.$inferInsert, "saleId" | "shopId" | "branchId">>,
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [sale] = await database.insert(sales).values(payload).returning();

    if (!sale) {
      throw new Error("Failed to create bill.");
    }

    const createdItems = items.length
      ? await database
          .insert(saleItems)
          .values(
            items.map((item) => ({
              ...item,
              saleId: sale.id,
              shopId: payload.shopId,
              branchId: payload.branchId,
            })),
          )
          .returning()
      : [];

    return {
      sale,
      items: createdItems,
    };
  }

  async updateSale(
    saleId: string,
    payload: Partial<typeof sales.$inferInsert>,
    executor: DbExecutor,
  ) {
    const [sale] = await getDbExecutor(executor)
      .update(sales)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(sales.id, saleId))
      .returning();

    return sale ?? null;
  }

  async replaceSaleItems(
    saleId: string,
    shopId: string,
    branchId: string,
    items: Array<Omit<typeof saleItems.$inferInsert, "saleId" | "shopId" | "branchId">>,
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    await database.delete(saleItems).where(eq(saleItems.saleId, saleId));

    if (!items.length) {
      return [];
    }

    return database
      .insert(saleItems)
      .values(
        items.map((item) => ({
            ...item,
            saleId,
            shopId,
            branchId,
          })),
      )
      .returning();
  }

  async listSaleItemsBySaleId(saleId: string, branchId: string, executor?: DbExecutor) {
    return getDbExecutor(executor)
      .select()
      .from(saleItems)
      .where(and(eq(saleItems.saleId, saleId), eq(saleItems.branchId, branchId)))
      .orderBy(asc(saleItems.createdAt), asc(saleItems.id));
  }

  async findMedicinesByIds(shopId: string, medicineIds: string[], executor?: DbExecutor) {
    if (!medicineIds.length) {
      return [];
    }

    return getDbExecutor(executor)
      .select()
      .from(medicines)
      .where(and(eq(medicines.shopId, shopId), inArray(medicines.id, medicineIds)));
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

  async listSellableBatchesByMedicineIds(
    shopId: string,
    branchId: string,
    medicineIds: string[],
    executor?: DbExecutor,
  ) {
    if (!medicineIds.length) {
      return [];
    }

    return getDbExecutor(executor)
      .select()
      .from(medicineBatches)
      .where(
        and(
          eq(medicineBatches.shopId, shopId),
          eq(medicineBatches.branchId, branchId),
          inArray(medicineBatches.medicineId, medicineIds),
          gte(medicineBatches.expiryDate, todayStart()),
          sql`${medicineBatches.quantityAvailable} > 0`,
        ),
      )
      .orderBy(
        asc(medicineBatches.medicineId),
        asc(medicineBatches.expiryDate),
        asc(medicineBatches.createdAt),
        asc(medicineBatches.id),
      );
  }

  async listSellableMedicines(
    shopId: string,
    branchId: string,
    query: SearchSellableMedicinesQuery,
  ) {
    const orderBy =
      query.sortBy === "availableQuantity"
        ? query.sortOrder === "asc"
          ? asc(availableQuantityExpr)
          : desc(availableQuantityExpr)
        : query.sortBy === "nextExpiryDate"
          ? query.sortOrder === "asc"
            ? asc(nextExpiryExpr)
            : desc(nextExpiryExpr)
          : query.sortOrder === "asc"
            ? asc(medicines.medicineNameNormalized)
            : desc(medicines.medicineNameNormalized);

    return getDbExecutor()
      .select({
        medicine: medicines,
        availableQuantity: availableQuantityExpr,
        activeBatchCount: activeBatchCountExpr,
        nextExpiryDate: nextExpiryExpr,
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
      .where(buildSellableMedicineFilters(shopId, branchId, query))
      .groupBy(medicines.id)
      .orderBy(orderBy, asc(medicines.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countSellableMedicines(
    shopId: string,
    branchId: string,
    query: SearchSellableMedicinesQuery,
  ) {
    const grouped = getDbExecutor()
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
      .where(buildSellableMedicineFilters(shopId, branchId, query))
      .groupBy(medicines.id)
      .as("sellable_medicines");

    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(grouped);

    return result?.total ?? 0;
  }
}
