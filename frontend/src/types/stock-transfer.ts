import type { PaginatedResponse } from "./common";

export interface TransferBranchSummary {
  id: string;
  name: string;
  code: string;
}

export interface TransferActorSummary {
  id: string;
  fullName: string;
  role: "admin" | "staff" | "accountant";
}

export interface TransferBatchOption {
  batch: {
    id: string;
    medicineId: string;
    batchNumber: string;
    expiryDate: string;
    purchaseRate: string;
    saleRate: string;
    quantityAvailable: number;
    mrp: string;
    gstPercent: string;
    status: "active" | "exhausted" | "expired";
  };
  medicine: {
    id: string;
    medicineName: string;
    genericName: string;
    form: string;
    unit: string;
  };
}

export interface StockTransferRecord {
  id: string;
  fromBranch: TransferBranchSummary;
  toBranch: TransferBranchSummary;
  status: "draft" | "completed" | "cancelled";
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  createdBy: TransferActorSummary;
}

export type StockTransferListResponse = PaginatedResponse<StockTransferRecord>;

export interface CreateStockTransferPayload {
  fromBranchId: string;
  toBranchId: string;
  notes?: string;
  items: Array<{
    sourceBatchId: string;
    medicineId: string;
    quantity: number;
  }>;
}
