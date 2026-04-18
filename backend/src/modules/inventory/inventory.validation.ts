import { z } from "zod";

import { collapseWhitespace } from "../../shared/utils/strings";

const INVENTORY_SORT_FIELDS = [
  "medicineName",
  "availableQuantity",
  "reorderLevel",
  "updatedAt",
] as const;
const LEDGER_SORT_FIELDS = ["createdAt"] as const;

const optionalSearch = z
  .union([z.string(), z.undefined()])
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    const trimmed = collapseWhitespace(value);
    return trimmed.length ? trimmed : undefined;
  })
  .refine(
    (value) => value === undefined || value.length <= 180,
    "Search must be 180 characters or fewer.",
  );

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const listInventorySummarySchema = z.object({
  query: paginationQuerySchema.extend({
    search: optionalSearch,
    categoryId: z.string().uuid().optional(),
    manufacturerId: z.string().uuid().optional(),
    lowStockOnly: z.coerce.boolean().optional(),
    medicineStatus: z.enum(["active", "inactive"]).optional(),
    batchStatus: z.enum(["active", "exhausted", "expired"]).optional(),
    sortBy: z.enum(INVENTORY_SORT_FIELDS).default("medicineName"),
  }),
});

export const getInventoryMedicineDetailSchema = z.object({
  params: z.object({
    medicineId: z.string().uuid(),
  }),
  query: z.object({
    includeTransactions: z.coerce.boolean().optional(),
  }),
});

export const listStockTransactionsSchema = z.object({
  query: paginationQuerySchema.extend({
    medicineId: z.string().uuid().optional(),
    batchId: z.string().uuid().optional(),
    transactionType: z
      .enum(["purchase_in", "sale_out", "adjustment_in", "adjustment_out"])
      .optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z.enum(LEDGER_SORT_FIELDS).default("createdAt"),
  }),
});

export const listLowStockSchema = z.object({
  query: paginationQuerySchema.extend({
    search: optionalSearch,
    categoryId: z.string().uuid().optional(),
    manufacturerId: z.string().uuid().optional(),
    sortBy: z
      .enum(["medicineName", "availableQuantity", "reorderLevel"])
      .default("availableQuantity"),
  }),
});

export const listExpiryReportSchema = z.object({
  query: paginationQuerySchema.extend({
    search: optionalSearch,
    medicineId: z.string().uuid().optional(),
    expiryWindow: z.enum(["expired", "30", "60", "90"]).default("30"),
    sortBy: z.enum(["expiryDate", "medicineName"]).default("expiryDate"),
  }),
});

export const createStockAdjustmentSchema = z.object({
  body: z.object({
    medicineId: z.string().uuid(),
    batchId: z.string().uuid(),
    adjustmentType: z.enum(["in", "out"]),
    quantity: z.coerce.number().int().min(1).max(1000000),
    reason: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .transform(collapseWhitespace),
    notes: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((value) => {
        if (value === null || value === undefined) {
          return undefined;
        }

        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
      })
      .refine(
        (value) => value === undefined || value.length <= 2000,
        "Notes must be 2000 characters or fewer.",
      ),
  }),
});

export type ListInventorySummaryQuery = z.infer<
  typeof listInventorySummarySchema
>["query"];
export type GetInventoryMedicineDetailQuery = z.infer<
  typeof getInventoryMedicineDetailSchema
>["query"];
export type ListStockTransactionsQuery = z.infer<
  typeof listStockTransactionsSchema
>["query"];
export type ListLowStockQuery = z.infer<typeof listLowStockSchema>["query"];
export type ListExpiryReportQuery = z.infer<typeof listExpiryReportSchema>["query"];
export type CreateStockAdjustmentInput = z.infer<
  typeof createStockAdjustmentSchema
>["body"];
