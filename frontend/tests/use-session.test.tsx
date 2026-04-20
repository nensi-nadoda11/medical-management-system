import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../src/lib/api";

const mockGetSession = vi.fn();

vi.mock("../src/services/auth", () => ({
  authService: {
    getSession: () => mockGetSession(),
  },
}));

import { useSessionQuery } from "../src/features/auth/hooks/use-session";

afterEach(() => {
  cleanup();
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
});
