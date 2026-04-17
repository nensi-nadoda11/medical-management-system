import {
  and,
  asc,
  count,
  desc,
  eq,
  like,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { db } from "../../db/client";
import { suppliers } from "../../db/schema";
import type { ListSuppliersQuery } from "./suppliers.validation";

const buildSupplierFilters = (shopId: string, query: ListSuppliersQuery) => {
  const filters = [eq(suppliers.shopId, shopId)];

  if (query.status) {
    filters.push(eq(suppliers.status, query.status));
  }

  if (query.search) {
    const digits = query.search.replace(/\D/g, "");
    filters.push(
      or(
        like(suppliers.supplierNameNormalized, `%${query.search}%`),
        like(suppliers.mobileNumber, `%${digits || query.search}%`),
      )!,
    );
  }

  return and(...filters);
};

export class SuppliersRepository {
  async listSuppliers(shopId: string, query: ListSuppliersQuery) {
    const orderBy =
      query.sortBy === "createdAt"
        ? [
            query.sortOrder === "asc"
              ? asc(suppliers.createdAt)
              : desc(suppliers.createdAt),
            asc(suppliers.id),
          ]
        : query.sortBy === "updatedAt"
          ? [
              query.sortOrder === "asc"
                ? asc(suppliers.updatedAt)
                : desc(suppliers.updatedAt),
              asc(suppliers.id),
            ]
          : [
              query.sortOrder === "asc"
                ? asc(suppliers.supplierNameNormalized)
                : desc(suppliers.supplierNameNormalized),
              asc(suppliers.id),
            ];

    return db
      .select()
      .from(suppliers)
      .where(buildSupplierFilters(shopId, query))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countSuppliers(shopId: string, query: ListSuppliersQuery) {
    const [result] = await db
      .select({ total: count() })
      .from(suppliers)
      .where(buildSupplierFilters(shopId, query));

    return result?.total ?? 0;
  }

  async findSupplierById(shopId: string, supplierId: string) {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.shopId, shopId)))
      .limit(1);

    return supplier ?? null;
  }

  async findSupplierByMobile(
    shopId: string,
    mobileNumber: string,
    excludeId?: string,
  ) {
    const filters = [
      eq(suppliers.shopId, shopId),
      eq(suppliers.mobileNumber, mobileNumber),
    ];

    if (excludeId) {
      filters.push(ne(suppliers.id, excludeId));
    }

    const [supplier] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(...filters))
      .limit(1);

    return supplier ?? null;
  }

  async findSupplierByEmail(shopId: string, email: string, excludeId?: string) {
    const filters = [
      eq(suppliers.shopId, shopId),
      sql`lower(${suppliers.email}) = lower(${email})`,
    ];

    if (excludeId) {
      filters.push(ne(suppliers.id, excludeId));
    }

    const [supplier] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(...filters))
      .limit(1);

    return supplier ?? null;
  }

  async findSupplierByGst(
    shopId: string,
    gstNumber: string,
    excludeId?: string,
  ) {
    const filters = [eq(suppliers.shopId, shopId), eq(suppliers.gstNumber, gstNumber)];

    if (excludeId) {
      filters.push(ne(suppliers.id, excludeId));
    }

    const [supplier] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(...filters))
      .limit(1);

    return supplier ?? null;
  }

  async createSupplier(payload: typeof suppliers.$inferInsert) {
    const [supplier] = await db.insert(suppliers).values(payload).returning();
    return supplier ?? null;
  }

  async updateSupplier(
    supplierId: string,
    payload: Partial<typeof suppliers.$inferInsert>,
  ) {
    const [supplier] = await db
      .update(suppliers)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, supplierId))
      .returning();

    return supplier ?? null;
  }

  async updateSupplierStatus(
    supplierId: string,
    status: "active" | "inactive",
  ) {
    const [supplier] = await db
      .update(suppliers)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, supplierId))
      .returning();

    return supplier ?? null;
  }
}
