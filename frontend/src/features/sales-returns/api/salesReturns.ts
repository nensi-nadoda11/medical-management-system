import { apiRequest } from "../../../lib/api";
import type {
  CreateSalesReturnPayload,
  ReturnableSaleDetail,
  SalesReturnDetail,
  SalesReturnListParams,
  SalesReturnsResponse,
  UpdateSalesReturnPayload,
} from "../../../types/sales-return";

const cleanParams = (
  params: Record<string, string | number | boolean | undefined>,
) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
  );

export const salesReturnsQueryKeys = {
  all: ["sales-returns"] as const,
  lists: () => [...salesReturnsQueryKeys.all, "list"] as const,
  list: (params: SalesReturnListParams) =>
    [...salesReturnsQueryKeys.lists(), params] as const,
  details: () => [...salesReturnsQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...salesReturnsQueryKeys.details(), id] as const,
  returnableSales: () => [...salesReturnsQueryKeys.all, "returnable-sale"] as const,
  returnableSale: (saleId: string) =>
    [...salesReturnsQueryKeys.returnableSales(), saleId] as const,
};

export const listSalesReturns = (params: SalesReturnListParams) =>
  apiRequest<SalesReturnsResponse>({
    method: "GET",
    url: "/sales-returns",
    params: cleanParams({
      search: params.search,
      saleId: params.saleId,
      status: params.status,
      refundStatus: params.refundStatus,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const getSalesReturn = (id: string) =>
  apiRequest<SalesReturnDetail>({
    method: "GET",
    url: `/sales-returns/${id}`,
  });

export const getReturnableSale = (saleId: string) =>
  apiRequest<ReturnableSaleDetail>({
    method: "GET",
    url: `/sales-returns/sales/${saleId}/returnable`,
  });

export const createSalesReturn = (payload: CreateSalesReturnPayload) =>
  apiRequest<SalesReturnDetail>({
    method: "POST",
    url: "/sales-returns",
    data: payload,
  });

export const updateSalesReturn = (id: string, payload: UpdateSalesReturnPayload) =>
  apiRequest<SalesReturnDetail>({
    method: "PATCH",
    url: `/sales-returns/${id}`,
    data: payload,
  });

export const completeSalesReturn = (id: string) =>
  apiRequest<SalesReturnDetail>({
    method: "POST",
    url: `/sales-returns/${id}/complete`,
  });

export const cancelSalesReturn = (id: string) =>
  apiRequest<SalesReturnDetail>({
    method: "POST",
    url: `/sales-returns/${id}/cancel`,
  });
