import { z } from "zod";

import { collapseWhitespace } from "../../shared/utils/strings";

const MASTER_STATUSES = ["active", "inactive"] as const;
const MEDICINE_FORMS = [
  "tablet",
  "capsule",
  "syrup",
  "injection",
  "ointment",
  "cream",
  "drops",
  "inhaler",
  "powder",
  "gel",
  "lotion",
  "solution",
  "suspension",
  "spray",
  "vial",
  "sachet",
  "other",
] as const;
const MEDICINE_UNITS = [
  "strip",
  "bottle",
  "piece",
  "box",
  "vial",
  "tube",
  "sachet",
  "ampoule",
  "packet",
  "kit",
  "container",
  "canister",
  "other",
] as const;
const GST_PERCENTAGES = [0, 5, 12, 18, 28] as const;
const MEDICINE_SORT_FIELDS = [
  "medicineName",
  "genericName",
  "createdAt",
  "updatedAt",
] as const;
const MASTER_SORT_FIELDS = ["name", "createdAt", "updatedAt"] as const;

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

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

const medicineStatusSchema = z.enum(MASTER_STATUSES);
const medicineFormSchema = z.enum(MEDICINE_FORMS);
const medicineUnitSchema = z.enum(MEDICINE_UNITS);
const gstPercentSchema = z.coerce.number().int().refine(
  (value) => GST_PERCENTAGES.includes(value as (typeof GST_PERCENTAGES)[number]),
  "GST percent must be one of 0, 5, 12, 18, or 28.",
);

const createCategoryBodySchema = z.object({
  name: nonEmptyTrimmedString(2, 120),
  description: optionalTrimmedString(255),
  status: medicineStatusSchema.default("active"),
});

const updateCategoryBodySchema = createCategoryBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

const createManufacturerBodySchema = z.object({
  name: nonEmptyTrimmedString(2, 160),
  status: medicineStatusSchema.default("active"),
});

const updateManufacturerBodySchema = createManufacturerBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

const createMedicineBodySchema = z.object({
  medicineName: nonEmptyTrimmedString(2, 180),
  genericName: nonEmptyTrimmedString(2, 180),
  brandName: optionalTrimmedString(160),
  strength: optionalTrimmedString(80),
  form: medicineFormSchema,
  unit: medicineUnitSchema,
  categoryId: z.string().uuid(),
  manufacturerId: z.string().uuid(),
  hsnCode: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed.length ? trimmed : undefined;
    })
    .refine(
      (value) => value === undefined || /^\d{4,8}$/.test(value),
      "HSN code must be 4 to 8 digits.",
    ),
  gstPercent: gstPercentSchema,
  barcode: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed.length ? trimmed : undefined;
    })
    .refine(
      (value) => value === undefined || value.length <= 100,
      "Barcode must be 100 characters or fewer.",
    ),
  reorderLevel: z.coerce.number().int().min(0).max(100000),
  prescriptionRequired: z.boolean().default(false),
  notes: optionalNotes,
  status: medicineStatusSchema.default("active"),
});

const updateMedicineBodySchema = createMedicineBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const listMedicinesSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().max(180).optional(),
    categoryId: z.string().uuid().optional(),
    manufacturerId: z.string().uuid().optional(),
    status: medicineStatusSchema.optional(),
    sortBy: z.enum(MEDICINE_SORT_FIELDS).default("medicineName"),
  }),
});

export const getMedicineByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const createMedicineSchema = z.object({
  body: createMedicineBodySchema,
});

export const updateMedicineSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: updateMedicineBodySchema,
});

export const updateMedicineStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    status: medicineStatusSchema,
  }),
});

export const listMasterDataSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().max(160).optional(),
    status: medicineStatusSchema.optional(),
    sortBy: z.enum(MASTER_SORT_FIELDS).default("name"),
  }),
});

export const createCategorySchema = z.object({
  body: createCategoryBodySchema,
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: updateCategoryBodySchema,
});

export const createManufacturerSchema = z.object({
  body: createManufacturerBodySchema,
});

export const updateManufacturerSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: updateManufacturerBodySchema,
});

export type ListMedicinesQuery = z.infer<typeof listMedicinesSchema>["query"];
export type CreateMedicineInput = z.infer<typeof createMedicineSchema>["body"];
export type UpdateMedicineInput = z.infer<typeof updateMedicineSchema>["body"];
export type UpdateMedicineStatusInput = z.infer<
  typeof updateMedicineStatusSchema
>["body"];
export type ListMasterDataQuery = z.infer<typeof listMasterDataSchema>["query"];
export type CreateCategoryInput = z.infer<typeof createCategorySchema>["body"];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>["body"];
export type CreateManufacturerInput = z.infer<
  typeof createManufacturerSchema
>["body"];
export type UpdateManufacturerInput = z.infer<
  typeof updateManufacturerSchema
>["body"];
