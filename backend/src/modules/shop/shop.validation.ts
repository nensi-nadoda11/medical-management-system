import { z } from "zod";
import { normalizePhoneNumber } from "../../shared/utils/phone";
import { collapseWhitespace, normalizeEmail } from "../../shared/utils/strings";

const nullableTrimmedString = (maxLength: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) {
        return null;
      }

      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    })
    .refine(
      (value) => value === null || value.length <= maxLength,
      `Must be ${maxLength} characters or fewer.`,
    );

export const updateShopProfileSchema = z.object({
  name: z.string().trim().min(3).max(160).transform(collapseWhitespace),
  phone: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value, ctx) => {
      if (value === null || value === undefined) {
        return null;
      }

      const trimmed = value.trim();
      if (!trimmed.length) {
        return null;
      }

      const normalized = normalizePhoneNumber(trimmed);

      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid phone number.",
        });
        return z.NEVER;
      }

      return normalized;
    }),
  email: z
    .union([z.string().trim().email().max(320), z.null(), z.undefined()])
    .transform((value) =>
      typeof value === "string" && value.length > 0 ? normalizeEmail(value) : null,
    ),
  addressLine1: nullableTrimmedString(255).transform((value) =>
    value ? collapseWhitespace(value) : null,
  ),
  addressLine2: nullableTrimmedString(255).transform((value) =>
    value ? collapseWhitespace(value) : null,
  ),
  city: nullableTrimmedString(100).transform((value) =>
    value ? collapseWhitespace(value) : null,
  ),
  state: nullableTrimmedString(100).transform((value) =>
    value ? collapseWhitespace(value) : null,
  ),
  pincode: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) {
        return null;
      }

      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    })
    .refine(
      (value) => value === null || /^\d{6}$/.test(value),
      "Pincode must be a valid 6-digit code.",
    ),
  gstNumber: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) {
        return null;
      }

      const trimmed = value.trim().toUpperCase();
      return trimmed.length ? trimmed : null;
    })
    .refine(
      (value) => value === null || /^[0-9A-Z]{15}$/.test(value),
      "GST number must be 15 uppercase alphanumeric characters.",
    ),
  licenseNumber: nullableTrimmedString(100).transform((value) =>
    value ? collapseWhitespace(value) : null,
  ),
  invoicePrefix: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) {
        return null;
      }

      const trimmed = value.trim().toUpperCase();
      return trimmed.length ? trimmed : null;
    })
    .refine(
      (value) => value === null || (value.length >= 2 && value.length <= 20),
      "Invoice prefix should be between 2 and 20 characters.",
    )
    .refine(
      (value) => value === null || /^[A-Z0-9-]+$/.test(value),
      "Invoice prefix may contain only uppercase letters, numbers, and hyphens.",
    ),
});

export type UpdateShopProfileInput = z.infer<typeof updateShopProfileSchema>;
