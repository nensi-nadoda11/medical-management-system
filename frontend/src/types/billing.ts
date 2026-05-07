import type { PaginatedResponse } from "./common";

export const BILL_STATUSES = ["held", "completed", "cancelled"] as const;
export const BILL_PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;
export const BILL_PAYMENT_METHODS = [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "split",
] as const;

export type BillStatus = (typeof BILL_STATUSES)[number];
export type BillPaymentStatus = (typeof BILL_PAYMENT_STATUSES)[number];
export type BillPaymentMethod = (typeof BILL_PAYMENT_METHODS)[number];

export interface BillingUserSummary {
  id: string;
  fullName: string;
  role: "admin" | "staff" | "accountant";
}

export interface BillListItem {
  id: string;
  billNumber: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerLabel: string;
  status: BillStatus;
  paymentStatus: BillPaymentStatus;
  paymentMethod: BillPaymentMethod;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  roundOffAmount: string;
  grandTotal: string;
  initialPaidAmount: string;
  paidAmount: string;
  dueAmount: string;
  notes: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: BillingUserSummary;
}

export interface BillDetailItem {
  id: string;
  medicine: {
    id: string;
    medicineName: string;
    genericName: string;
    form: string;
    unit: string;
    prescriptionRequired: boolean;
    status: "active" | "inactive";
  };
  batch: {
    id: string;
    batchNumber: string;
    expiryDate: string;
    status: "active" | "exhausted" | "expired";
    quantityAvailable: number;
    isNearExpiry: boolean;
  };
  quantity: number;
  rate: string;
  mrp: string;
  gstPercent: number;
  discountPercent: string;
  discountAmount: string;
  lineSubtotal: string;
  lineTaxAmount: string;
  lineTotal: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillDetail extends BillListItem {
  shopId: string;
  billSequence: number;
  createdByUserId: string;
  updatedByUserId: string;
  updatedBy: BillingUserSummary;
  items: BillDetailItem[];
}

export interface BillingMedicineSearchItem {
  medicine: {
    id: string;
    medicineName: string;
    genericName: string;
    brandName?: string | null;
    barcode?: string | null;
    form: string;
    unit: string;
    prescriptionRequired: boolean;
    gstPercent: number;
  };
  availableQuantity: number;
  activeBatchCount: number;
  nextExpiryDate: string | null;
}

export interface BillingMedicineBatchOption {
  id: string;
  batchNumber: string;
  expiryDate: string;
  saleRate: string;
  mrp: string;
  gstPercent: number;
  quantityAvailable: number;
  status: "active" | "exhausted" | "expired";
  daysUntilExpiry: number;
  isNearExpiry: boolean;
}

export interface BillingMedicineOptions {
  medicine: {
    id: string;
    medicineName: string;
    genericName: string;
    brandName?: string | null;
    barcode?: string | null;
    form: string;
    unit: string;
    prescriptionRequired: boolean;
  };
  availableQuantity: number;
  defaultBatchId: string | null;
  batches: BillingMedicineBatchOption[];
}

export interface BillItemPayload {
  medicineId: string;
  batchId?: string;
  quantity: number;
  discountPercent: number;
}

export interface SaveBillPayload {
  customerId?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  paymentMethod: BillPaymentMethod;
  paidAmount: number;
  roundOffAmount: number;
  notes?: string | null;
  items: BillItemPayload[];
}

export interface BillListParams {
  search?: string;
  status?: BillStatus;
  paymentStatus?: BillPaymentStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "completedAt" | "billNumber" | "grandTotal";
  sortOrder?: "asc" | "desc";
}

export interface BillingMedicineSearchParams {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "medicineName" | "availableQuantity" | "nextExpiryDate";
  sortOrder?: "asc" | "desc";
}

export interface BillsResponse extends PaginatedResponse<BillListItem> {
  summary: {
    totalBills: number;
    grandTotal: string;
    paidAmount: string;
    dueAmount: string;
  };
}
export type BillingMedicineSearchResponse = PaginatedResponse<BillingMedicineSearchItem>;
