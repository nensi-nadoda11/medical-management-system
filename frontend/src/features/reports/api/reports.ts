import { apiClient, apiRequest } from "../../../lib/api";
import type {
  DashboardSummary,
  ExpiryReport,
  ExpiryReportParams,
  LowStockReport,
  LowStockReportParams,
  ProfitReport,
  ProfitReportParams,
  SalesReport,
  SalesReportParams,
  StockReport,
  StockReportParams,
  SupplierReport,
  SupplierReportParams,
} from "../../../types/report";

const cleanParams = (params: object) =>
  Object.fromEntries(
    Object.entries(
      params as Record<string, string | number | boolean | undefined>,
    ).filter(([, value]) => value !== undefined && value !== ""),
  );

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

const parseFilename = (header?: string | null, fallback = "report") => {
  if (!header) {
    return fallback;
  }

  const match = /filename="?([^"]+)"?/i.exec(header);
  return match?.[1] ?? fallback;
};

const downloadReportExport = async (
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  fallbackFilename: string,
) => {
  const response = await apiClient.get(path, {
    params: cleanParams(params),
    responseType: "blob",
  });

  downloadBlob(
    response.data,
    parseFilename(response.headers["content-disposition"], fallbackFilename),
  );
};

export const reportsQueryKeys = {
  all: ["reports"] as const,
  dashboard: ["reports", "dashboard"] as const,
  sales: (params: SalesReportParams) => [...reportsQueryKeys.all, "sales", params] as const,
  profit: (params: ProfitReportParams) => [...reportsQueryKeys.all, "profit", params] as const,
  stock: (params: StockReportParams) => [...reportsQueryKeys.all, "stock", params] as const,
  lowStock: (params: LowStockReportParams) =>
    [...reportsQueryKeys.all, "low-stock", params] as const,
  expiry: (params: ExpiryReportParams) => [...reportsQueryKeys.all, "expiry", params] as const,
  suppliers: (params: SupplierReportParams) =>
    [...reportsQueryKeys.all, "suppliers", params] as const,
};

export const getReportsDashboardSummary = (params: { dateFrom?: string; dateTo?: string }) =>
  apiRequest<DashboardSummary>({
    method: "GET",
    url: "/reports/dashboard/summary",
    params: cleanParams(params),
  });

export const getSalesReport = (params: SalesReportParams) =>
  apiRequest<SalesReport>({
    method: "GET",
    url: "/reports/sales",
    params: cleanParams(params),
  });

export const exportSalesReport = (params: SalesReportParams, format: "xlsx" | "pdf") =>
  downloadReportExport("/reports/sales/export", { ...params, format }, `sales-report.${format}`);

export const getProfitReport = (params: ProfitReportParams) =>
  apiRequest<ProfitReport>({
    method: "GET",
    url: "/reports/profit",
    params: cleanParams(params),
  });

export const exportProfitReport = (params: ProfitReportParams, format: "xlsx" | "pdf") =>
  downloadReportExport("/reports/profit/export", { ...params, format }, `profit-report.${format}`);

export const getStockReport = (params: StockReportParams) =>
  apiRequest<StockReport>({
    method: "GET",
    url: "/reports/stock",
    params: cleanParams(params),
  });

export const exportStockReport = (params: StockReportParams, format: "xlsx" | "pdf") =>
  downloadReportExport("/reports/stock/export", { ...params, format }, `stock-report.${format}`);

export const getLowStockReport = (params: LowStockReportParams) =>
  apiRequest<LowStockReport>({
    method: "GET",
    url: "/reports/low-stock",
    params: cleanParams(params),
  });

export const exportLowStockReport = (
  params: LowStockReportParams,
  format: "xlsx" | "pdf",
) =>
  downloadReportExport(
    "/reports/low-stock/export",
    { ...params, format },
    `low-stock-report.${format}`,
  );

export const getExpiryReport = (params: ExpiryReportParams) =>
  apiRequest<ExpiryReport>({
    method: "GET",
    url: "/reports/expiry",
    params: cleanParams(params),
  });

export const exportExpiryReport = (params: ExpiryReportParams, format: "xlsx" | "pdf") =>
  downloadReportExport("/reports/expiry/export", { ...params, format }, `expiry-report.${format}`);

export const getSupplierReport = (params: SupplierReportParams) =>
  apiRequest<SupplierReport>({
    method: "GET",
    url: "/reports/suppliers",
    params: cleanParams(params),
  });

export const exportSupplierReport = (
  params: SupplierReportParams,
  format: "xlsx" | "pdf",
) =>
  downloadReportExport(
    "/reports/suppliers/export",
    { ...params, format },
    `supplier-report.${format}`,
  );
