import {
  and,
  asc,
  count,
  desc,
  eq,
  like,
  ne,
  or,
} from "drizzle-orm";

import { db } from "../../db/client";
import {
  manufacturers,
  medicineCategories,
  medicines,
} from "../../db/schema";
import type {
  ListMasterDataQuery,
  ListMedicinesQuery,
} from "./medicines.validation";

const buildCategoryFilters = (shopId: string, query: ListMasterDataQuery) => {
  const filters = [eq(medicineCategories.shopId, shopId)];

  if (query.status) {
    filters.push(eq(medicineCategories.status, query.status));
  }

  if (query.search) {
    filters.push(
      like(medicineCategories.normalizedName, `%${query.search}%`),
    );
  }

  return and(...filters);
};

const buildManufacturerFilters = (shopId: string, query: ListMasterDataQuery) => {
  const filters = [eq(manufacturers.shopId, shopId)];

  if (query.status) {
    filters.push(eq(manufacturers.status, query.status));
  }

  if (query.search) {
    filters.push(like(manufacturers.normalizedName, `%${query.search}%`));
  }

  return and(...filters);
};

const buildMedicineFilters = (shopId: string, query: ListMedicinesQuery) => {
  const filters = [eq(medicines.shopId, shopId)];

  if (query.search) {
    filters.push(
      or(
        like(medicines.medicineNameNormalized, `%${query.search}%`),
        like(medicines.genericNameNormalized, `%${query.search}%`),
      )!,
    );
  }

  if (query.categoryId) {
    filters.push(eq(medicines.categoryId, query.categoryId));
  }

  if (query.manufacturerId) {
    filters.push(eq(medicines.manufacturerId, query.manufacturerId));
  }

  if (query.status) {
    filters.push(eq(medicines.status, query.status));
  }

  return and(...filters);
};

export class MedicinesRepository {
  async listCategories(shopId: string, query: ListMasterDataQuery) {
    const orderBy =
      query.sortBy === "createdAt"
        ? [
            query.sortOrder === "asc"
              ? asc(medicineCategories.createdAt)
              : desc(medicineCategories.createdAt),
            asc(medicineCategories.id),
          ]
        : query.sortBy === "updatedAt"
          ? [
              query.sortOrder === "asc"
                ? asc(medicineCategories.updatedAt)
                : desc(medicineCategories.updatedAt),
              asc(medicineCategories.id),
            ]
          : [
              query.sortOrder === "asc"
                ? asc(medicineCategories.normalizedName)
                : desc(medicineCategories.normalizedName),
              asc(medicineCategories.id),
            ];

    return db
      .select()
      .from(medicineCategories)
      .where(buildCategoryFilters(shopId, query))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countCategories(shopId: string, query: ListMasterDataQuery) {
    const [result] = await db
      .select({ total: count() })
      .from(medicineCategories)
      .where(buildCategoryFilters(shopId, query));

    return result?.total ?? 0;
  }

  async findCategoryById(shopId: string, categoryId: string) {
    const [category] = await db
      .select()
      .from(medicineCategories)
      .where(
        and(
          eq(medicineCategories.id, categoryId),
          eq(medicineCategories.shopId, shopId),
        ),
      )
      .limit(1);

    return category ?? null;
  }

  async findCategoryByNormalizedName(
    shopId: string,
    normalizedName: string,
    excludeId?: string,
  ) {
    const filters = [
      eq(medicineCategories.shopId, shopId),
      eq(medicineCategories.normalizedName, normalizedName),
    ];

    if (excludeId) {
      filters.push(ne(medicineCategories.id, excludeId));
    }

    const [category] = await db
      .select()
      .from(medicineCategories)
      .where(and(...filters))
      .limit(1);

    return category ?? null;
  }

  async createCategory(payload: {
    shopId: string;
    name: string;
    normalizedName: string;
    description?: string;
    status: "active" | "inactive";
  }) {
    const [category] = await db
      .insert(medicineCategories)
      .values(payload)
      .returning();

    return category ?? null;
  }

  async updateCategory(
    categoryId: string,
    payload: Partial<{
      name: string;
      normalizedName: string;
      description: string | null;
      status: "active" | "inactive";
    }>,
  ) {
    const [category] = await db
      .update(medicineCategories)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(medicineCategories.id, categoryId))
      .returning();

    return category ?? null;
  }

  async listManufacturers(shopId: string, query: ListMasterDataQuery) {
    const orderBy =
      query.sortBy === "createdAt"
        ? [
            query.sortOrder === "asc"
              ? asc(manufacturers.createdAt)
              : desc(manufacturers.createdAt),
            asc(manufacturers.id),
          ]
        : query.sortBy === "updatedAt"
          ? [
              query.sortOrder === "asc"
                ? asc(manufacturers.updatedAt)
                : desc(manufacturers.updatedAt),
              asc(manufacturers.id),
            ]
          : [
              query.sortOrder === "asc"
                ? asc(manufacturers.normalizedName)
                : desc(manufacturers.normalizedName),
              asc(manufacturers.id),
            ];

    return db
      .select()
      .from(manufacturers)
      .where(buildManufacturerFilters(shopId, query))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countManufacturers(shopId: string, query: ListMasterDataQuery) {
    const [result] = await db
      .select({ total: count() })
      .from(manufacturers)
      .where(buildManufacturerFilters(shopId, query));

    return result?.total ?? 0;
  }

  async findManufacturerById(shopId: string, manufacturerId: string) {
    const [manufacturer] = await db
      .select()
      .from(manufacturers)
      .where(
        and(
          eq(manufacturers.id, manufacturerId),
          eq(manufacturers.shopId, shopId),
        ),
      )
      .limit(1);

    return manufacturer ?? null;
  }

  async findManufacturerByNormalizedName(
    shopId: string,
    normalizedName: string,
    excludeId?: string,
  ) {
    const filters = [
      eq(manufacturers.shopId, shopId),
      eq(manufacturers.normalizedName, normalizedName),
    ];

    if (excludeId) {
      filters.push(ne(manufacturers.id, excludeId));
    }

    const [manufacturer] = await db
      .select()
      .from(manufacturers)
      .where(and(...filters))
      .limit(1);

    return manufacturer ?? null;
  }

  async createManufacturer(payload: {
    shopId: string;
    name: string;
    normalizedName: string;
    status: "active" | "inactive";
  }) {
    const [manufacturer] = await db
      .insert(manufacturers)
      .values(payload)
      .returning();

    return manufacturer ?? null;
  }

  async updateManufacturer(
    manufacturerId: string,
    payload: Partial<{
      name: string;
      normalizedName: string;
      status: "active" | "inactive";
    }>,
  ) {
    const [manufacturer] = await db
      .update(manufacturers)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(manufacturers.id, manufacturerId))
      .returning();

    return manufacturer ?? null;
  }

