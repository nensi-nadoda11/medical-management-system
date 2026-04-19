import type { PaginatedResponse } from "./common";

export const SALES_RETURN_STATUSES = ["draft", "completed", "cancelled"] as const;
export const SALES_RETURN_REFUND_STATUSES = [
  "pending",
  "processed",
  "not_required",
] as const;
export const SALES_RETURN_REFUND_METHODS = [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "adjustment",
] as const;

export type SalesReturnStatus = (typeof SALES_RETURN_STATUSES)[number];
export type SalesReturnRefundStatus =
  (typeof SALES_RETURN_REFUND_STATUSES)[number];
export type SalesReturnRefundMethod =
  (typeof SALES_RETURN_REFUND_METHODS)[number];

export interface SalesReturnUserSummary {
  id: string;
  fullName: string;
  role: "admin" | "staff" | "accountant";
}

export interface SalesReturnListItem {
  id: string;
  saleId: string;
  returnNumber: string;
  billNumber: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerLabel: string;
  status: SalesReturnStatus;
  refundStatus: SalesReturnRefundStatus;
  refundMethod: SalesReturnRefundMethod | null;
  totalReturnAmount: string;
  refundAmount: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  createdBy: SalesReturnUserSummary;
}

export interface SalesReturnDetailItem {
  id: string;
  saleItemId: string;
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
  soldQuantity: number;
  quantity: number;
  rate: string;
  taxPercent: number;
  discountAmount: string;
  lineReturnAmount: string;
  reason: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesReturnDetail {
  id: string;
  shopId: string;
  saleId: string;
  returnNumber: string;
  status: SalesReturnStatus;
  totalReturnAmount: string;
  refundAmount: string;
  refundMethod: SalesReturnRefundMethod | null;
  refundStatus: SalesReturnRefundStatus;
  notes: string | null;
  createdByUserId: string;
  completedByUserId: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: SalesReturnUserSummary;
  completedBy: SalesReturnUserSummary | null;
  sale: {
    id: string;
    billNumber: string;
    customerId: string | null;
    customerName: string | null;
    customerPhone: string | null;
    customerLabel: string;
    status: "held" | "completed" | "cancelled";
    paymentStatus: "unpaid" | "partial" | "paid";
    paymentMethod: string;
    subtotal: string;
    discountAmount: string;
    taxAmount: string;
    roundOffAmount: string;
    grandTotal: string;
    paidAmount: string;
    dueAmount: string;
    completedAt: string | null;
  };
  items: SalesReturnDetailItem[];
}

export interface ReturnableSaleDetailItem {
  saleItemId: string;
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
  quantitySold: number;
  alreadyReturnedQuantity: number;
  remainingReturnableQuantity: number;
  rate: string;
  taxPercent: number;
  discountPercent: string;
  lineTotal: string;
}

export interface ReturnableSaleDetail {
  sale: {
    id: string;
    billNumber: string;
    customerId: string | null;
    customerName: string | null;
    customerPhone: string | null;
    customerLabel: string;
    status: "held" | "completed" | "cancelled";
    paymentStatus: "unpaid" | "partial" | "paid";
    paymentMethod: string;
    subtotal: string;
    discountAmount: string;
    taxAmount: string;
    grandTotal: string;
    paidAmount: string;
    dueAmount: string;
    notes: string | null;
    completedAt: string | null;
    createdBy: SalesReturnUserSummary;
  };
  items: ReturnableSaleDetailItem[];
}

export interface SaveSalesReturnItemPayload {
  saleItemId: string;
  quantity: number;
  reason: string;
  notes?: string | null;
}

export interface CreateSalesReturnPayload {
  saleId: string;
  refundAmount: number;
  refundMethod?: SalesReturnRefundMethod;
  refundStatus: SalesReturnRefundStatus;
  notes?: string | null;
  items: SaveSalesReturnItemPayload[];
}

export interface UpdateSalesReturnPayload {
  refundAmount: number;
  refundMethod?: SalesReturnRefundMethod;
  refundStatus: SalesReturnRefundStatus;
  notes?: string | null;
  items: SaveSalesReturnItemPayload[];
}

export interface SalesReturnListParams {
  search?: string;
  saleId?: string;
  status?: SalesReturnStatus;
  refundStatus?: SalesReturnRefundStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "completedAt" | "returnNumber" | "totalReturnAmount";
  sortOrder?: "asc" | "desc";
}

export type SalesReturnsResponse = PaginatedResponse<SalesReturnListItem>;
