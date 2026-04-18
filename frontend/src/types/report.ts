import type { PaginatedResponse } from "./common";

export interface ReportMetricCard {
  label: string;
  value: string | number;
  hint?: string;
}

export interface DashboardSummary {
  todaySales: {
    totalSales: string;
    totalBills: number;
  };
  monthlySales: {
    totalSales: string;
    totalBills: number;
  };
  totalProfit: string;
  lowStockCount: number;
  expiryCount: number;
  expiryBreakdown: {
    expired: number;
    next30Days: number;
    next60Days: number;
    next90Days: number;
  };
}

export interface ReportDateFilters {
  dateFrom?: string;
  dateTo?: string;
}

export interface SalesReportRow {
  id: string;
  billNumber: string;
  customerName: string;
  paymentMethod: "cash" | "upi" | "card" | "bank_transfer" | "split";
  paymentStatus: "unpaid" | "partial" | "paid";
  grandTotal: string;
  paidAmount: string;
  dueAmount: string;
  completedAt: string | null;
  createdBy: {
    id: string;
    fullName: string;
    role: "admin" | "staff" | "accountant";
  };
}

export interface SalesTrendRow {
  periodStart: string;
  totalSales: string;
  totalBills: number;
  averageBillValue: string;
}

export interface SalesReport {
  filters: {
    dateRangeLabel: string;
    groupBy: "day" | "month";
  };
  summary: {
    totalSales: string;
    totalBills: number;
    averageBillValue: string;
    paymentBreakdown: Array<{
      paymentMethod: "cash" | "upi" | "card" | "bank_transfer" | "split";
      totalSales: string;
      totalBills: number;
    }>;
  };
  trend: SalesTrendRow[];
  rows: PaginatedResponse<SalesReportRow>;
}

export interface ProfitReportRow {
  saleId: string;
  billNumber: string;
  customerName: string;
  completedAt: string | null;
  createdBy: {
    id: string;
    fullName: string;
    role: "admin" | "staff" | "accountant";
  };
  revenue: string;
  cost: string;
  profit: string;
  profitPercent: string;
}

export interface ProfitTrendRow {
  periodStart: string;
  revenue: string;
  cost: string;
  profit: string;
  profitPercent: string;
}

export interface ProfitReport {
  filters: {
    dateRangeLabel: string;
    groupBy: "day" | "month";
  };
  summary: {
    revenue: string;
    cost: string;
    profit: string;
    profitPercent: string;
  };
  trend: ProfitTrendRow[];
  rows: PaginatedResponse<ProfitReportRow>;
}

export interface StockReportRow {
  batch: {
    id: string;
    batchNumber: string;
    expiryDate: string;
    purchaseRate: string;
    saleRate: string;
    quantityAvailable: number;
    status: "active" | "exhausted" | "expired";
  };
  medicine: {
    id: string;
    medicineName: string;
    genericName: string;
    form: string;
    unit: string;
    reorderLevel: number;
  };
  category: {
    id: string;
    name: string;
  };
  manufacturer: {
    id: string;
    name: string;
  };
  stockValue: string;
}

export interface StockReport {
  summary: {
    totalMedicines: number;
    totalBatches: number;
    totalUnits: number;
    stockValuation: string;
    lowStockCount: number;
  };
  rows: PaginatedResponse<StockReportRow>;
}

export interface LowStockReportRow {
  medicine: {
    id: string;
    medicineName: string;
    genericName: string;
    form: string;
    unit: string;
    reorderLevel: number;
  };
  category: {
    id: string;
    name: string;
  };
  manufacturer: {
    id: string;
    name: string;
  };
  availableQuantity: number;
  reorderLevel: number;
  shortage: number;
}

export interface LowStockReport {
  summary: {
    totalMedicines: number;
    totalShortage: number;
  };
  rows: PaginatedResponse<LowStockReportRow>;
}

export interface ExpiryReportRow {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantityAvailable: number;
  status: "active" | "exhausted" | "expired";
  medicine: {
    id: string;
    medicineName: string;
    genericName: string;
    reorderLevel: number;
  };
  expiryStatus: "expired" | "next_30_days" | "next_60_days" | "next_90_days" | "safe";
}

export interface ExpiryReport {
  summary: {
    expiredCount: number;
    next30Count: number;
    next60Count: number;
    next90Count: number;
  };
  rows: PaginatedResponse<ExpiryReportRow>;
}

export interface SupplierReportRow {
  supplier: {
    id: string;
    supplierName: string;
    companyName: string | null;
    mobileNumber: string;
    status: "active" | "inactive";
  };
  purchaseCount: number;
  totalPurchase: string;
  totalPaid: string;
  totalDue: string;
}

export interface SupplierReport {
  filters: {
    dateRangeLabel: string;
  };
  summary: {
    supplierCount: number;
    totalPurchase: string;
    totalPaid: string;
    totalDue: string;
  };
  rows: PaginatedResponse<SupplierReportRow>;
}

export interface SalesReportParams extends ReportDateFilters {
  search?: string;
  groupBy?: "day" | "month";
  paymentMethod?: "cash" | "upi" | "card" | "bank_transfer" | "split";
  page?: number;
  pageSize?: number;
  sortBy?: "completedAt" | "billNumber" | "grandTotal";
  sortOrder?: "asc" | "desc";
}

export interface ProfitReportParams extends ReportDateFilters {
  search?: string;
  groupBy?: "day" | "month";
  page?: number;
  pageSize?: number;
  sortBy?: "completedAt" | "revenue" | "profit";
  sortOrder?: "asc" | "desc";
}

export interface StockReportParams {
  search?: string;
  categoryId?: string;
  manufacturerId?: string;
  batchStatus?: "active" | "exhausted" | "expired";
  page?: number;
  pageSize?: number;
  sortBy?: "medicineName" | "expiryDate" | "quantityAvailable" | "stockValue";
  sortOrder?: "asc" | "desc";
}

export interface LowStockReportParams {
  search?: string;
  categoryId?: string;
  manufacturerId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "medicineName" | "availableQuantity" | "reorderLevel" | "shortage";
  sortOrder?: "asc" | "desc";
}

export interface ExpiryReportParams {
  search?: string;
  medicineId?: string;
  expiryWindow?: "expired" | "30" | "60" | "90";
  page?: number;
  pageSize?: number;
  sortBy?: "expiryDate" | "medicineName";
  sortOrder?: "asc" | "desc";
}

export interface SupplierReportParams extends ReportDateFilters {
  search?: string;
  supplierId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "supplierName" | "totalPurchase" | "totalDue" | "purchaseCount";
  sortOrder?: "asc" | "desc";
}
