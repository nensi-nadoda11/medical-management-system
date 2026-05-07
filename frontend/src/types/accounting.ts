import type { PaginatedResponse } from "./common";

export const ACCOUNTING_PAYMENT_METHODS = [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "cheque",
] as const;

export type AccountingPaymentMethod = (typeof ACCOUNTING_PAYMENT_METHODS)[number];

export interface AccountingUserSummary {
  id: string;
  fullName: string;
  role: "admin" | "staff" | "accountant";
}

export interface CustomerPaymentListItem {
  id: string;
  customerId: string;
  saleId: string | null;
  amount: string;
  paymentMethod: AccountingPaymentMethod;
  status: "completed" | "cancelled";
  referenceNumber: string | null;
  notes: string | null;
  paymentDate: string;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    customerCode: string;
    fullName: string;
    mobileNumber: string;
  };
  linkedSale: {
    id: string;
    billNumber: string;
    billDate: string | null;
  } | null;
  receivedBy: AccountingUserSummary;
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

export interface SupplierPaymentListItem {
  id: string;
  supplierId: string;
  purchaseId: string | null;
  amount: string;
  paymentMethod: AccountingPaymentMethod;
  status: "completed" | "cancelled";
  referenceNumber: string | null;
  notes: string | null;
  paymentDate: string;
  createdAt: string;
  updatedAt: string;
  supplier: {
    id: string;
    supplierName: string;
    companyName: string | null;
    mobileNumber: string;
  };
  linkedPurchase: {
    id: string;
    purchaseNumber: string;
    purchaseDate: string;
  } | null;
  paidBy: AccountingUserSummary;
  allocations: Array<{
    purchaseId: string;
    purchaseNumber: string;
    purchaseDate: string;
    amount: string;
    grandTotal: string;
    dueAmount: string;
    paymentStatus: "unpaid" | "partial" | "paid";
  }>;
}

export interface CustomerOutstandingSummaryItem {
  id: string;
  customerCode: string;
  fullName: string;
  mobileNumber: string;
  status: "active" | "inactive";
  summary: {
    totalSales: string;
    totalReturns: string;
    totalPayments: string;
    billCount: number;
    openBillCount: number;
    outstandingAmount: string;
    balanceAmount: string;
    advanceAmount: string;
    lastBillDate: string | null;
    lastPaymentDate: string | null;
  };
}

export interface SupplierOutstandingSummaryItem {
  id: string;
  supplierName: string;
  companyName: string | null;
  mobileNumber: string;
  status: "active" | "inactive";
  summary: {
    totalPurchases: string;
    totalPayments: string;
    purchaseCount: number;
    openPurchaseCount: number;
    outstandingAmount: string;
    balanceAmount: string;
    advanceAmount: string;
    lastPurchaseDate: string | null;
    lastPaymentDate: string | null;
  };
}

export interface CustomerDueSummary {
  customer: {
    id: string;
    customerCode: string;
    fullName: string;
    mobileNumber: string;
    status: "active" | "inactive";
  };
  summary: CustomerOutstandingSummaryItem["summary"];
  openSales: Array<{
    id: string;
    billNumber: string;
    billDate: string;
    grandTotal: string;
    netTotal: string;
    returnedAmount: string;
    initialPaidAmount: string;
    allocatedAmount: string;
    dueAmount: string;
    paymentStatus: "unpaid" | "partial" | "paid";
  }>;
}

export interface SupplierDueSummary {
  supplier: {
    id: string;
    supplierName: string;
    companyName: string | null;
    mobileNumber: string;
    status: "active" | "inactive";
  };
  summary: SupplierOutstandingSummaryItem["summary"];
  openPurchases: Array<{
    id: string;
    purchaseNumber: string;
    purchaseDate: string;
    grandTotal: string;
    initialPaidAmount: string;
    allocatedAmount: string;
    dueAmount: string;
    paymentStatus: "unpaid" | "partial" | "paid";
  }>;
}

