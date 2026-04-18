import { z } from "zod";

import { collapseWhitespace } from "../../shared/utils/strings";

const BILL_SORT_FIELDS = [
  "createdAt",
  "completedAt",
  "billNumber",
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

const billItemSchema = z.object({
  medicineId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  quantity: z.coerce.number().int().min(1).max(1000000),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
});

const billBodySchema = z.object({
  customerId: z.string().uuid().optional(),
  customerName: optionalTrimmedString(160),
  customerPhone: optionalTrimmedString(20),
  paymentMethod: z
    .enum(["cash", "upi", "card", "bank_transfer", "split"])
    .default("cash"),
  paidAmount: moneySchema.default(0),
  roundOffAmount: z.coerce.number().min(-9999.99).max(9999.99).default(0),
  notes: optionalTrimmedString(2000),
  items: z.array(billItemSchema).min(1).max(500),
});

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const createHeldBillSchema = z.object({
  body: billBodySchema,
});

export const createCompletedBillSchema = z.object({
  body: billBodySchema,
});

export const updateHeldBillSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: billBodySchema,
});

export const completeHeldBillSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const getBillByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const listBillsSchema = z.object({
  query: paginationQuerySchema.extend({
    search: optionalSearch,
    status: z.enum(["held", "completed", "cancelled"]).optional(),
    paymentStatus: z.enum(["unpaid", "partial", "paid"]).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z.enum(BILL_SORT_FIELDS).default("createdAt"),
  }),
});

export const searchSellableMedicinesSchema = z.object({
  query: paginationQuerySchema.extend({
    search: optionalSearch,
    sortBy: z.enum(["medicineName", "availableQuantity", "nextExpiryDate"]).default(
      "medicineName",
    ),
  }),
});

export const getSellableMedicineOptionsSchema = z.object({
  params: z.object({
    medicineId: z.string().uuid(),
  }),
});

export type BillItemInput = z.infer<typeof billItemSchema>;
export type SaveBillInput = z.infer<typeof billBodySchema>;
export type ListBillsQuery = z.infer<typeof listBillsSchema>["query"];
export type SearchSellableMedicinesQuery = z.infer<
  typeof searchSellableMedicinesSchema
>["query"];
