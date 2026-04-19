import { z } from "zod";

import { collapseWhitespace } from "../../shared/utils/strings";

const PAYMENT_METHODS = [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "cheque",
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

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const paymentMethodSchema = z.enum(PAYMENT_METHODS);

const moneySchema = z.coerce.number().positive().max(999999999.99);

export const listCustomerPaymentsSchema = z.object({
  query: paginationQuerySchema.extend({
    search: optionalSearch,
    customerId: z.string().uuid().optional(),
    saleId: z.string().uuid().optional(),
    paymentMethod: paymentMethodSchema.optional(),
    status: z.enum(["completed", "cancelled"]).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z.enum(["paymentDate", "createdAt", "amount"]).default("paymentDate"),
  }),
});

export const createCustomerPaymentSchema = z.object({
  body: z.object({
    customerId: z.string().uuid(),
    saleId: z.string().uuid().optional(),
    amount: moneySchema,
    paymentMethod: paymentMethodSchema,
    referenceNumber: optionalTrimmedString(120),
    notes: optionalTrimmedString(2000),
    paymentDate: z.coerce.date().default(() => new Date()),
  }),
});

export const getCustomerLedgerSchema = z.object({
  params: z.object({
    customerId: z.string().uuid(),
  }),
  query: paginationQuerySchema.extend({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  }),
});

export const getCustomerDueSummarySchema = z.object({
  params: z.object({
    customerId: z.string().uuid(),
  }),
});

export const listOutstandingCustomersSchema = z.object({
  query: paginationQuerySchema.extend({
    search: optionalSearch,
    sortBy: z.enum(["fullName", "outstandingAmount", "lastBillDate"]).default(
      "outstandingAmount",
    ),
  }),
});

export const listSupplierPaymentsSchema = z.object({
  query: paginationQuerySchema.extend({
    search: optionalSearch,
    supplierId: z.string().uuid().optional(),
    purchaseId: z.string().uuid().optional(),
    paymentMethod: paymentMethodSchema.optional(),
    status: z.enum(["completed", "cancelled"]).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z.enum(["paymentDate", "createdAt", "amount"]).default("paymentDate"),
  }),
});

export const createSupplierPaymentSchema = z.object({
  body: z.object({
    supplierId: z.string().uuid(),
    purchaseId: z.string().uuid().optional(),
    amount: moneySchema,
    paymentMethod: paymentMethodSchema,
    referenceNumber: optionalTrimmedString(120),
    notes: optionalTrimmedString(2000),
    paymentDate: z.coerce.date().default(() => new Date()),
  }),
});

export const getSupplierLedgerSchema = z.object({
  params: z.object({
    supplierId: z.string().uuid(),
  }),
  query: paginationQuerySchema.extend({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  }),
});

export const getSupplierDueSummarySchema = z.object({
  params: z.object({
    supplierId: z.string().uuid(),
  }),
});

export const listOutstandingSuppliersSchema = z.object({
  query: paginationQuerySchema.extend({
    search: optionalSearch,
    sortBy: z.enum(["supplierName", "outstandingAmount", "lastPurchaseDate"]).default(
      "outstandingAmount",
    ),
  }),
});

export const listSupplierOptionsSchema = z.object({
  query: z.object({
    search: optionalSearch,
    pageSize: z.coerce.number().int().min(1).max(20).default(8),
  }),
});

export type ListAccountingCustomerPaymentsQuery = z.infer<
  typeof listCustomerPaymentsSchema
>["query"];
export type CreateAccountingCustomerPaymentInput = z.infer<
  typeof createCustomerPaymentSchema
>["body"];
export type ListOutstandingCustomersQuery = z.infer<
  typeof listOutstandingCustomersSchema
>["query"];
export type ListAccountingSupplierPaymentsQuery = z.infer<
  typeof listSupplierPaymentsSchema
>["query"];
export type CreateAccountingSupplierPaymentInput = z.infer<
  typeof createSupplierPaymentSchema
>["body"];
export type ListOutstandingSuppliersQuery = z.infer<
  typeof listOutstandingSuppliersSchema
>["query"];
