import type { BranchRequestContext } from "../branches/branches.service";

export const USER_ROLES = ["admin", "staff", "accountant"] as const;
export const OTP_CHANNELS = ["email", "mobile"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type OtpChannel = (typeof OTP_CHANNELS)[number];

export interface PublicShop {
  id: string;
  name: string;
  slug: string;
  status: "pending_verification" | "active" | "suspended";
}

export interface PublicUser {
  id: string;
  shopId: string;
  role: UserRole;
  fullName: string;
  email: string;
  mobileNumber: string;
  isActive: boolean;
  emailVerified: boolean;
  mobileVerified: boolean;
  permissions: string[];
}

export interface AuthenticatedRequestContext {
  sessionId: string;
  user: PublicUser;
  shop: PublicShop;
  sessionExpiresAt: string;
  branchContext?: BranchRequestContext;
}
