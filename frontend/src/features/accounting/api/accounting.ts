import { apiRequest } from "../../../lib/api";
import type {
  CustomerDueSummary,
  CustomerLedgerResponse,
  CustomerPaymentsParams,
  CustomerPaymentsResponse,
  OutstandingCustomersParams,
  OutstandingCustomersResponse,
  OutstandingSuppliersParams,
  OutstandingSuppliersResponse,
  SaveCustomerAccountingPaymentPayload,
  SaveSupplierAccountingPaymentPayload,
  SupplierDueSummary,
  SupplierLedgerResponse,
  SupplierOption,
  SupplierPaymentsParams,
  SupplierPaymentsResponse,
} from "../../../types/accounting";

const cleanParams = (
  params: Record<string, string | number | boolean | undefined>,
) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
  );

export const accountingQueryKeys = {
  all: ["accounting"] as const,
  customerPayments: (params: CustomerPaymentsParams) =>
    [...accountingQueryKeys.all, "customer-payments", params] as const,
  supplierPayments: (params: SupplierPaymentsParams) =>
    [...accountingQueryKeys.all, "supplier-payments", params] as const,
  outstandingCustomers: (params: OutstandingCustomersParams) =>
    [...accountingQueryKeys.all, "outstanding-customers", params] as const,
  outstandingSuppliers: (params: OutstandingSuppliersParams) =>
    [...accountingQueryKeys.all, "outstanding-suppliers", params] as const,
  customerSummary: (customerId: string) =>
    [...accountingQueryKeys.all, "customer-summary", customerId] as const,
  supplierSummary: (supplierId: string) =>
    [...accountingQueryKeys.all, "supplier-summary", supplierId] as const,
  customerLedger: (
    customerId: string,
    params: { page: number; pageSize: number; sortOrder: "asc" | "desc"; dateFrom?: string; dateTo?: string },
  ) => [...accountingQueryKeys.all, "customer-ledger", customerId, params] as const,
  supplierLedger: (
    supplierId: string,
    params: { page: number; pageSize: number; sortOrder: "asc" | "desc"; dateFrom?: string; dateTo?: string },
  ) => [...accountingQueryKeys.all, "supplier-ledger", supplierId, params] as const,
  supplierOptions: (search?: string) =>
    [...accountingQueryKeys.all, "supplier-options", search ?? ""] as const,
};

export const listAccountingCustomerPayments = (params: CustomerPaymentsParams) =>
  apiRequest<CustomerPaymentsResponse>({
    method: "GET",
    url: "/accounting/customers/payments",
    params: cleanParams({
      search: params.search,
      customerId: params.customerId,
      saleId: params.saleId,
      paymentMethod: params.paymentMethod,
      status: params.status,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const createAccountingCustomerPayment = (
  payload: SaveCustomerAccountingPaymentPayload,
) =>
  apiRequest<CustomerPaymentsResponse["items"][number]>({
    method: "POST",
    url: "/accounting/customers/payments",
    data: payload,
  });

export const getCustomerDueSummary = (customerId: string) =>
  apiRequest<CustomerDueSummary>({
    method: "GET",
    url: `/accounting/customers/${customerId}/summary`,
  });

export const getCustomerLedger = (
  customerId: string,
  params: { page: number; pageSize: number; sortOrder: "asc" | "desc"; dateFrom?: string; dateTo?: string },
) =>
  apiRequest<CustomerLedgerResponse>({
    method: "GET",
    url: `/accounting/customers/${customerId}/ledger`,
    params: cleanParams({
      page: params.page,
      pageSize: params.pageSize,
      sortOrder: params.sortOrder,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    }),
  });

export const listOutstandingCustomers = (params: OutstandingCustomersParams) =>
  apiRequest<OutstandingCustomersResponse>({
    method: "GET",
    url: "/accounting/customers/outstanding",
    params: cleanParams({
      search: params.search,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const listAccountingSupplierPayments = (params: SupplierPaymentsParams) =>
  apiRequest<SupplierPaymentsResponse>({
    method: "GET",
    url: "/accounting/suppliers/payments",
    params: cleanParams({
      search: params.search,
      supplierId: params.supplierId,
      purchaseId: params.purchaseId,
      paymentMethod: params.paymentMethod,
      status: params.status,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const createAccountingSupplierPayment = (
  payload: SaveSupplierAccountingPaymentPayload,
) =>
  apiRequest<SupplierPaymentsResponse["items"][number]>({
    method: "POST",
    url: "/accounting/suppliers/payments",
    data: payload,
  });

export const getSupplierDueSummary = (supplierId: string) =>
  apiRequest<SupplierDueSummary>({
    method: "GET",
    url: `/accounting/suppliers/${supplierId}/summary`,
  });

export const getSupplierLedger = (
  supplierId: string,
  params: { page: number; pageSize: number; sortOrder: "asc" | "desc"; dateFrom?: string; dateTo?: string },
) =>
  apiRequest<SupplierLedgerResponse>({
    method: "GET",
    url: `/accounting/suppliers/${supplierId}/ledger`,
    params: cleanParams({
      page: params.page,
      pageSize: params.pageSize,
      sortOrder: params.sortOrder,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    }),
  });

export const listOutstandingSuppliers = (params: OutstandingSuppliersParams) =>
  apiRequest<OutstandingSuppliersResponse>({
    method: "GET",
    url: "/accounting/suppliers/outstanding",
    params: cleanParams({
      search: params.search,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const listAccountingSupplierOptions = (search?: string) =>
  apiRequest<{ items: SupplierOption[] }>({
    method: "GET",
    url: "/accounting/suppliers/options",
    params: cleanParams({
      search,
      pageSize: 8,
    }),
  });
