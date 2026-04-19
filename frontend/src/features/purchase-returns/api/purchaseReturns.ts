import { apiRequest } from "../../../lib/api";
import type {
  CreatePurchaseReturnPayload,
  PurchaseReturnDetail,
  PurchaseReturnListParams,
  PurchaseReturnsResponse,
  ReturnablePurchaseDetail,
  UpdatePurchaseReturnPayload,
} from "../../../types/purchase-return";

const cleanParams = (
  params: Record<string, string | number | boolean | undefined>,
) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
  );

export const purchaseReturnsQueryKeys = {
  all: ["purchase-returns"] as const,
  lists: () => [...purchaseReturnsQueryKeys.all, "list"] as const,
  list: (params: PurchaseReturnListParams) =>
    [...purchaseReturnsQueryKeys.lists(), params] as const,
  details: () => [...purchaseReturnsQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...purchaseReturnsQueryKeys.details(), id] as const,
  returnablePurchases: () =>
    [...purchaseReturnsQueryKeys.all, "returnable-purchase"] as const,
  returnablePurchase: (purchaseId: string) =>
    [...purchaseReturnsQueryKeys.returnablePurchases(), purchaseId] as const,
};

export const listPurchaseReturns = (params: PurchaseReturnListParams) =>
  apiRequest<PurchaseReturnsResponse>({
    method: "GET",
    url: "/purchase-returns",
    params: cleanParams({
      search: params.search,
      purchaseId: params.purchaseId,
      supplierId: params.supplierId,
      status: params.status,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const getPurchaseReturn = (id: string) =>
  apiRequest<PurchaseReturnDetail>({
    method: "GET",
    url: `/purchase-returns/${id}`,
  });

export const getReturnablePurchase = (purchaseId: string) =>
  apiRequest<ReturnablePurchaseDetail>({
    method: "GET",
    url: `/purchase-returns/purchases/${purchaseId}/returnable`,
  });

export const createPurchaseReturn = (payload: CreatePurchaseReturnPayload) =>
  apiRequest<PurchaseReturnDetail>({
    method: "POST",
    url: "/purchase-returns",
    data: payload,
  });

export const updatePurchaseReturn = (
  id: string,
  payload: UpdatePurchaseReturnPayload,
) =>
  apiRequest<PurchaseReturnDetail>({
    method: "PATCH",
    url: `/purchase-returns/${id}`,
    data: payload,
  });

export const completePurchaseReturn = (id: string) =>
  apiRequest<PurchaseReturnDetail>({
    method: "POST",
    url: `/purchase-returns/${id}/complete`,
  });

export const cancelPurchaseReturn = (id: string) =>
  apiRequest<PurchaseReturnDetail>({
    method: "POST",
    url: `/purchase-returns/${id}/cancel`,
  });
