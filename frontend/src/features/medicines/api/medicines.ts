import { apiRequest } from "../../../lib/api";
import type {
  Manufacturer,
  ManufacturersResponse,
  Medicine,
  MedicineCategoriesResponse,
  MedicineCategory,
  MedicineListParams,
  MedicineMasterListParams,
  MedicinesResponse,
  SaveManufacturerPayload,
  SaveMedicineCategoryPayload,
  SaveMedicinePayload,
  UpdateMedicineStatusPayload,
} from "../../../types/medicine";

const cleanParams = (params: Record<string, string | number | undefined>) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
  );

export const medicinesQueryKeys = {
  all: ["medicines"] as const,
  lists: () => [...medicinesQueryKeys.all, "list"] as const,
  list: (params: MedicineListParams) => [...medicinesQueryKeys.lists(), params] as const,
  details: () => [...medicinesQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...medicinesQueryKeys.details(), id] as const,
  categories: ["medicines", "categories"] as const,
  categoryList: (params: MedicineMasterListParams) =>
    [...medicinesQueryKeys.categories, "list", params] as const,
  manufacturers: ["medicines", "manufacturers"] as const,
  manufacturerList: (params: MedicineMasterListParams) =>
    [...medicinesQueryKeys.manufacturers, "list", params] as const,
};

export const listMedicines = (params: MedicineListParams) =>
  apiRequest<MedicinesResponse>({
    method: "GET",
    url: "/medicines",
    params: cleanParams({
      search: params.search,
      categoryId: params.categoryId,
      manufacturerId: params.manufacturerId,
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const getMedicine = (id: string) =>
  apiRequest<Medicine>({
    method: "GET",
    url: `/medicines/${id}`,
  });

export const createMedicine = (payload: SaveMedicinePayload) =>
  apiRequest<Medicine>({
    method: "POST",
    url: "/medicines",
    data: payload,
  });

export const updateMedicine = (id: string, payload: Partial<SaveMedicinePayload>) =>
  apiRequest<Medicine>({
    method: "PATCH",
    url: `/medicines/${id}`,
    data: payload,
  });

export const updateMedicineStatus = (
  id: string,
  payload: UpdateMedicineStatusPayload,
) =>
  apiRequest<Medicine>({
    method: "PATCH",
    url: `/medicines/${id}/status`,
    data: payload,
  });

export const listCategories = (params: MedicineMasterListParams) =>
  apiRequest<MedicineCategoriesResponse>({
    method: "GET",
    url: "/medicines/categories",
    params: cleanParams({
      search: params.search,
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const createCategory = (payload: SaveMedicineCategoryPayload) =>
  apiRequest<MedicineCategory>({
    method: "POST",
    url: "/medicines/categories",
    data: payload,
  });

export const updateCategory = (
  id: string,
  payload: Partial<SaveMedicineCategoryPayload>,
) =>
  apiRequest<MedicineCategory>({
    method: "PATCH",
    url: `/medicines/categories/${id}`,
    data: payload,
  });

export const listManufacturers = (params: MedicineMasterListParams) =>
  apiRequest<ManufacturersResponse>({
    method: "GET",
    url: "/medicines/manufacturers",
    params: cleanParams({
      search: params.search,
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const createManufacturer = (payload: SaveManufacturerPayload) =>
  apiRequest<Manufacturer>({
    method: "POST",
    url: "/medicines/manufacturers",
    data: payload,
  });

export const updateManufacturer = (
  id: string,
  payload: Partial<SaveManufacturerPayload>,
) =>
  apiRequest<Manufacturer>({
    method: "PATCH",
    url: `/medicines/manufacturers/${id}`,
    data: payload,
  });
