import type { PaginatedResponse } from "./common";

export const PURCHASE_STATUSES = ["draft", "finalized", "cancelled"] as const;
export const PURCHASE_PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;
export const PURCHASE_WORKFLOW_STAGES = [
  "draft",
  "approved",
  "supplier_notified",
  "received",
  "cancelled",
] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];
export type PurchasePaymentStatus = (typeof PURCHASE_PAYMENT_STATUSES)[number];
export type PurchaseWorkflowStage = (typeof PURCHASE_WORKFLOW_STAGES)[number];

export interface PurchaseSupplierSummary {
  id: string;
  supplierName: string;
  companyName: string | null;
  contactPerson?: string | null;
  mobileNumber: string;
  email?: string | null;
  status: "active" | "inactive";
}

export interface PurchaseListItem {
  id: string;
  purchaseNumber: string;
  supplierInvoiceNumber: string | null;
  supplierInvoiceDate: string | null;
  purchaseDate: string;
  status: PurchaseStatus;
  paymentStatus: PurchasePaymentStatus;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  roundOffAmount: string;
  grandTotal: string;
  paidAmount: string;
  dueAmount: string;
  purchaseOrderApprovedAt: string | null;
  supplierNotifiedAt: string | null;
  finalizedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  workflowStage: PurchaseWorkflowStage;
  supplier: PurchaseSupplierSummary;
}

export interface PurchaseDetailItem {
  id: string;
  medicineBatchId: string | null;
  medicine: {
    id: string;
    medicineName: string;
    genericName: string;
    form: string;
    unit: string;
    reorderLevel: number;
    status: "active" | "inactive";
  };
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  freeQuantity: number;
  purchaseRate: string;
  saleRate: string;
  mrp: string;
  gstPercent: number;
  discountPercent: string;
  lineSubtotal: string;
  lineTaxAmount: string;
  lineTotal: string;
  alreadyReturnedQuantity: number;
  remainingReturnableQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseReturnHistoryItem {
  id: string;
  returnNumber: string;
  status: "draft" | "completed" | "cancelled";
  totalReturnAmount: string;
  createdAt: string;
  completedAt: string | null;
  createdBy: {
    id: string;
    fullName: string;
    role: "admin" | "staff" | "accountant";
  };
}

export interface PurchaseDetail extends PurchaseListItem {
  shopId: string;
  supplierId: string;
  notes: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  purchaseOrderApprovedByUserId: string | null;
  supplierNotifiedByUserId: string | null;
  supplier: PurchaseSupplierSummary;
  items: PurchaseDetailItem[];
  returnHistory: PurchaseReturnHistoryItem[];
  totalCompletedReturnedAmount: string;
}

export interface PurchaseItemInput {
  medicineId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  freeQuantity: number;
  purchaseRate: number;
  saleRate: number;
  mrp: number;
  gstPercent: 0 | 5 | 12 | 18 | 28;
  discountPercent: number;
}

export interface SavePurchasePayload {
  supplierId: string;
  supplierInvoiceNumber?: string | null;
  supplierInvoiceDate?: string | null;
  purchaseDate: string;
  paidAmount: number;
  roundOffAmount: number;
  notes?: string | null;
  items: PurchaseItemInput[];
}

export interface CancelPurchasePayload {
  notes?: string | null;
}

export interface PurchaseListParams {
  search?: string;
  supplierId?: string;
  status?: PurchaseStatus;
  paymentStatus?: PurchasePaymentStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "purchaseDate" | "purchaseNumber" | "createdAt" | "grandTotal";
  sortOrder?: "asc" | "desc";
}

export type PurchasesResponse = PaginatedResponse<PurchaseListItem>;
