import type { PaginatedResponse } from "./common";

export const BATCH_STATUSES = ["active", "exhausted", "expired"] as const;
export const STOCK_TRANSACTION_TYPES = [
  "purchase_in",
  "adjustment_in",
  "adjustment_out",
] as const;
export const EXPIRY_WINDOWS = ["expired", "30", "60", "90"] as const;

export type BatchStatus = (typeof BATCH_STATUSES)[number];
export type StockTransactionType = (typeof STOCK_TRANSACTION_TYPES)[number];
export type ExpiryWindow = (typeof EXPIRY_WINDOWS)[number];

export interface InventoryMedicineSummary {
  id: string;
  medicineName: string;
  genericName: string;
  brandName?: string | null;
  form: string;
  unit: string;
  reorderLevel: number;
  status: "active" | "inactive";
  updatedAt?: string;
}

export interface InventorySummaryItem {
  medicine: InventoryMedicineSummary;
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
  isLowStock: boolean;
  activeBatchCount: number;
}

export interface InventoryBatch {
  id: string;
  shopId: string;
  medicineId: string;
  batchNumber: string;
  batchNumberNormalized: string;
  expiryDate: string;
  purchaseRate: string;
  saleRate: string;
  mrp: string;
  gstPercent: number;
  quantityReceived: number;
  quantityAvailable: number;
  status: BatchStatus;
  createdAt: string;
  updatedAt: string;
  isExpired?: boolean;
}

export interface InventoryTransaction {
  id: string;
  shopId: string;
  medicineId: string;
  batchId: string;
  transactionType: StockTransactionType;
  quantityIn: number;
  quantityOut: number;
  balanceAfter: number;
  referenceType: "purchase_item" | "stock_adjustment";
  referenceId: string;
  notes: string | null;
  createdByUserId: string;
  createdAt: string;
  medicine: {
    id: string;
    medicineName: string;
    genericName: string;
  };
  batch: {
    id: string;
    batchNumber: string;
    expiryDate: string;
    status: BatchStatus;
  };
}

export interface InventoryMedicineDetail {
  medicine: InventoryMedicineSummary;
  category: {
    id: string;
    name: string;
  };
  manufacturer: {
    id: string;
    name: string;
  };
  availableQuantity: number;
  activeBatchCount: number;
  isLowStock: boolean;
  batches: InventoryBatch[];
  recentTransactions: InventoryTransaction[];
}

export interface ExpiryReportItem extends InventoryBatch {
  medicine: {
    id: string;
    medicineName: string;
    genericName: string;
    reorderLevel: number;
  };
  expiryStatus: "expired" | "next_30_days" | "next_60_days" | "next_90_days" | "safe";
}

export interface InventorySummaryParams {
  search?: string;
  categoryId?: string;
  manufacturerId?: string;
  lowStockOnly?: boolean;
  medicineStatus?: "active" | "inactive";
  batchStatus?: BatchStatus;
  page?: number;
  pageSize?: number;
  sortBy?: "medicineName" | "availableQuantity" | "reorderLevel" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface StockTransactionsParams {
  medicineId?: string;
  batchId?: string;
  transactionType?: StockTransactionType;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface LowStockParams {
  search?: string;
  categoryId?: string;
  manufacturerId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "medicineName" | "availableQuantity" | "reorderLevel";
  sortOrder?: "asc" | "desc";
}

export interface ExpiryReportParams {
  search?: string;
  medicineId?: string;
  expiryWindow?: ExpiryWindow;
  page?: number;
  pageSize?: number;
  sortBy?: "expiryDate" | "medicineName";
  sortOrder?: "asc" | "desc";
}

export interface CreateStockAdjustmentPayload {
  medicineId: string;
  batchId: string;
  adjustmentType: "in" | "out";
  quantity: number;
  reason: string;
  notes?: string | null;
}

export interface StockAdjustmentResponse {
  adjustment: {
    id: string;
    shopId: string;
    medicineId: string;
    batchId: string;
    adjustmentType: "in" | "out";
    quantity: number;
    reason: string;
    notes: string | null;
    createdByUserId: string;
    createdAt: string;
  };
  batch: InventoryBatch;
}

export type InventorySummaryResponse = PaginatedResponse<InventorySummaryItem>;
export type InventoryTransactionsResponse = PaginatedResponse<InventoryTransaction>;
export type ExpiryReportResponse = PaginatedResponse<ExpiryReportItem>;
