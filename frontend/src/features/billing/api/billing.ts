import { apiRequest } from "../../../lib/api";
import type {
  BillDetail,
  BillDetailItem,
  BillListParams,
  BillListItem,
  BillingMedicineOptions,
  BillingMedicineSearchParams,
  BillingMedicineSearchResponse,
  BillsResponse,
  SaveBillPayload,
} from "../../../types/billing";

export type {
  BillDetail,
  BillDetailItem,
  BillListParams,
  BillListItem,
  BillingMedicineOptions,
  BillingMedicineSearchParams,
  BillingMedicineSearchResponse,
  BillsResponse,
  SaveBillPayload,
};

const cleanParams = (
  params: Record<string, string | number | boolean | undefined>,
) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
  );

export const billingQueryKeys = {
  all: ["billing"] as const,
  lists: () => [...billingQueryKeys.all, "list"] as const,
  list: (params: BillListParams) => [...billingQueryKeys.lists(), params] as const,
  details: () => [...billingQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...billingQueryKeys.details(), id] as const,
  medicines: () => [...billingQueryKeys.all, "medicines"] as const,
  medicineSearch: (params: BillingMedicineSearchParams) =>
    [...billingQueryKeys.medicines(), "search", params] as const,
  medicineOptions: (medicineId: string) =>
    [...billingQueryKeys.medicines(), "options", medicineId] as const,
};

export const listBills = (params: BillListParams) =>
  apiRequest<BillsResponse>({
    method: "GET",
    url: "/billing",
    params: cleanParams({
      search: params.search,
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

export const getBill = (id: string) =>
  apiRequest<BillDetail>({
    method: "GET",
    url: `/billing/${id}`,
  });

export const createHeldBill = (payload: SaveBillPayload) =>
  apiRequest<BillDetail>({
    method: "POST",
    url: "/billing/hold",
    data: payload,
  });

export const updateHeldBill = (id: string, payload: SaveBillPayload) =>
  apiRequest<BillDetail>({
    method: "PATCH",
    url: `/billing/${id}/hold`,
    data: payload,
  });

export const completeHeldBill = (id: string) =>
  apiRequest<BillDetail>({
    method: "POST",
    url: `/billing/${id}/complete`,
  });

export const createCompletedBill = (payload: SaveBillPayload) =>
  apiRequest<BillDetail>({
    method: "POST",
    url: "/billing/complete",
    data: payload,
  });

export const searchSellableMedicines = (params: BillingMedicineSearchParams) =>
  apiRequest<BillingMedicineSearchResponse>({
    method: "GET",
    url: "/billing/medicines/search",
    params: cleanParams({
      search: params.search,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const getSellableMedicineOptions = (medicineId: string) =>
  apiRequest<BillingMedicineOptions>({
    method: "GET",
    url: `/billing/medicines/${medicineId}/options`,
  });
