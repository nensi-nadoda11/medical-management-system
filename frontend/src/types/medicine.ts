import type { PaginatedResponse } from "./common";

export const MASTER_STATUSES = ["active", "inactive"] as const;
export type MasterStatus = (typeof MASTER_STATUSES)[number];

export const MEDICINE_FORMS = [
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

export const MEDICINE_UNITS = [
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

export const GST_PERCENTAGES = [0, 5, 12, 18, 28] as const;

export type MedicineForm = (typeof MEDICINE_FORMS)[number];
export type MedicineUnit = (typeof MEDICINE_UNITS)[number];
export type GstPercentage = (typeof GST_PERCENTAGES)[number];

export interface MedicineMasterItem {
  id: string;
  shopId: string;
  name: string;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MedicineCategory extends MedicineMasterItem {
  description: string | null;
}

export type Manufacturer = MedicineMasterItem;

export interface MedicineRelation {
  id: string;
  name: string;
  status: MasterStatus;
}

export interface Medicine {
  id: string;
  shopId: string;
  medicineName: string;
  genericName: string;
  brandName: string | null;
  strength: string | null;
  form: MedicineForm;
  unit: MedicineUnit;
  category: MedicineRelation;
  manufacturer: MedicineRelation;
  hsnCode: string | null;
  gstPercent: GstPercentage;
  barcode: string | null;
  reorderLevel: number;
  prescriptionRequired: boolean;
  notes: string | null;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MedicineListParams {
  search?: string;
  categoryId?: string;
  manufacturerId?: string;
  status?: MasterStatus;
  page?: number;
  pageSize?: number;
  sortBy?: "medicineName" | "genericName" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface MedicineMasterListParams {
  search?: string;
  status?: MasterStatus;
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface SaveMedicinePayload {
  medicineName: string;
  genericName: string;
  brandName?: string | null;
  strength?: string | null;
  form: MedicineForm;
  unit: MedicineUnit;
  categoryId: string;
  manufacturerId: string;
  hsnCode?: string | null;
  gstPercent: GstPercentage;
  barcode?: string | null;
  reorderLevel: number;
  prescriptionRequired: boolean;
  notes?: string | null;
  status: MasterStatus;
}

export interface UpdateMedicineStatusPayload {
  status: MasterStatus;
}

export interface SaveMedicineCategoryPayload {
  name: string;
  description?: string | null;
  status: MasterStatus;
}

export interface SaveManufacturerPayload {
  name: string;
  status: MasterStatus;
}

export type MedicinesResponse = PaginatedResponse<Medicine>;
export type MedicineCategoriesResponse = PaginatedResponse<MedicineCategory>;
export type ManufacturersResponse = PaginatedResponse<Manufacturer>;
