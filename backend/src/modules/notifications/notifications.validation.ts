import { z } from "zod";

const NOTIFICATION_TYPES = [
  "low_stock",
  "near_expiry",
  "expired_stock",
  "customer_due",
  "supplier_payable",
  "system_alert",
] as const;
const NOTIFICATION_SEVERITIES = ["info", "warning", "critical"] as const;

export const listNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    type: z.enum(NOTIFICATION_TYPES).optional(),
    severity: z.enum(NOTIFICATION_SEVERITIES).optional(),
    isRead: z
      .union([z.boolean(), z.string(), z.undefined()])
      .transform((value) => {
        if (value === undefined) {
          return undefined;
        }

        if (typeof value === "boolean") {
          return value;
        }

        if (value === "true") {
          return true;
        }

        if (value === "false") {
          return false;
        }

        return undefined;
      }),
    isAcknowledged: z
      .union([z.boolean(), z.string(), z.undefined()])
      .transform((value) => {
        if (value === undefined) {
          return undefined;
        }

        if (typeof value === "boolean") {
          return value;
        }

        if (value === "true") {
          return true;
        }

        if (value === "false") {
          return false;
        }

        return undefined;
      }),
    activeOnly: z
      .union([z.boolean(), z.string(), z.undefined()])
      .transform((value) => {
        if (value === undefined) {
          return true;
        }

        if (typeof value === "boolean") {
          return value;
        }

        if (value === "true") {
          return true;
        }

        if (value === "false") {
          return false;
        }

        return true;
      }),
  }),
});

export const notificationIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const bulkMarkNotificationsReadSchema = z.object({
  body: z.object({
    ids: z.array(z.string().uuid()).min(1).max(100).optional(),
  }),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>["query"];
export type BulkMarkNotificationsReadInput = z.infer<
  typeof bulkMarkNotificationsReadSchema
>["body"];
