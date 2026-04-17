import { z } from "zod";

import { normalizePhoneNumber } from "../../shared/utils/phone";
import { collapseWhitespace, normalizeEmail } from "../../shared/utils/strings";

const SUPPLIER_STATUSES = ["active", "inactive"] as const;
const SUPPLIER_SORT_FIELDS = [
  "supplierName",
  "createdAt",
  "updatedAt",
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
        message: "Enter a valid alternate mobile number.",
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

const optionalOpeningBalanceSchema = z.union([z.string(), z.number()]).transform(
  (value, ctx) => {
    const normalized =
      typeof value === "number" ? value.toFixed(2) : value.trim();

    if (!/^-?\d{1,11}(\.\d{1,2})?$/.test(normalized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Opening balance must be a valid amount with up to 2 decimal places.",
      });
      return z.NEVER;
    }

    return Number(normalized).toFixed(2);
  },
);

const supplierStatusSchema = z.enum(SUPPLIER_STATUSES);

const supplierBodyFields = {
  supplierName: nonEmptyTrimmedString(2, 180),
  companyName: optionalTrimmedString(180),
  contactPerson: optionalTrimmedString(160),
  mobileNumber: phoneSchema,
  alternateMobileNumber: optionalPhoneSchema,
  email: optionalEmailSchema,
  gstNumber: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) {
        return undefined;
      }

      const trimmed = value.trim().toUpperCase();
      return trimmed.length ? trimmed : undefined;
    })
    .refine(
      (value) => value === undefined || /^[0-9A-Z]{15}$/.test(value),
      "GST number must be 15 uppercase alphanumeric characters.",
    ),
  drugLicenseNumber: optionalTrimmedString(100),
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
  openingBalance: optionalOpeningBalanceSchema.default("0.00"),
  notes: optionalNotes,
  status: supplierStatusSchema.default("active"),
} satisfies z.ZodRawShape;

const createSupplierBodySchema = z
  .object(supplierBodyFields)
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

const updateSupplierBodySchema = z
  .object({
    supplierName: supplierBodyFields.supplierName.optional(),
    companyName: supplierBodyFields.companyName.optional(),
    contactPerson: supplierBodyFields.contactPerson.optional(),
    mobileNumber: supplierBodyFields.mobileNumber.optional(),
    alternateMobileNumber: supplierBodyFields.alternateMobileNumber.optional(),
    email: supplierBodyFields.email.optional(),
    gstNumber: supplierBodyFields.gstNumber.optional(),
    drugLicenseNumber: supplierBodyFields.drugLicenseNumber.optional(),
    addressLine1: supplierBodyFields.addressLine1.optional(),
    addressLine2: supplierBodyFields.addressLine2.optional(),
    city: supplierBodyFields.city.optional(),
    state: supplierBodyFields.state.optional(),
    pincode: supplierBodyFields.pincode.optional(),
    openingBalance: optionalOpeningBalanceSchema.optional(),
    notes: supplierBodyFields.notes.optional(),
    status: supplierBodyFields.status.optional(),
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

export const listSuppliersSchema = z.object({
  query: z.object({
    search: z.string().trim().max(180).optional(),
    status: supplierStatusSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(SUPPLIER_SORT_FIELDS).default("supplierName"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  }),
});

export const getSupplierByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const createSupplierSchema = z.object({
  body: createSupplierBodySchema,
});

export const updateSupplierSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: updateSupplierBodySchema,
});

export const updateSupplierStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    status: supplierStatusSchema,
  }),
});

export type ListSuppliersQuery = z.infer<typeof listSuppliersSchema>["query"];
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>["body"];
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>["body"];
export type UpdateSupplierStatusInput = z.infer<
  typeof updateSupplierStatusSchema
>["body"];
