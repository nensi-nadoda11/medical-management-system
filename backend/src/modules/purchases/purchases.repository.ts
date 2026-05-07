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
} from "drizzle-orm";

import {
  medicines,
  purchaseItems,
  purchases,
  supplierPaymentAllocations,
  suppliers,
} from "../../db/schema";
import { getDbExecutor, type DbExecutor } from "../../shared/db/executor";
import type { ListPurchasesQuery } from "./purchases.validation";

const buildPurchaseFilters = (
  shopId: string,
  branchId: string,
  query: ListPurchasesQuery,
) => {
  const filters = [eq(purchases.shopId, shopId), eq(purchases.branchId, branchId)];

  if (query.search) {
    filters.push(
      or(
        like(purchases.purchaseNumberNormalized, `%${query.search}%`),
        like(purchases.supplierInvoiceNumberNormalized, `%${query.search}%`),
      )!,
    );
  }

  if (query.supplierId) {
    filters.push(eq(purchases.supplierId, query.supplierId));
  }

  if (query.status) {
    filters.push(eq(purchases.status, query.status));
  }

  if (query.paymentStatus) {
    filters.push(eq(purchases.paymentStatus, query.paymentStatus));
  }

  if (query.dateFrom) {
    filters.push(gte(purchases.purchaseDate, query.dateFrom));
  }

  if (query.dateTo) {
    filters.push(lte(purchases.purchaseDate, query.dateTo));
  }

  return and(...filters);
};

