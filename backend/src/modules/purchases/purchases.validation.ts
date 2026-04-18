import { z } from "zod";

import { collapseWhitespace } from "../../shared/utils/strings";

const GST_PERCENTAGES = [0, 5, 12, 18, 28] as const;
const PURCHASE_SORT_FIELDS = [
  "purchaseDate",
  "purchaseNumber",
  "createdAt",
  "grandTotal",
] as const;

const nonEmptyTrimmedString = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .transform(collapseWhitespace);

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

const moneySchema = z.coerce.number().min(0).max(999999999.99);
const gstPercentSchema = z.coerce.number().int().refine(
  (value) => GST_PERCENTAGES.includes(value as (typeof GST_PERCENTAGES)[number]),
  "GST percent must be one of 0, 5, 12, 18, or 28.",
);

const purchaseItemSchema = z.object({
  medicineId: z.string().uuid(),
  batchNumber: nonEmptyTrimmedString(1, 80),
  expiryDate: z.coerce.date(),
  quantity: z.coerce.number().int().min(1).max(1000000),
  freeQuantity: z.coerce.number().int().min(0).max(1000000).default(0),
  purchaseRate: moneySchema,
  saleRate: moneySchema,
  mrp: moneySchema,
  gstPercent: gstPercentSchema,
  discountPercent: z.coerce.number().min(0).max(100).default(0),
});

const purchaseBodySchema = z.object({
  supplierId: z.string().uuid(),
  supplierInvoiceNumber: optionalTrimmedString(80),
  supplierInvoiceDate: z.coerce.date().optional(),
  purchaseDate: z.coerce.date(),
  paidAmount: moneySchema.default(0),
  roundOffAmount: z.coerce.number().min(-9999.99).max(9999.99).default(0),
  notes: optionalTrimmedString(2000),
  items: z.array(purchaseItemSchema).min(1).max(500),
});

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const createPurchaseSchema = z.object({
  body: purchaseBodySchema,
});

export const updateDraftPurchaseSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: purchaseBodySchema,
});

export const finalizePurchaseSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const cancelPurchaseSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    notes: optionalTrimmedString(2000),
  }),
});

export const getPurchaseByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const listPurchasesSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().max(120).optional(),
    supplierId: z.string().uuid().optional(),
    status: z.enum(["draft", "finalized", "cancelled"]).optional(),
    paymentStatus: z.enum(["unpaid", "partial", "paid"]).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z.enum(PURCHASE_SORT_FIELDS).default("purchaseDate"),
  }),
});

export type PurchaseItemInput = z.infer<typeof purchaseItemSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>["body"];
export type UpdateDraftPurchaseInput = z.infer<
  typeof updateDraftPurchaseSchema
>["body"];
export type CancelPurchaseInput = z.infer<typeof cancelPurchaseSchema>["body"];
export type ListPurchasesQuery = z.infer<typeof listPurchasesSchema>["query"];
