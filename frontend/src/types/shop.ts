export interface ShopProfile {
  id: string;
  name: string;
  slug: string;
  status: "pending_verification" | "active" | "suspended";
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstNumber: string | null;
  licenseNumber: string | null;
  invoicePrefix: string | null;
  activatedAt: string | null;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateShopProfilePayload {
  name: string;
  phone?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  gstNumber?: string | null;
  licenseNumber?: string | null;
  invoicePrefix?: string | null;
}
