import axios from "axios";
import { getStoredBranchId } from "./branch-context";
import { resolveApiBaseUrl } from "./api-config";

const API_BASE_URL = resolveApiBaseUrl(
  import.meta.env as {
    VITE_API_BASE_URL?: string;
    VITE_BACKEND_URL?: string;
  },
);
export const AUTH_EXPIRED_EVENT = "mms:auth-expired";

export class ApiError extends Error {
  code?: string;
  details?: unknown;
  status: number;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const branchId = getStoredBranchId();

  if (branchId) {
    config.headers.set("x-branch-id", branchId);
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const message =
        error.response?.data?.error?.message ??
        error.response?.data?.message ??
        error.message ??
        "Something went wrong. Please try again.";
      const status = error.response?.status ?? 500;
      const code = error.response?.data?.error?.code;
      const details = error.response?.data?.error?.details;

      if (typeof window !== "undefined" && status === 401) {
        window.dispatchEvent(
          new CustomEvent(AUTH_EXPIRED_EVENT, {
            detail: { status, code },
          }),
        );
      }

      return Promise.reject(new ApiError(message, status, code, details));
    }

    return Promise.reject(
      new ApiError("Something went wrong. Please try again.", 500),
    );
  },
);

export const unwrapResponse = <T>(payload: ApiEnvelope<T> | T) => {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data as T;
  }

  return payload as T;
};

export const apiRequest = async <T>(config: Parameters<typeof apiClient.request>[0]) => {
  const response = await apiClient.request<ApiEnvelope<T> | T>(config);
  return unwrapResponse<T>(response.data);
};
