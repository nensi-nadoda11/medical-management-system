import type { PaginatedResponse } from "./common";
import type { MasterStatus } from "./medicine";

export interface Supplier {
  id: string;
  shopId: string;
  supplierName: string;
  companyName: string | null;
  contactPerson: string | null;
  mobileNumber: string;
  alternateMobileNumber: string | null;
  email: string | null;
  gstNumber: string | null;
  drugLicenseNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  openingBalance: string;
  notes: string | null;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierListParams {
  search?: string;
  status?: MasterStatus;
  page?: number;
  pageSize?: number;
  sortBy?: "supplierName" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface SaveSupplierPayload {
  supplierName: string;
  companyName?: string | null;
  contactPerson?: string | null;
  mobileNumber: string;
  alternateMobileNumber?: string | null;
  email?: string | null;
  gstNumber?: string | null;
  drugLicenseNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  openingBalance: string;
  notes?: string | null;
  status: MasterStatus;
}

export interface UpdateSupplierStatusPayload {
  status: MasterStatus;
}

export type SuppliersResponse = PaginatedResponse<Supplier>;
