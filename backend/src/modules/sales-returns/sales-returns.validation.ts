import { z } from "zod";

import { collapseWhitespace } from "../../shared/utils/strings";

const SALES_RETURN_SORT_FIELDS = [
  "createdAt",
  "completedAt",
  "returnNumber",
  "totalReturnAmount",
] as const;

const optionalTrimmedString = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) {
        return undefined;
      }

      const trimmed = collapseWhitespace(value);
      return trimmed.length ? trimmed : undefined;
    })
    .refine(
      (value) => value === undefined || value.length <= max,
      `Must be ${max} characters or fewer.`,
    );

const nonEmptyTrimmedString = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .transform(collapseWhitespace);

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

const moneySchema = z.coerce.number().min(0).max(999999999.99);

const refundMethodSchema = z.enum([
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "adjustment",
]);

const refundStatusSchema = z.enum(["pending", "processed", "not_required"]);

const salesReturnItemSchema = z.object({
  saleItemId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(1000000),
  reason: nonEmptyTrimmedString(2, 160),
  notes: optionalTrimmedString(500),
});

const salesReturnBodySchema = z.object({
  refundAmount: moneySchema.default(0),
  refundMethod: refundMethodSchema.optional(),
  refundStatus: refundStatusSchema.default("not_required"),
  notes: optionalTrimmedString(2000),
  items: z.array(salesReturnItemSchema).min(1).max(500),
});

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const createSalesReturnSchema = z.object({
  body: salesReturnBodySchema.extend({
    saleId: z.string().uuid(),
  }),
});

export const updateSalesReturnSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: salesReturnBodySchema,
});

export const getSalesReturnByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const completeSalesReturnSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const cancelSalesReturnSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const getReturnableSaleSchema = z.object({
  params: z.object({
    saleId: z.string().uuid(),
  }),
});

export const listSalesReturnsSchema = z.object({
  query: paginationQuerySchema.extend({
    search: optionalSearch,
    saleId: z.string().uuid().optional(),
    status: z.enum(["draft", "completed", "cancelled"]).optional(),
    refundStatus: refundStatusSchema.optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z.enum(SALES_RETURN_SORT_FIELDS).default("createdAt"),
  }),
});

export type SalesReturnItemInput = z.infer<typeof salesReturnItemSchema>;
export type CreateSalesReturnInput = z.infer<typeof createSalesReturnSchema>["body"];
export type UpdateSalesReturnInput = z.infer<typeof updateSalesReturnSchema>["body"];
export type ListSalesReturnsQuery = z.infer<typeof listSalesReturnsSchema>["query"];
