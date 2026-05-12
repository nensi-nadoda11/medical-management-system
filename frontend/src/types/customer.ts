import type { PaginatedResponse } from "./common";
import type { MasterStatus } from "./medicine";

export const CUSTOMER_GENDERS = ["male", "female", "other"] as const;
export const CUSTOMER_PAYMENT_METHODS = [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "cheque",
] as const;

export type CustomerGender = (typeof CUSTOMER_GENDERS)[number];
export type CustomerPaymentMethod = (typeof CUSTOMER_PAYMENT_METHODS)[number];

export interface CustomerSummary {
  totalBills: number;
  totalPurchaseAmount: string;
  totalDueAmount: string;
  lastPurchaseDate: string | null;
}

export interface CustomerDeletionState {
  canDelete: boolean;
  hasHeldBills: boolean;
  hasOutstandingDue: boolean;
  hasAdvanceBalance: boolean;
  hasPaymentHistory: boolean;
}

export interface CustomerListItem {
  id: string;
  shopId: string;
  customerCode: string;
  fullName: string;
  mobileNumber: string;
  alternateMobileNumber: string | null;
  email: string | null;
  gender: CustomerGender | null;
  age: number | null;
  dateOfBirth: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  notes: string | null;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
  deletion: CustomerDeletionState;
  summary: CustomerSummary;
}

export interface CustomerOption {
  id: string;
  customerCode: string;
  fullName: string;
  mobileNumber: string;
  city: string | null;
  status: MasterStatus;
  totalDueAmount: string;
  lastPurchaseDate: string | null;
}

export interface CustomerPurchaseHistoryItem {
  id: string;
  billNumber: string;
  billDate: string;
  grandTotal: string;
  paidAmount: string;
  dueAmount: string;
  paymentStatus: "unpaid" | "partial" | "paid";
  paymentMethod: "cash" | "upi" | "card" | "bank_transfer" | "split";
  createdBy: {
    id: string;
    fullName: string;
    role: "admin" | "staff" | "accountant";
  };
}

export interface CustomerPaymentHistoryItem {
  id: string;
  customerId: string;
  saleId: string | null;
  linkedBillNumber: string | null;
  amount: string;
  paymentMethod: CustomerPaymentMethod;
  referenceNumber: string | null;
  notes: string | null;
  paymentDate: string;
  createdAt: string;
  receivedBy: {
    id: string;
    fullName: string;
    role: "admin" | "staff" | "accountant";
  };
  allocations: Array<{
    saleId: string;
    billNumber: string;
    billDate: string | null;
    amount: string;
    grandTotal: string;
    dueAmount: string;
    paymentStatus: "unpaid" | "partial" | "paid";
  }>;
}

export interface CustomerDetail extends CustomerListItem {
  summary: CustomerSummary & {
    totalPaymentsReceived: string;
    lastPaymentDate: string | null;
  };
  recentPurchases: CustomerPurchaseHistoryItem[];
  recentPayments: CustomerPaymentHistoryItem[];
}

export interface CustomerListParams {
  search?: string;
  status?: MasterStatus;
  page?: number;
  pageSize?: number;
  sortBy?:
    | "fullName"
    | "customerCode"
    | "createdAt"
    | "updatedAt"
    | "lastPurchaseDate"
    | "totalPurchaseAmount"
    | "dueAmount";
  sortOrder?: "asc" | "desc";
}

export interface CustomerDueSummaryParams {
  search?: string;
  status?: MasterStatus;
  page?: number;
  pageSize?: number;
  sortBy?: "fullName" | "dueAmount" | "lastPurchaseDate";
  sortOrder?: "asc" | "desc";
}

export interface CustomerHistoryParams {
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "billDate" | "grandTotal" | "dueAmount";
  sortOrder?: "asc" | "desc";
}

export interface CustomerPaymentHistoryParams {
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "paymentDate" | "createdAt" | "amount";
  sortOrder?: "asc" | "desc";
}

export interface SaveCustomerPayload {
  fullName: string;
  mobileNumber: string;
  alternateMobileNumber?: string | null;
  email?: string | null;
  gender?: CustomerGender | null;
  age?: number | null;
  dateOfBirth?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  notes?: string | null;
  status: MasterStatus;
}

export interface UpdateCustomerStatusPayload {
  status: MasterStatus;
}

export interface SaveCustomerPaymentPayload {
  saleId?: string;
  amount: number;
  paymentMethod: CustomerPaymentMethod;
  referenceNumber?: string | null;
  notes?: string | null;
  paymentDate: string;
}

export type CustomersResponse = PaginatedResponse<CustomerListItem>;
export type CustomerDueSummaryResponse = PaginatedResponse<CustomerListItem>;
export type CustomerPurchasesResponse = PaginatedResponse<CustomerPurchaseHistoryItem>;
export type CustomerPaymentsResponse = PaginatedResponse<CustomerPaymentHistoryItem>;