  async listMedicines(shopId: string, query: ListMedicinesQuery) {
    const orderBy =
      query.sortBy === "createdAt"
        ? [
            query.sortOrder === "asc"
              ? asc(medicines.createdAt)
              : desc(medicines.createdAt),
            asc(medicines.id),
          ]
        : query.sortBy === "updatedAt"
          ? [
              query.sortOrder === "asc"
                ? asc(medicines.updatedAt)
                : desc(medicines.updatedAt),
              asc(medicines.id),
            ]
          : query.sortBy === "genericName"
            ? [
                query.sortOrder === "asc"
                  ? asc(medicines.genericNameNormalized)
                  : desc(medicines.genericNameNormalized),
                asc(medicines.id),
              ]
            : [
                query.sortOrder === "asc"
                  ? asc(medicines.medicineNameNormalized)
                  : desc(medicines.medicineNameNormalized),
                asc(medicines.id),
              ];

    return db
      .select({
        medicine: medicines,
        category: {
          id: medicineCategories.id,
          name: medicineCategories.name,
          status: medicineCategories.status,
        },
        manufacturer: {
          id: manufacturers.id,
          name: manufacturers.name,
          status: manufacturers.status,
        },
      })
      .from(medicines)
      .innerJoin(
        medicineCategories,
        eq(medicines.categoryId, medicineCategories.id),
      )
      .innerJoin(manufacturers, eq(medicines.manufacturerId, manufacturers.id))
      .where(buildMedicineFilters(shopId, query))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countMedicines(shopId: string, query: ListMedicinesQuery) {
    const [result] = await db
      .select({ total: count() })
      .from(medicines)
      .where(buildMedicineFilters(shopId, query));

    return result?.total ?? 0;
  }

  async findMedicineById(shopId: string, medicineId: string) {
    const [record] = await db
      .select({
        medicine: medicines,
        category: {
          id: medicineCategories.id,
          name: medicineCategories.name,
          status: medicineCategories.status,
        },
        manufacturer: {
          id: manufacturers.id,
          name: manufacturers.name,
          status: manufacturers.status,
        },
      })
      .from(medicines)
      .innerJoin(
        medicineCategories,
        eq(medicines.categoryId, medicineCategories.id),
      )
      .innerJoin(manufacturers, eq(medicines.manufacturerId, manufacturers.id))
      .where(and(eq(medicines.id, medicineId), eq(medicines.shopId, shopId)))
      .limit(1);

    return record ?? null;
  }

  async findMedicineDuplicate(
    shopId: string,
    input: {
      medicineNameNormalized: string;
      strengthNormalized: string;
      form: typeof medicines.$inferSelect["form"];
      manufacturerId: string;
      excludeId?: string;
    },
  ) {
    const filters = [
      eq(medicines.shopId, shopId),
      eq(medicines.medicineNameNormalized, input.medicineNameNormalized),
      eq(medicines.strengthNormalized, input.strengthNormalized),
      eq(medicines.form, input.form),
      eq(medicines.manufacturerId, input.manufacturerId),
    ];

    if (input.excludeId) {
      filters.push(ne(medicines.id, input.excludeId));
    }

    const [medicine] = await db
      .select({ id: medicines.id })
      .from(medicines)
      .where(and(...filters))
      .limit(1);

    return medicine ?? null;
  }

  async findMedicineByBarcode(
    shopId: string,
    barcode: string,
    excludeId?: string,
  ) {
    const filters = [eq(medicines.shopId, shopId), eq(medicines.barcode, barcode)];

    if (excludeId) {
      filters.push(ne(medicines.id, excludeId));
    }

    const [medicine] = await db
      .select({ id: medicines.id })
      .from(medicines)
      .where(and(...filters))
      .limit(1);

    return medicine ?? null;
  }

  async createMedicine(payload: typeof medicines.$inferInsert) {
    const [medicine] = await db.insert(medicines).values(payload).returning();
    return medicine ?? null;
  }

  async updateMedicine(
    medicineId: string,
    payload: Partial<typeof medicines.$inferInsert>,
  ) {
    const [medicine] = await db
      .update(medicines)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(medicines.id, medicineId))
      .returning();

    return medicine ?? null;
  }

  async updateMedicineStatus(
    medicineId: string,
    status: "active" | "inactive",
  ) {
    const [medicine] = await db
      .update(medicines)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(medicines.id, medicineId))
      .returning();

    return medicine ?? null;
  }
}
