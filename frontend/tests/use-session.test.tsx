import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../src/lib/api";

const mockGetSession = vi.fn();
const mockSyncStoredBranchId = vi.fn();

vi.mock("../src/services/auth", () => ({
  authService: {
    getSession: () => mockGetSession(),
  },
}));

vi.mock("../src/lib/branch-context", () => ({
  syncStoredBranchId: (...args: unknown[]) => mockSyncStoredBranchId(...args),
}));

import { useSessionQuery } from "../src/features/auth/hooks/use-session";

afterEach(() => {
  cleanup();
  mockGetSession.mockReset();
  mockSyncStoredBranchId.mockReset();
});

const createWrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useSessionQuery", () => {
  it("treats unauthorized session responses as a signed-out state", async () => {
    mockGetSession.mockRejectedValue(
      new ApiError("Authentication required.", 401, "UNAUTHORIZED"),
    );

    const { result } = renderHook(() => useSessionQuery(), {
      wrapper: createWrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
  });

  it("syncs the active branch before exposing the session", async () => {
    mockGetSession.mockResolvedValue({
      sessionId: "session-1",
      sessionExpiresAt: "2026-05-11T10:00:00.000Z",
      user: {
        id: "user-1",
        shopId: "shop-1",
        role: "admin",
        fullName: "Admin User",
        email: "admin@example.com",
        mobileNumber: "9999999999",
        isActive: true,
        emailVerified: true,
        mobileVerified: true,
        permissions: [],
      },
      shop: {
        id: "shop-1",
        name: "Medical Shop",
        slug: "medical-shop",
        status: "active",
      },
      branchContext: {
        currentBranch: {
          id: "branch-2",
          shopId: "shop-1",
          name: "Branch Two",
          code: "B2",
          address: null,
          contactNumber: null,
          status: "active",
          isDefault: false,
        },
        defaultBranch: {
          id: "branch-1",
          shopId: "shop-1",
          name: "Branch One",
          code: "B1",
          address: null,
          contactNumber: null,
          status: "active",
          isDefault: true,
        },
        accessibleBranches: [
          {
            id: "branch-1",
            shopId: "shop-1",
            name: "Branch One",
            code: "B1",
            address: null,
            contactNumber: null,
            status: "active",
            isDefault: true,
          },
          {
            id: "branch-2",
            shopId: "shop-1",
            name: "Branch Two",
            code: "B2",
            address: null,
            contactNumber: null,
            status: "active",
            isDefault: false,
          },
        ],
      },
    });

    const { result } = renderHook(() => useSessionQuery(), {
      wrapper: createWrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockSyncStoredBranchId).toHaveBeenCalledWith(
      ["branch-1", "branch-2"],
      "branch-2",
    );
  });
});
