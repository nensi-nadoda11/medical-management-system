import { z } from "zod";

export const AUDIT_LOG_MODULES = [
  "users",
  "permissions",
  "settings",
  "medicines",
  "suppliers",
  "customers",
  "purchases",
  "inventory",
  "billing",
  "sales_returns",
  "purchase_returns",
  "accounting",
  "notifications",
] as const;

export const AUDIT_LOG_SEVERITIES = [
  "normal",
  "important",
  "critical",
] as const;

const optionalSearch = z
  .union([z.string(), z.undefined()])
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  })
  .refine(
    (value) => value === undefined || value.length <= 180,
    "Search must be 180 characters or fewer.",
  );

export const listAuditLogsSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(15),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
      module: z.enum(AUDIT_LOG_MODULES).optional(),
      action: z
        .union([z.string(), z.undefined()])
        .transform((value) => value?.trim() || undefined)
        .refine(
          (value) => value === undefined || value.length <= 80,
          "Action must be 80 characters or fewer.",
        ),
      actorUserId: z.string().uuid().optional(),
      severity: z.enum(AUDIT_LOG_SEVERITIES).optional(),
      dateFrom: z.coerce.date().optional(),
      dateTo: z.coerce.date().optional(),
      search: optionalSearch,
    })
    .superRefine((value, ctx) => {
      if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dateFrom"],
          message: "Start date must be before or equal to end date.",
        });
      }
    }),
});

export const getAuditLogByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const listRecentActivitySchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(20).default(8),
  }),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsSchema>["query"];
export type ListRecentActivityQuery = z.infer<
  typeof listRecentActivitySchema
>["query"];
