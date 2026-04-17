import { apiRequest } from "../../../lib/api";
import type {
  SaveSupplierPayload,
  Supplier,
  SupplierListParams,
  SuppliersResponse,
  UpdateSupplierStatusPayload,
} from "../../../types/supplier";

const cleanParams = (params: Record<string, string | number | undefined>) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
  );

export const suppliersQueryKeys = {
  all: ["suppliers"] as const,
  lists: () => [...suppliersQueryKeys.all, "list"] as const,
  list: (params: SupplierListParams) => [...suppliersQueryKeys.lists(), params] as const,
  details: () => [...suppliersQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...suppliersQueryKeys.details(), id] as const,
};

export const listSuppliers = (params: SupplierListParams) =>
  apiRequest<SuppliersResponse>({
    method: "GET",
    url: "/suppliers",
    params: cleanParams({
      search: params.search,
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const getSupplier = (id: string) =>
  apiRequest<Supplier>({
    method: "GET",
    url: `/suppliers/${id}`,
  });

export const createSupplier = (payload: SaveSupplierPayload) =>
  apiRequest<Supplier>({
    method: "POST",
    url: "/suppliers",
    data: payload,
  });

export const updateSupplier = (id: string, payload: Partial<SaveSupplierPayload>) =>
  apiRequest<Supplier>({
    method: "PATCH",
    url: `/suppliers/${id}`,
    data: payload,
  });

export const updateSupplierStatus = (
  id: string,
  payload: UpdateSupplierStatusPayload,
) =>
  apiRequest<Supplier>({
    method: "PATCH",
    url: `/suppliers/${id}/status`,
    data: payload,
  });
