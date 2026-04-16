import { apiRequest } from "../lib/api";
import type {
  AuthSession,
  LoginResponse,
  RegistrationResponse,
  ResendOtpResponse,
  VerificationResponse,
} from "../types/auth";

export interface RegisterAdminPayload {
  shopName: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

export interface VerifyRegistrationPayload {
  email: string;
  mobileNumber: string;
  otp: string;
}

export interface ResendRegistrationOtpPayload {
  email: string;
  mobileNumber: string;
  channels?: Array<"email" | "mobile">;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authService = {
  registerAdmin: (payload: RegisterAdminPayload) =>
    apiRequest<RegistrationResponse>({
      method: "POST",
      url: "/auth/register",
      data: payload,
    }),

  verifyRegistration: (payload: VerifyRegistrationPayload) =>
    apiRequest<VerificationResponse>({
      method: "POST",
      url: "/auth/verify-registration",
      data: payload,
    }),

  resendRegistrationOtp: (payload: ResendRegistrationOtpPayload) =>
    apiRequest<ResendOtpResponse>({
      method: "POST",
      url: "/auth/resend-registration-otp",
      data: payload,
    }),

  login: (payload: LoginPayload) =>
    apiRequest<LoginResponse>({
      method: "POST",
      url: "/auth/login",
      data: payload,
    }),

  getSession: () =>
    apiRequest<AuthSession>({
      method: "GET",
      url: "/auth/session",
    }),

  logout: () =>
    apiRequest<{ message: string }>({
      method: "POST",
      url: "/auth/logout",
    }),
};
