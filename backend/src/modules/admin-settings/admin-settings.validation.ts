import { z } from "zod";

import { USER_ROLES } from "../auth/auth.types";
import { PERMISSIONS } from "./admin-settings.permissions";

const permissionEnum = z.enum(PERMISSIONS);

const uniquePermissionsSchema = z
  .array(permissionEnum)
  .max(PERMISSIONS.length)
  .transform((permissions) => [...new Set(permissions)]);

export const getUserPermissionDetailSchema = z.object({
  params: z.object({
    userId: z.string().uuid(),
  }),
});

export const updateRolePermissionsSchema = z.object({
  params: z.object({
    role: z.enum(USER_ROLES),
  }),
  body: z.object({
    permissions: uniquePermissionsSchema,
  }),
});

export const updateUserPermissionOverridesSchema = z
  .object({
    params: z.object({
      userId: z.string().uuid(),
    }),
    body: z.object({
      allow: uniquePermissionsSchema.default([]),
      deny: uniquePermissionsSchema.default([]),
    }),
  })
  .superRefine((value, ctx) => {
    const overlaps = value.body.allow.filter((permission) =>
      value.body.deny.includes(permission),
    );

    if (overlaps.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body", "deny"],
        message: `Permissions cannot be both allowed and denied: ${overlaps.join(", ")}.`,
      });
    }
  });

export const updateShopSettingsSchema = z.object({
  body: z.object({
    defaultLowStockThreshold: z.coerce.number().int().min(0).max(100000),
    lowStockAlertsEnabled: z.boolean(),
    lowStockEmailAlertsEnabled: z.boolean(),
    nearExpiryAlertDays: z.coerce.number().int().min(1).max(365),
    expiryAlertsEnabled: z.boolean(),
    expiryEmailAlertsEnabled: z.boolean(),
    invoicePrefix: z
      .string()
      .trim()
      .min(2)
      .max(20)
      .regex(/^[A-Za-z0-9-]+$/, "Invoice prefix may contain only letters, numbers, and hyphens.")
      .transform((value) => value.toUpperCase()),
    allowPartialPayments: z.boolean(),
    allowHeldBills: z.boolean(),
    allowStaffSalesReturn: z.boolean(),
    allowInventoryAdjustment: z.boolean(),
    allowDraftPurchases: z.boolean(),
    preferFefo: z.boolean(),
  }),
});

export const listAdminAuditLogsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export type UpdateRolePermissionsInput = z.infer<
  typeof updateRolePermissionsSchema
>["body"];
export type UpdateUserPermissionOverridesInput = z.infer<
  typeof updateUserPermissionOverridesSchema
>["body"];
export type UpdateShopSettingsInput = z.infer<typeof updateShopSettingsSchema>["body"];
export type ListAdminAuditLogsQuery = z.infer<
  typeof listAdminAuditLogsSchema
>["query"];
