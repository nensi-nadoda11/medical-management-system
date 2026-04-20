import type { AdminPermissionKey } from "./admin-settings";

export interface BranchSummary {
  id: string;
  shopId: string;
  name: string;
  code: string;
  address: string | null;
  contactNumber: string | null;
  status: "active" | "inactive";
  isDefault: boolean;
}

export interface BranchContext {
  currentBranch: BranchSummary;
  defaultBranch: BranchSummary;
  accessibleBranches: BranchSummary[];
}

export interface PublicUser {
  id: string;
  shopId: string;
  role: "admin" | "staff" | "accountant";
  fullName: string;
  email: string;
  mobileNumber: string;
  isActive: boolean;
  emailVerified: boolean;
  mobileVerified: boolean;
  permissions: AdminPermissionKey[];
}

export interface PublicShop {
  id: string;
  name: string;
  slug: string;
  status: "pending_verification" | "active" | "suspended";
}

export interface AuthSession {
  sessionId: string;
  sessionExpiresAt: string;
  user: PublicUser;
  shop: PublicShop;
  branchContext?: BranchContext;
}

export interface RegistrationResponse {
  message: string;
  pendingUserId: string;
  user: PublicUser;
  shop: PublicShop;
  verification: {
    emailVerified: boolean;
    mobileVerified: boolean;
    expiresAt: string;
    otpDelivery: {
      email: "sent" | "failed" | "not_requested";
      mobile: "sent" | "failed" | "not_requested";
    };
  };
}

export interface VerificationResponse {
  message: string;
  isCompleted: boolean;
  redirectTo: string | null;
  user: PublicUser;
  shop: PublicShop;
}

export interface ResendOtpResponse {
  message: string;
  verification: {
    emailVerified: boolean;
    mobileVerified: boolean;
    expiresAt: string;
    otpDelivery: {
      email: "sent" | "failed" | "not_requested";
      mobile: "sent" | "failed" | "not_requested";
    };
  };
}

export interface LoginResponse {
  message: string;
  sessionExpiresAt: string;
  user: PublicUser;
  shop: PublicShop;
  branchContext?: BranchContext;
}

export interface PendingRegistration {
  shopName: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  pendingUserId: string;
  expiresAt: string;
  emailVerified: boolean;
  mobileVerified: boolean;
}

type PermissionAwareUser = Pick<PublicUser, "role" | "permissions"> | null | undefined;

export const hasPermission = (
  user: PermissionAwareUser,
  permission: AdminPermissionKey,
) => Boolean(user?.permissions?.includes(permission));

export const hasAnyPermission = (
  user: PermissionAwareUser,
  permissions: AdminPermissionKey[],
) => permissions.some((permission) => hasPermission(user, permission));

export const hasAllPermissions = (
  user: PermissionAwareUser,
  permissions: AdminPermissionKey[],
) => permissions.every((permission) => hasPermission(user, permission));

export const canAccessModule = (
  user: PermissionAwareUser,
  input: {
    roles?: PublicUser["role"][];
    permissions?: AdminPermissionKey[];
    permissionMode?: "any" | "all";
  },
) => {
  if (!user) {
    return false;
  }

  if (input.roles?.length && !input.roles.includes(user.role)) {
    return false;
  }

  if (!input.permissions?.length) {
    return true;
  }

  return input.permissionMode === "all"
    ? hasAllPermissions(user, input.permissions)
    : hasAnyPermission(user, input.permissions);
};
