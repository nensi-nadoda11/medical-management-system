import { z } from "zod";

import { collapseWhitespace } from "../../shared/utils/strings";

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
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const dateRangeQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

const exportFormatSchema = z.enum(["xlsx", "pdf"]);

export const getDashboardSummarySchema = z.object({
  query: dateRangeQuerySchema,
});

export const listSalesReportSchema = z.object({
  query: paginationQuerySchema.merge(dateRangeQuerySchema).extend({
    search: optionalSearch,
    groupBy: z.enum(["day", "month"]).default("day"),
    paymentMethod: z
      .enum(["cash", "upi", "card", "bank_transfer", "split"])
      .optional(),
    sortBy: z
      .enum(["completedAt", "billNumber", "grandTotal"])
      .default("completedAt"),
  }),
});

export const exportSalesReportSchema = z.object({
  query: listSalesReportSchema.shape.query.extend({
    format: exportFormatSchema,
  }),
});

export const listProfitReportSchema = z.object({
  query: paginationQuerySchema.merge(dateRangeQuerySchema).extend({
    search: optionalSearch,
    groupBy: z.enum(["day", "month"]).default("day"),
    sortBy: z.enum(["completedAt", "revenue", "profit"]).default("completedAt"),
  }),
});

export const exportProfitReportSchema = z.object({
  query: listProfitReportSchema.shape.query.extend({
    format: exportFormatSchema,
  }),
});

export const listStockReportSchema = z.object({
  query: paginationQuerySchema.extend({
    search: optionalSearch,
    categoryId: z.string().uuid().optional(),
    manufacturerId: z.string().uuid().optional(),
    batchStatus: z.enum(["active", "exhausted", "expired"]).optional(),
    sortBy: z
      .enum(["medicineName", "expiryDate", "quantityAvailable", "stockValue"])
      .default("expiryDate"),
  }),
});

export const exportStockReportSchema = z.object({
  query: listStockReportSchema.shape.query.extend({
    format: exportFormatSchema,
  }),
});

export const listLowStockReportSchema = z.object({
  query: paginationQuerySchema.extend({
    search: optionalSearch,
    categoryId: z.string().uuid().optional(),
    manufacturerId: z.string().uuid().optional(),
    sortBy: z
      .enum(["medicineName", "availableQuantity", "reorderLevel", "shortage"])
      .default("shortage"),
  }),
});

export const exportLowStockReportSchema = z.object({
  query: listLowStockReportSchema.shape.query.extend({
    format: exportFormatSchema,
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

export const exportExpiryReportSchema = z.object({
  query: listExpiryReportSchema.shape.query.extend({
    format: exportFormatSchema,
  }),
});

export const listSupplierReportSchema = z.object({
  query: paginationQuerySchema.merge(dateRangeQuerySchema).extend({
    search: optionalSearch,
    supplierId: z.string().uuid().optional(),
    sortBy: z
      .enum(["supplierName", "totalPurchase", "totalDue", "purchaseCount"])
      .default("totalPurchase"),
  }),
});

export const exportSupplierReportSchema = z.object({
  query: listSupplierReportSchema.shape.query.extend({
    format: exportFormatSchema,
  }),
});

export type DashboardSummaryQuery = z.infer<
  typeof getDashboardSummarySchema
>["query"];
export type SalesReportQuery = z.infer<typeof listSalesReportSchema>["query"];
export type SalesReportExportQuery = z.infer<
  typeof exportSalesReportSchema
>["query"];
export type ProfitReportQuery = z.infer<typeof listProfitReportSchema>["query"];
export type ProfitReportExportQuery = z.infer<
  typeof exportProfitReportSchema
>["query"];
export type StockReportQuery = z.infer<typeof listStockReportSchema>["query"];
export type StockReportExportQuery = z.infer<
  typeof exportStockReportSchema
>["query"];
export type LowStockReportQuery = z.infer<
  typeof listLowStockReportSchema
>["query"];
export type LowStockReportExportQuery = z.infer<
  typeof exportLowStockReportSchema
>["query"];
export type ExpiryReportQuery = z.infer<typeof listExpiryReportSchema>["query"];
export type ExpiryReportExportQuery = z.infer<
  typeof exportExpiryReportSchema
>["query"];
export type SupplierReportQuery = z.infer<
  typeof listSupplierReportSchema
>["query"];
export type SupplierReportExportQuery = z.infer<
  typeof exportSupplierReportSchema
>["query"];
