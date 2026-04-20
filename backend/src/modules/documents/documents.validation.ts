import { z } from "zod";

export const documentVariantSchema = z.enum(["a4", "compact"]).default("a4");

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const querySchema = z.object({
  variant: documentVariantSchema.optional(),
});

export const getDocumentSchema = z.object({
  params: idParamsSchema,
  query: querySchema,
});

export const downloadDocumentPdfSchema = z.object({
  params: idParamsSchema,
  query: querySchema,
});

export type DocumentRequestQuery = z.infer<typeof querySchema>;
