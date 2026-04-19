import { z } from "zod";

import { collapseWhitespace } from "../../shared/utils/strings";

const PURCHASE_RETURN_SORT_FIELDS = [
  "createdAt",
  "completedAt",
  "returnNumber",
  "totalReturnAmount",
] as const;

const PURCHASE_RETURN_REASONS = [
  "damaged_stock",
  "wrong_item",
  "near_expiry",
  "expired",
  "excess_stock",
  "purchase_mistake",
  "other",
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

const purchaseReturnItemSchema = z.object({
  purchaseItemId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(1000000),
  reason: z.enum(PURCHASE_RETURN_REASONS),
  notes: optionalTrimmedString(500),
});

const purchaseReturnBodySchema = z.object({
  notes: optionalTrimmedString(2000),
  items: z.array(purchaseReturnItemSchema).min(1).max(500),
});

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const createPurchaseReturnSchema = z.object({
  body: purchaseReturnBodySchema.extend({
    purchaseId: z.string().uuid(),
  }),
});

export const updatePurchaseReturnSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: purchaseReturnBodySchema,
});

export const getPurchaseReturnByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const completePurchaseReturnSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const cancelPurchaseReturnSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const getReturnablePurchaseSchema = z.object({
  params: z.object({
    purchaseId: z.string().uuid(),
  }),
});

export const listPurchaseReturnsSchema = z.object({
  query: paginationQuerySchema.extend({
    search: optionalSearch,
    purchaseId: z.string().uuid().optional(),
    supplierId: z.string().uuid().optional(),
    status: z.enum(["draft", "completed", "cancelled"]).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z.enum(PURCHASE_RETURN_SORT_FIELDS).default("createdAt"),
  }),
});

export type PurchaseReturnReason = (typeof PURCHASE_RETURN_REASONS)[number];
export type PurchaseReturnItemInput = z.infer<typeof purchaseReturnItemSchema>;
export type CreatePurchaseReturnInput = z.infer<
  typeof createPurchaseReturnSchema
>["body"];
export type UpdatePurchaseReturnInput = z.infer<
  typeof updatePurchaseReturnSchema
>["body"];
export type ListPurchaseReturnsQuery = z.infer<
  typeof listPurchaseReturnsSchema
>["query"];
