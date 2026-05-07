import type { PaginatedResponse } from "./common";

export const PURCHASE_RETURN_STATUSES = [
  "draft",
  "completed",
  "cancelled",
] as const;
export const PURCHASE_RETURN_REASONS = [
  "damaged_stock",
  "wrong_item",
  "near_expiry",
  "expired",
  "excess_stock",
  "purchase_mistake",
  "other",
] as const;
export const PURCHASE_RETURN_REFUND_STATUSES = [
  "pending",
  "processed",
  "not_required",
] as const;
export const PURCHASE_RETURN_REFUND_METHODS = [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "adjustment",
] as const;

export type PurchaseReturnStatus = (typeof PURCHASE_RETURN_STATUSES)[number];
export type PurchaseReturnReason = (typeof PURCHASE_RETURN_REASONS)[number];
export type PurchaseReturnRefundStatus =
  (typeof PURCHASE_RETURN_REFUND_STATUSES)[number];
export type PurchaseReturnRefundMethod =
  (typeof PURCHASE_RETURN_REFUND_METHODS)[number];

export interface PurchaseReturnSupplierSummary {
  id: string;
  supplierName: string;
  companyName: string | null;
  contactPerson?: string | null;
  mobileNumber: string;
  email?: string | null;
  status: "active" | "inactive";
}

export interface PurchaseReturnListItem {
  id: string;
  purchaseId: string;
  supplierId: string;
  returnNumber: string;
  purchaseNumber: string;
  supplierName: string;
  supplier: PurchaseReturnSupplierSummary;
  status: PurchaseReturnStatus;
  totalReturnAmount: string;
  refundAmount: string;
  refundMethod: PurchaseReturnRefundMethod | null;
  refundStatus: PurchaseReturnRefundStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  createdBy: {
    id: string;
    fullName: string;
    role: "admin" | "staff" | "accountant";
  };
}

export interface PurchaseReturnDetailItem {
  id: string;
  purchaseItemId: string;
  medicine: {
    id: string;
    medicineName: string;
    genericName: string;
    form: string;
    unit: string;
  };
  batch: {
    id: string;
    batchNumber: string;
    expiryDate: string;
    status: "active" | "exhausted" | "expired";
    quantityAvailable: number;
  };
  purchasedQuantity: number;
  freeQuantity: number;
  quantity: number;
  purchaseRate: string;
  taxPercent: number;
  discountAmount: string;
  lineReturnAmount: string;
  reason: PurchaseReturnReason;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseReturnDetail extends PurchaseReturnListItem {
  shopId: string;
  notes: string | null;
  createdByUserId: string;
  completedByUserId: string | null;
  purchase: {
    id: string;
    purchaseNumber: string;
    purchaseDate: string;
  status: "draft" | "finalized" | "cancelled";
  paymentStatus: "unpaid" | "partial" | "paid";
  grandTotal: string;
  paidAmount: string;
  dueAmount: string;
  netReturnCreditAmount: string;
  finalizedAt: string | null;
  };
  supplier: PurchaseReturnSupplierSummary;
  createdBy: {
    id: string;
    fullName: string;
    role: "admin" | "staff" | "accountant";
  };
  completedBy: {
    id: string;
    fullName: string;
    role: "admin" | "staff" | "accountant";
  } | null;
  items: PurchaseReturnDetailItem[];
}

export interface ReturnablePurchaseDetailItem {
  purchaseItemId: string;
  medicine: {
    id: string;
    medicineName: string;
    genericName: string;
    form: string;
    unit: string;
  };
  batch: {
    id: string;
    batchNumber: string;
    expiryDate: string;
    status: "active" | "exhausted" | "expired";
    quantityAvailable: number;
  };
  purchasedQuantity: number;
  freeQuantity: number;
  alreadyReturnedQuantity: number;
  remainingReturnableQuantity: number;
  availableBatchQuantity: number;
  maxReturnableQuantity: number;
  purchaseRate: string;
  taxPercent: number;
  discountPercent: string;
  lineTotal: string;
}

export interface ReturnablePurchaseDetail {
  purchase: {
    id: string;
    purchaseNumber: string;
    purchaseDate: string;
    status: "draft" | "finalized" | "cancelled";
    paymentStatus: "unpaid" | "partial" | "paid";
    grandTotal: string;
    paidAmount: string;
    dueAmount: string;
    notes: string | null;
    finalizedAt: string | null;
    createdBy: {
      id: string;
      fullName: string;
      role: "admin" | "staff" | "accountant";
    };
  };
  supplier: PurchaseReturnSupplierSummary;
  items: ReturnablePurchaseDetailItem[];
}

export interface PurchaseReturnItemInput {
  purchaseItemId: string;
  quantity: number;
  reason: PurchaseReturnReason;
  notes?: string;
}

export interface CreatePurchaseReturnPayload {
  purchaseId: string;
  refundAmount: number;
  refundMethod?: PurchaseReturnRefundMethod;
  refundStatus: PurchaseReturnRefundStatus;
  notes?: string;
  items: PurchaseReturnItemInput[];
}

export interface UpdatePurchaseReturnPayload {
  refundAmount: number;
  refundMethod?: PurchaseReturnRefundMethod;
  refundStatus: PurchaseReturnRefundStatus;
  notes?: string;
  items: PurchaseReturnItemInput[];
}

export interface PurchaseReturnListParams {
  search?: string;
  purchaseId?: string;
  supplierId?: string;
  status?: PurchaseReturnStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "completedAt" | "returnNumber" | "totalReturnAmount";
  sortOrder?: "asc" | "desc";
}

export type PurchaseReturnsResponse = PaginatedResponse<PurchaseReturnListItem>;
