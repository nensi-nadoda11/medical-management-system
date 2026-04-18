import { apiRequest } from "../../../lib/api";
import type {
  CreateStockAdjustmentPayload,
  ExpiryReportParams,
  ExpiryReportResponse,
  InventoryMedicineDetail,
  InventorySummaryParams,
  InventorySummaryResponse,
  InventoryTransactionsResponse,
  LowStockParams,
  StockAdjustmentResponse,
  StockTransactionsParams,
} from "../../../types/inventory";

const cleanParams = (params: Record<string, string | number | boolean | undefined>) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
  );

export const inventoryQueryKeys = {
  all: ["inventory"] as const,
  summaries: () => [...inventoryQueryKeys.all, "summary"] as const,
  summary: (params: InventorySummaryParams) =>
    [...inventoryQueryKeys.summaries(), params] as const,
  details: () => [...inventoryQueryKeys.all, "detail"] as const,
  detail: (medicineId: string, includeTransactions: boolean) =>
    [...inventoryQueryKeys.details(), medicineId, includeTransactions] as const,
  transactions: () => [...inventoryQueryKeys.all, "transactions"] as const,
  transactionList: (params: StockTransactionsParams) =>
    [...inventoryQueryKeys.transactions(), params] as const,
  lowStock: (params: LowStockParams) => [...inventoryQueryKeys.all, "low-stock", params] as const,
  expiry: (params: ExpiryReportParams) => [...inventoryQueryKeys.all, "expiry", params] as const,
};

export const listInventorySummary = (params: InventorySummaryParams) =>
  apiRequest<InventorySummaryResponse>({
    method: "GET",
    url: "/inventory/summary",
    params: cleanParams({
      search: params.search,
      categoryId: params.categoryId,
      manufacturerId: params.manufacturerId,
      lowStockOnly: params.lowStockOnly,
      medicineStatus: params.medicineStatus,
      batchStatus: params.batchStatus,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const getInventoryMedicineDetail = (
  medicineId: string,
  includeTransactions = true,
) =>
  apiRequest<InventoryMedicineDetail>({
    method: "GET",
    url: `/inventory/medicines/${medicineId}`,
    params: cleanParams({
      includeTransactions,
    }),
  });

export const listStockTransactions = (params: StockTransactionsParams) =>
  apiRequest<InventoryTransactionsResponse>({
    method: "GET",
    url: "/inventory/transactions",
    params: cleanParams({
      medicineId: params.medicineId,
      batchId: params.batchId,
      transactionType: params.transactionType,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const listLowStock = (params: LowStockParams) =>
  apiRequest<InventorySummaryResponse>({
    method: "GET",
    url: "/inventory/low-stock",
    params: cleanParams({
      search: params.search,
      categoryId: params.categoryId,
      manufacturerId: params.manufacturerId,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const listExpiryReport = (params: ExpiryReportParams) =>
  apiRequest<ExpiryReportResponse>({
    method: "GET",
    url: "/inventory/expiry-report",
    params: cleanParams({
      search: params.search,
      medicineId: params.medicineId,
      expiryWindow: params.expiryWindow,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
  });

export const createStockAdjustment = (payload: CreateStockAdjustmentPayload) =>
  apiRequest<StockAdjustmentResponse>({
    method: "POST",
    url: "/inventory/adjustments",
    data: payload,
  });
