import { apiRequest } from "../../../lib/api";
import type {
  CustomerDetail,
  CustomerDueSummaryParams,
  CustomerDueSummaryResponse,
  CustomerHistoryParams,
  CustomerListParams,
  CustomerOption,
  CustomerPaymentHistoryItem,
  CustomerPaymentHistoryParams,
  CustomerPaymentsResponse,
  CustomerPurchasesResponse,
  CustomersResponse,
  SaveCustomerPayload,
  SaveCustomerPaymentPayload,
  UpdateCustomerStatusPayload,
} from "../../../types/customer";

const cleanParams = (
  params: Record<string, string | number | boolean | undefined>,
) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
  );

export const customersQueryKeys = {
  all: ["customers"] as const,
  lists: () => [...customersQueryKeys.all, "list"] as const,
  list: (params: CustomerListParams) => [...customersQueryKeys.lists(), params] as const,
  details: () => [...customersQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...customersQueryKeys.details(), id] as const,
  options: (search?: string) => [...customersQueryKeys.all, "options", search ?? ""] as const,
  dueSummary: (params: CustomerDueSummaryParams) =>
    [...customersQueryKeys.all, "due-summary", params] as const,
  purchases: (id: string, params: CustomerHistoryParams) =>
    [...customersQueryKeys.all, id, "purchases", params] as const,
  payments: (id: string, params: CustomerPaymentHistoryParams) =>
    [...customersQueryKeys.all, id, "payments", params] as const,
};

export const listCustomers = (params: CustomerListParams) =>
  apiRequest<CustomersResponse>({
    method: "GET",
    url: "/customers",
    params: cleanParams({
      search: params.search,
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const listCustomerOptions = (search?: string) =>
  apiRequest<{ items: CustomerOption[] }>({
    method: "GET",
    url: "/customers/options",
    params: cleanParams({
      search,
      pageSize: 8,
    }),
  });

export const getCustomer = (id: string) =>
  apiRequest<CustomerDetail>({
    method: "GET",
    url: `/customers/${id}`,
  });

export const createCustomer = (payload: SaveCustomerPayload) =>
  apiRequest<CustomerDetail>({
    method: "POST",
    url: "/customers",
    data: payload,
  });

export const updateCustomer = (id: string, payload: Partial<SaveCustomerPayload>) =>
  apiRequest<CustomerDetail>({
    method: "PATCH",
    url: `/customers/${id}`,
    data: payload,
  });

export const updateCustomerStatus = (
  id: string,
  payload: UpdateCustomerStatusPayload,
) =>
  apiRequest<CustomerDetail>({
    method: "PATCH",
    url: `/customers/${id}/status`,
    data: payload,
  });

export const listCustomerPurchases = (
  id: string,
  params: CustomerHistoryParams,
) =>
  apiRequest<CustomerPurchasesResponse>({
    method: "GET",
    url: `/customers/${id}/purchases`,
    params: cleanParams({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const listCustomerPayments = (
  id: string,
  params: CustomerPaymentHistoryParams,
) =>
  apiRequest<CustomerPaymentsResponse>({
    method: "GET",
    url: `/customers/${id}/payments`,
    params: cleanParams({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const createCustomerPayment = (
  id: string,
  payload: SaveCustomerPaymentPayload,
) =>
  apiRequest<CustomerPaymentHistoryItem>({
    method: "POST",
    url: `/customers/${id}/payments`,
    data: payload,
  });

export const listCustomerDueSummaries = (params: CustomerDueSummaryParams) =>
  apiRequest<CustomerDueSummaryResponse>({
    method: "GET",
    url: "/customers/due-summary",
    params: cleanParams({
      search: params.search,
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });
