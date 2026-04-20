import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mockUseSessionQuery = vi.fn();
const mockGetNotificationSummary = vi.fn();
const mockBulkMarkNotificationsRead = vi.fn();

vi.mock("../src/features/auth/hooks/use-session", () => ({
  authQueryKeys: {
    session: ["auth", "session"] as const,
  },
  useSessionQuery: () => mockUseSessionQuery(),
}));

vi.mock("../src/hooks/use-toast", () => ({
  useToast: () => ({
    pushToast: vi.fn(),
  }),
}));

vi.mock("../src/features/notifications/api/notifications", () => ({
  notificationsQueryKeys: {
    all: ["notifications"] as const,
    summary: ["notifications", "summary"] as const,
  },
  getNotificationSummary: () => mockGetNotificationSummary(),
  bulkMarkNotificationsRead: () => mockBulkMarkNotificationsRead(),
}));

import { AppLayout } from "../src/components/layout/AppLayout";

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

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/app"]}>
        <Routes>
          <Route element={<AppLayout />} path="/app">
            <Route element={<>{children}</>} index />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("AppLayout navigation", () => {
  beforeEach(() => {
    mockUseSessionQuery.mockReset();
    mockBulkMarkNotificationsRead.mockResolvedValue({ updatedCount: 0 });
    mockGetNotificationSummary.mockResolvedValue({
      unreadCount: 0,
      latest: [],
    });
  });

  it("shows permission-backed modules for non-admin users when the session grants access", async () => {
    mockUseSessionQuery.mockReturnValue({
      data: {
        shop: {
          name: "Wellness Pharmacy",
        },
        user: {
          role: "staff",
          fullName: "Alex Staff",
          email: "alex@example.com",
          permissions: ["medicines.view", "inventory.view"],
        },
      },
    });

    render(<div>Dashboard</div>, { wrapper: createWrapper });

    expect(await screen.findByRole("link", { name: "Medicines" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Inventory" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Suppliers" })).toBeNull();
  });
});
