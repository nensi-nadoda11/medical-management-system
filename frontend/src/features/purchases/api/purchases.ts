import { apiRequest } from "../../../lib/api";
import type {
  CancelPurchasePayload,
  PurchaseDetail,
  PurchaseListParams,
  PurchasesResponse,
  SavePurchasePayload,
} from "../../../types/purchase";

const cleanParams = (params: Record<string, string | number | boolean | undefined>) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
  );

export const purchasesQueryKeys = {
  all: ["purchases"] as const,
  lists: () => [...purchasesQueryKeys.all, "list"] as const,
  list: (params: PurchaseListParams) => [...purchasesQueryKeys.lists(), params] as const,
  details: () => [...purchasesQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...purchasesQueryKeys.details(), id] as const,
};

export const listPurchases = (params: PurchaseListParams) =>
  apiRequest<PurchasesResponse>({
    method: "GET",
    url: "/purchases",
    params: cleanParams({
      search: params.search,
      supplierId: params.supplierId,
      status: params.status,
      paymentStatus: params.paymentStatus,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const getPurchase = (id: string) =>
  apiRequest<PurchaseDetail>({
    method: "GET",
    url: `/purchases/${id}`,
  });

export const createPurchase = (payload: SavePurchasePayload) =>
  apiRequest<PurchaseDetail>({
    method: "POST",
    url: "/purchases",
    data: payload,
  });

export const updateDraftPurchase = (id: string, payload: SavePurchasePayload) =>
  apiRequest<PurchaseDetail>({
    method: "PATCH",
    url: `/purchases/${id}`,
    data: payload,
  });

export const finalizePurchase = (id: string) =>
  apiRequest<PurchaseDetail>({
    method: "POST",
    url: `/purchases/${id}/finalize`,
  });

export const approvePurchaseOrder = (id: string) =>
  apiRequest<PurchaseDetail>({
    method: "POST",
    url: `/purchases/${id}/approve`,
  });

export const markPurchaseOrderSupplierNotified = (id: string) =>
  apiRequest<PurchaseDetail>({
    method: "POST",
    url: `/purchases/${id}/mark-supplier-notified`,
  });

export const cancelPurchase = (id: string, payload: CancelPurchasePayload) =>
  apiRequest<PurchaseDetail>({
    method: "POST",
    url: `/purchases/${id}/cancel`,
    data: payload,
  });

export const deletePurchase = (id: string) =>
  apiRequest<void>({
    method: "DELETE",
    url: `/purchases/${id}`,
  });
