import { z } from "zod";

const IMPORT_TYPES = ["medicines", "suppliers", "customers"] as const;
const DUPLICATE_MODES = [
  "skip_duplicates",
  "update_existing",
  "fail_duplicates",
  "upsert",
] as const;
const TEMPLATE_FORMATS = ["csv", "xlsx"] as const;
const EXPORT_DATASETS = [
  "medicines",
  "suppliers",
  "customers",
  "stock_summary",
] as const;
const BACKUP_STATUSES = ["ready", "restored", "failed"] as const;
const MASTER_STATUSES = ["active", "inactive"] as const;

const cleanOptionalString = (max: number) =>
  z
    .union([z.string(), z.undefined()])
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed.length ? trimmed : undefined;
    })
    .refine(
      (value) => value === undefined || value.length <= max,
      `Must be ${max} characters or fewer.`,
    );

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const downloadTemplateSchema = z.object({
  query: z.object({
    importType: z.enum(IMPORT_TYPES),
    format: z.enum(TEMPLATE_FORMATS).default("csv"),
  }),
});

export const validateImportSchema = z.object({
  body: z.object({
    importType: z.enum(IMPORT_TYPES),
    duplicateMode: z.enum(DUPLICATE_MODES).default("skip_duplicates"),
    fileName: z.string().trim().min(1).max(255),
    fileContentBase64: z.string().trim().min(1),
  }),
});

export const confirmImportSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const listImportJobsSchema = z.object({
  query: paginationSchema.extend({
    importType: z.enum(IMPORT_TYPES).optional(),
    status: z.enum(["validated", "processing", "completed", "failed"]).optional(),
  }),
});

export const getImportJobSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const exportDatasetSchema = z.object({
  query: z.object({
    dataset: z.enum(EXPORT_DATASETS),
    format: z.enum(TEMPLATE_FORMATS).default("xlsx"),
    search: cleanOptionalString(180),
    status: z.enum(MASTER_STATUSES).optional(),
    categoryId: z.string().uuid().optional(),
    manufacturerId: z.string().uuid().optional(),
    lowStockOnly: z.coerce.boolean().optional(),
  }),
});

export const createBackupSchema = z.object({
  body: z
    .object({
      includeShopProfile: z.boolean().default(true),
      includeSettings: z.boolean().default(true),
      includeMasters: z.boolean().default(true),
      includeContacts: z.boolean().default(true),
    })
    .default({
      includeShopProfile: true,
      includeSettings: true,
      includeMasters: true,
      includeContacts: true,
    }),
});

export const listBackupsSchema = z.object({
  query: paginationSchema.extend({
    status: z.enum(BACKUP_STATUSES).optional(),
  }),
});

export const backupRecordSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const restoreBackupSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    confirmationText: z.string().trim().min(1).max(255),
  }),
});

export type ImportType = z.infer<typeof validateImportSchema>["body"]["importType"];
export type DuplicateMode = z.infer<
  typeof validateImportSchema
>["body"]["duplicateMode"];
export type DownloadTemplateQuery = z.infer<
  typeof downloadTemplateSchema
>["query"];
export type ValidateImportInput = z.infer<typeof validateImportSchema>["body"];
export type ListImportJobsQuery = z.infer<typeof listImportJobsSchema>["query"];
export type ExportDatasetQuery = z.infer<typeof exportDatasetSchema>["query"];
export type CreateBackupInput = z.infer<typeof createBackupSchema>["body"];
export type ListBackupsQuery = z.infer<typeof listBackupsSchema>["query"];
export type RestoreBackupInput = z.infer<typeof restoreBackupSchema>["body"];
