import { z } from "zod";

import { normalizePhoneNumber } from "../../shared/utils/phone";
import { collapseWhitespace, normalizeEmail } from "../../shared/utils/strings";

const CUSTOMER_STATUSES = ["active", "inactive"] as const;
const CUSTOMER_GENDERS = ["male", "female", "other"] as const;
const CUSTOMER_SORT_FIELDS = [
  "fullName",
  "customerCode",
  "createdAt",
  "updatedAt",
  "lastPurchaseDate",
  "totalPurchaseAmount",
  "dueAmount",
] as const;
const CUSTOMER_PURCHASE_SORT_FIELDS = ["billDate", "grandTotal", "dueAmount"] as const;
const CUSTOMER_PAYMENT_METHODS = [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "cheque",
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

const optionalNotes = z
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

const phoneSchema = z.string().trim().transform((value, ctx) => {
  const normalized = normalizePhoneNumber(value);

  if (!normalized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a valid mobile number.",
    });
    return z.NEVER;
  }

  return normalized;
});

const optionalPhoneSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined) {
      return undefined;
    }

    const trimmed = value.trim();

    if (!trimmed.length) {
      return undefined;
    }

    const normalized = normalizePhoneNumber(trimmed);

    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid mobile number.",
      });
      return z.NEVER;
    }

    return normalized;
  });

const optionalEmailSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined) {
      return undefined;
    }

    const trimmed = value.trim();

    if (!trimmed.length) {
      return undefined;
    }

    const parsed = z.string().email().safeParse(trimmed);

    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid email address.",
      });
      return z.NEVER;
    }

    return normalizeEmail(trimmed);
  });

const optionalDateSchema = z
  .union([z.coerce.date(), z.null(), z.undefined()])
  .transform((value) => value ?? undefined);

const customerStatusSchema = z.enum(CUSTOMER_STATUSES);
const customerGenderSchema = z.enum(CUSTOMER_GENDERS);
const paymentMethodSchema = z.enum(CUSTOMER_PAYMENT_METHODS);
const moneySchema = z.coerce.number().positive().max(999999999.99);

const customerBodyFields = {
  fullName: nonEmptyTrimmedString(2, 160),
  mobileNumber: phoneSchema,
  alternateMobileNumber: optionalPhoneSchema,
  email: optionalEmailSchema,
  gender: customerGenderSchema.optional(),
  age: z.coerce.number().int().min(0).max(130).optional(),
  dateOfBirth: optionalDateSchema,
  addressLine1: optionalTrimmedString(255),
  addressLine2: optionalTrimmedString(255),
  city: optionalTrimmedString(100),
  state: optionalTrimmedString(100),
  pincode: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed.length ? trimmed : undefined;
    })
    .refine(
      (value) => value === undefined || /^\d{6}$/.test(value),
      "Pincode must be a valid 6-digit code.",
    ),
  notes: optionalNotes,
  status: customerStatusSchema.default("active"),
} satisfies z.ZodRawShape;

const createCustomerBodySchema = z
  .object(customerBodyFields)
  .superRefine((value, ctx) => {
    if (
      value.alternateMobileNumber &&
      value.alternateMobileNumber === value.mobileNumber
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alternateMobileNumber"],
        message: "Alternate mobile number must be different from mobile number.",
      });
    }
  });

const updateCustomerBodySchema = z
  .object({
    fullName: customerBodyFields.fullName.optional(),
    mobileNumber: customerBodyFields.mobileNumber.optional(),
    alternateMobileNumber: customerBodyFields.alternateMobileNumber.optional(),
    email: customerBodyFields.email.optional(),
    gender: customerBodyFields.gender.optional(),
    age: customerBodyFields.age.optional(),
    dateOfBirth: customerBodyFields.dateOfBirth.optional(),
    addressLine1: customerBodyFields.addressLine1.optional(),
    addressLine2: customerBodyFields.addressLine2.optional(),
    city: customerBodyFields.city.optional(),
    state: customerBodyFields.state.optional(),
    pincode: customerBodyFields.pincode.optional(),
    notes: customerBodyFields.notes.optional(),
    status: customerBodyFields.status.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.alternateMobileNumber &&
      value.mobileNumber &&
      value.alternateMobileNumber === value.mobileNumber
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alternateMobileNumber"],
        message: "Alternate mobile number must be different from mobile number.",
      });
    }

    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one field must be provided.",
      });
    }
  });

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const listCustomersSchema = z.object({
  query: paginationQuerySchema.extend({
    search: optionalSearch,
    status: customerStatusSchema.optional(),
    sortBy: z.enum(CUSTOMER_SORT_FIELDS).default("fullName"),
  }),
});

export const listCustomerOptionsSchema = z.object({
  query: z.object({
    search: optionalSearch,
    pageSize: z.coerce.number().int().min(1).max(20).default(8),
  }),
});

export const listCustomerDueSummarySchema = z.object({
  query: paginationQuerySchema.extend({
    search: optionalSearch,
    status: customerStatusSchema.optional(),
    sortBy: z.enum(["fullName", "dueAmount", "lastPurchaseDate"]).default(
      "dueAmount",
    ),
  }),
});

export const getCustomerByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const createCustomerSchema = z.object({
  body: createCustomerBodySchema,
});

export const updateCustomerSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: updateCustomerBodySchema,
});

export const updateCustomerStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    status: customerStatusSchema,
  }),
});

export const listCustomerPurchasesSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  query: paginationQuerySchema.extend({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z.enum(CUSTOMER_PURCHASE_SORT_FIELDS).default("billDate"),
  }),
});

export const listCustomerPaymentsSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  query: paginationQuerySchema.extend({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z.enum(["paymentDate", "createdAt", "amount"]).default("paymentDate"),
  }),
});

export const createCustomerPaymentSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    saleId: z.string().uuid().optional(),
    amount: moneySchema,
    paymentMethod: paymentMethodSchema,
    referenceNumber: optionalTrimmedString(120),
    notes: optionalNotes,
    paymentDate: z.coerce.date().default(() => new Date()),
  }),
});

export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];
export type CustomerGender = (typeof CUSTOMER_GENDERS)[number];
export type CustomerPaymentMethod = (typeof CUSTOMER_PAYMENT_METHODS)[number];
export type ListCustomersQuery = z.infer<typeof listCustomersSchema>["query"];
export type ListCustomerOptionsQuery = z.infer<
  typeof listCustomerOptionsSchema
>["query"];
export type ListCustomerDueSummaryQuery = z.infer<
  typeof listCustomerDueSummarySchema
>["query"];
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>["body"];
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>["body"];
export type UpdateCustomerStatusInput = z.infer<
  typeof updateCustomerStatusSchema
>["body"];
export type ListCustomerPurchasesQuery = z.infer<
  typeof listCustomerPurchasesSchema
>["query"];
export type ListCustomerPaymentsQuery = z.infer<
  typeof listCustomerPaymentsSchema
>["query"];
export type CreateCustomerPaymentInput = z.infer<
  typeof createCustomerPaymentSchema
>["body"];
