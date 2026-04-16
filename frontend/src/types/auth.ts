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