export class PurchasesRepository {
  async findSupplierById(shopId: string, supplierId: string, executor?: DbExecutor) {
    const database = getDbExecutor(executor);
    const [supplier] = await database
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.shopId, shopId)))
      .limit(1);

    return supplier ?? null;
  }

  async findMedicinesByIds(shopId: string, medicineIds: string[], executor?: DbExecutor) {
    if (!medicineIds.length) {
      return [];
    }

    const database = getDbExecutor(executor);
    return database
      .select()
      .from(medicines)
      .where(
        and(eq(medicines.shopId, shopId), inArray(medicines.id, medicineIds)),
      );
  }

  async findPurchaseById(
    shopId: string,
    branchId: string,
    purchaseId: string,
    executor?: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [purchase] = await database
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.id, purchaseId),
          eq(purchases.shopId, shopId),
          eq(purchases.branchId, branchId),
        ),
      )
      .limit(1);

    return purchase ?? null;
  }

  async findPurchaseDetailById(
    shopId: string,
    branchId: string,
    purchaseId: string,
    executor?: DbExecutor,
  ) {
    const database = getDbExecutor(executor);

    const [purchaseRecord] = await database
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
      })
      .from(purchases)
      .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
      .where(
        and(
          eq(purchases.id, purchaseId),
          eq(purchases.shopId, shopId),
          eq(purchases.branchId, branchId),
        ),
      )
      .limit(1);

    if (!purchaseRecord) {
      return null;
    }

    const items = await database
      .select({
        item: purchaseItems,
        medicine: {
          id: medicines.id,
          medicineName: medicines.medicineName,
          genericName: medicines.genericName,
          form: medicines.form,
          unit: medicines.unit,
          reorderLevel: medicines.reorderLevel,
          status: medicines.status,
        },
      })
      .from(purchaseItems)
      .innerJoin(medicines, eq(purchaseItems.medicineId, medicines.id))
      .where(
        and(
          eq(purchaseItems.purchaseId, purchaseId),
          eq(purchaseItems.branchId, branchId),
        ),
      )
      .orderBy(asc(purchaseItems.createdAt), asc(purchaseItems.id));

    return {
      ...purchaseRecord,
      items,
    };
  }

  async findDuplicateSupplierInvoice(
    shopId: string,
    supplierId: string,
    supplierInvoiceNumberNormalized: string,
    excludePurchaseId?: string,
    executor?: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const filters = [
      eq(purchases.shopId, shopId),
      eq(purchases.supplierId, supplierId),
      eq(
        purchases.supplierInvoiceNumberNormalized,
        supplierInvoiceNumberNormalized,
      ),
    ];

    if (excludePurchaseId) {
      filters.push(ne(purchases.id, excludePurchaseId));
    }

    const [purchase] = await database
      .select({ id: purchases.id })
      .from(purchases)
      .where(and(...filters))
      .limit(1);

    return purchase ?? null;
  }

  async listPurchases(shopId: string, branchId: string, query: ListPurchasesQuery) {
    const orderBy =
      query.sortBy === "createdAt"
        ? [
            query.sortOrder === "asc"
              ? asc(purchases.createdAt)
              : desc(purchases.createdAt),
            desc(purchases.id),
          ]
        : query.sortBy === "grandTotal"
          ? [
              query.sortOrder === "asc"
                ? asc(purchases.grandTotal)
                : desc(purchases.grandTotal),
              desc(purchases.id),
            ]
          : query.sortBy === "purchaseNumber"
            ? [
                query.sortOrder === "asc"
                  ? asc(purchases.purchaseNumberNormalized)
                  : desc(purchases.purchaseNumberNormalized),
                desc(purchases.id),
              ]
            : [
                query.sortOrder === "asc"
                  ? asc(purchases.purchaseDate)
                  : desc(purchases.purchaseDate),
                desc(purchases.id),
              ];

    return getDbExecutor()
      .select({
        purchase: purchases,
        supplier: {
          id: suppliers.id,
          supplierName: suppliers.supplierName,
          companyName: suppliers.companyName,
          mobileNumber: suppliers.mobileNumber,
          status: suppliers.status,
        },
      })
      .from(purchases)
      .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
      .where(buildPurchaseFilters(shopId, branchId, query))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countPurchases(shopId: string, branchId: string, query: ListPurchasesQuery) {
    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(purchases)
      .where(buildPurchaseFilters(shopId, branchId, query));

    return result?.total ?? 0;
  }

  async createPurchase(
    payload: typeof purchases.$inferInsert,
    items: Array<
      Omit<typeof purchaseItems.$inferInsert, "purchaseId" | "shopId" | "branchId">
    >,
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [purchase] = await database.insert(purchases).values(payload).returning();

    if (!purchase) {
      throw new Error("Failed to create purchase.");
    }

    if (items.length) {
      await database.insert(purchaseItems).values(
        items.map((item) => ({
          ...item,
          purchaseId: purchase.id,
          shopId: payload.shopId,
          branchId: payload.branchId,
        })),
      );
    }

    return purchase;
  }

  async updatePurchase(
    purchaseId: string,
    payload: Partial<typeof purchases.$inferInsert>,
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [purchase] = await database
      .update(purchases)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(purchases.id, purchaseId))
      .returning();

    return purchase ?? null;
  }

  async replacePurchaseItems(
    purchaseId: string,
    shopId: string,
    branchId: string,
    items: Array<
      Omit<typeof purchaseItems.$inferInsert, "purchaseId" | "shopId" | "branchId">
    >,
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    await database.delete(purchaseItems).where(eq(purchaseItems.purchaseId, purchaseId));

    if (!items.length) {
      return;
    }

    await database.insert(purchaseItems).values(
      items.map((item) => ({
          ...item,
          purchaseId,
          shopId,
          branchId,
        })),
    );
  }

  async listPurchaseItemsByPurchaseId(
    purchaseId: string,
    branchId: string,
    executor?: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    return database
      .select()
      .from(purchaseItems)
      .where(
        and(
          eq(purchaseItems.purchaseId, purchaseId),
          eq(purchaseItems.branchId, branchId),
        ),
      )
      .orderBy(asc(purchaseItems.createdAt), asc(purchaseItems.id));
  }

  async countSupplierPaymentAllocationsByPurchaseId(
    shopId: string,
    purchaseId: string,
    executor?: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [result] = await database
      .select({ total: count() })
      .from(supplierPaymentAllocations)
      .where(
        and(
          eq(supplierPaymentAllocations.shopId, shopId),
          eq(supplierPaymentAllocations.purchaseId, purchaseId),
        ),
      );

    return result?.total ?? 0;
  }

  async assignPurchaseItemBatch(
    purchaseItemId: string,
    batchId: string,
    executor: DbExecutor,
  ) {
    await getDbExecutor(executor)
      .update(purchaseItems)
      .set({
        medicineBatchId: batchId,
        updatedAt: new Date(),
      })
      .where(eq(purchaseItems.id, purchaseItemId));
  }

  async deletePurchase(purchaseId: string, executor: DbExecutor) {
    const database = getDbExecutor(executor);
    await database.delete(purchases).where(eq(purchases.id, purchaseId));
  }
}