export interface LedgerEntryItem {
  id: string;
  shopId: string;
  entityType: "customer" | "supplier";
  entityId: string;
  transactionType:
    | "opening_balance"
    | "sale"
    | "sale_return"
    | "payment_received"
    | "purchase"
    | "purchase_return"
    | "payment_made";
  debit: string;
  credit: string;
  balanceAfter: string;
  entryDate: string;
  referenceType:
    | "opening_balance"
    | "sale"
    | "sale_return"
    | "customer_payment"
    | "supplier_payment"
    | "purchase"
    | "purchase_return";
  referenceId: string;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: string;
  createdBy: AccountingUserSummary | null;
}

export interface CustomerLedgerResponse {
  customer: CustomerDueSummary["customer"];
  summary: CustomerDueSummary["summary"] | null;
  ledger: PaginatedResponse<LedgerEntryItem>;
}

export interface SupplierLedgerResponse {
  supplier: SupplierDueSummary["supplier"];
  summary: SupplierDueSummary["summary"] | null;
  ledger: PaginatedResponse<LedgerEntryItem>;
}

export interface SupplierOption {
  id: string;
  supplierName: string;
  companyName: string | null;
  mobileNumber: string;
  status: "active" | "inactive";
  openingBalance: string;
}

export interface CustomerPaymentsParams {
  search?: string;
  customerId?: string;
  saleId?: string;
  paymentMethod?: AccountingPaymentMethod;
  status?: "completed" | "cancelled";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "paymentDate" | "createdAt" | "amount";
  sortOrder?: "asc" | "desc";
}

export interface SupplierPaymentsParams {
  search?: string;
  supplierId?: string;
  purchaseId?: string;
  paymentMethod?: AccountingPaymentMethod;
  status?: "completed" | "cancelled";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "paymentDate" | "createdAt" | "amount";
  sortOrder?: "asc" | "desc";
}

export interface OutstandingCustomersParams {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "fullName" | "outstandingAmount" | "lastBillDate";
  sortOrder?: "asc" | "desc";
}

export interface OutstandingSuppliersParams {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "supplierName" | "outstandingAmount" | "lastPurchaseDate";
  sortOrder?: "asc" | "desc";
}

export interface OutstandingCustomersListSummary {
  entityCount: number;
  openBillCount: number;
  totalOutstandingAmount: string;
  totalAdvanceAmount: string;
}

export interface OutstandingSuppliersListSummary {
  entityCount: number;
  openPurchaseCount: number;
  totalOutstandingAmount: string;
  totalAdvanceAmount: string;
}

export interface SaveCustomerAccountingPaymentPayload {
  customerId: string;
  saleId?: string;
  amount: number;
  paymentMethod: AccountingPaymentMethod;
  referenceNumber?: string | null;
  notes?: string | null;
  paymentDate: string;
}

export interface SaveSupplierAccountingPaymentPayload {
  supplierId: string;
  purchaseId?: string;
  amount: number;
  paymentMethod: AccountingPaymentMethod;
  referenceNumber?: string | null;
  notes?: string | null;
  paymentDate: string;
}

export interface CustomerPaymentsResponse
  extends PaginatedResponse<CustomerPaymentListItem> {
  summary: {
    totalPayments: number;
    totalAmount: string;
  };
}

export interface SupplierPaymentsResponse
  extends PaginatedResponse<SupplierPaymentListItem> {
  summary: {
    totalPayments: number;
    totalAmount: string;
  };
}
export interface OutstandingCustomersResponse
  extends PaginatedResponse<CustomerOutstandingSummaryItem> {
  summary: OutstandingCustomersListSummary;
}

export interface OutstandingSuppliersResponse
  extends PaginatedResponse<SupplierOutstandingSummaryItem> {
  summary: OutstandingSuppliersListSummary;
}
