import { z } from "zod";

import { collapseWhitespace } from "../../shared/utils/strings";

const optionalSearch = z
  .union([z.string(), z.undefined()])
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    const trimmed = collapseWhitespace(value);
    return trimmed.length ? trimmed.toLowerCase() : undefined;
  });

export const listStockTransfersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const listSourceBatchesSchema = z.object({
  query: z.object({
    branchId: z.string().uuid(),
    search: optionalSearch,
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export const createStockTransferSchema = z.object({
  body: z.object({
    fromBranchId: z.string().uuid(),
    toBranchId: z.string().uuid(),
    notes: z.string().trim().max(500).optional(),
    items: z
      .array(
        z.object({
          sourceBatchId: z.string().uuid(),
          medicineId: z.string().uuid(),
          quantity: z.coerce.number().int().min(1),
        }),
      )
      .min(1)
      .max(200),
  }),
});

export const transferIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export type ListStockTransfersQuery = z.infer<
  typeof listStockTransfersSchema
>["query"];
export type ListSourceBatchesQuery = z.infer<
  typeof listSourceBatchesSchema
>["query"];
export type CreateStockTransferInput = z.infer<
  typeof createStockTransferSchema
>["body"];
