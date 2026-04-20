import { z } from "zod";

import { collapseWhitespace } from "../../shared/utils/strings";

const optionalTrimmed = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    const trimmed = collapseWhitespace(value);
    return trimmed.length ? trimmed : undefined;
  });

const branchSettingsSchema = z.object({
  lowStockThreshold: z.coerce.number().int().min(0).max(100000).optional(),
  lowStockAlertsEnabled: z.boolean().optional(),
  lowStockEmailAlertsEnabled: z.boolean().optional(),
  nearExpiryAlertDays: z.coerce.number().int().min(1).max(365).optional(),
  expiryAlertsEnabled: z.boolean().optional(),
  expiryEmailAlertsEnabled: z.boolean().optional(),
  invoicePrefix: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/)
    .transform((value) => value.toUpperCase())
    .optional(),
});

export const createBranchSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(160).transform(collapseWhitespace),
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[A-Za-z0-9-]+$/)
      .transform((value) => value.toUpperCase()),
    address: optionalTrimmed,
    contactNumber: optionalTrimmed,
    status: z.enum(["active", "inactive"]).default("active"),
    isDefault: z.boolean().default(false),
    settings: branchSettingsSchema.default({}),
  }),
});

export const updateBranchSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .transform(collapseWhitespace)
      .optional(),
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[A-Za-z0-9-]+$/)
      .transform((value) => value.toUpperCase())
      .optional(),
    address: optionalTrimmed,
    contactNumber: optionalTrimmed,
    status: z.enum(["active", "inactive"]).optional(),
    isDefault: z.boolean().optional(),
    settings: branchSettingsSchema.optional(),
  }),
});

export const updateUserBranchAssignmentsSchema = z.object({
  params: z.object({
    userId: z.string().uuid(),
  }),
  body: z.object({
    branchIds: z.array(z.string().uuid()).max(100).default([]),
  }),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>["body"];
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>["body"];
export type UpdateUserBranchAssignmentsInput = z.infer<
  typeof updateUserBranchAssignmentsSchema
>["body"];
