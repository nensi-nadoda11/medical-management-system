import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { useToast } from "../../hooks/use-toast";
import { AUTH_EXPIRED_EVENT } from "../../lib/api";
import { setStoredBranchId, syncStoredBranchId } from "../../lib/branch-context";
import { cn } from "../../lib/utils";
import { authService } from "../../services/auth";
import { authQueryKeys, useSessionQuery } from "../../features/auth/hooks/use-session";
import {
  bulkMarkNotificationsRead,
  getNotificationSummary,
  notificationsQueryKeys,
} from "../../features/notifications/api/notifications";
import { canAccessModule } from "../../types/auth";
import type { AdminPermissionKey } from "../../types/admin-settings";

type NavigationItem = {
  label: string;
  roles?: Array<"admin" | "staff" | "accountant">;
  permissions?: AdminPermissionKey[];
  resolveTo: (role: "admin" | "staff" | "accountant") => string;
};

const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    roles: ["admin", "staff", "accountant"] as const,
    resolveTo: () => "/app",
  },
  {
    label: "Notifications",
    roles: ["admin", "staff", "accountant"] as const,
    resolveTo: () => "/app/notifications",
  },
  {
    label: "Billing",
    roles: ["admin", "staff", "accountant"] as const,
    permissions: ["billing.view"],
    resolveTo: (role: "admin" | "staff" | "accountant") =>
      role === "accountant" ? "/app/billing/history" : "/app/billing",
  },
  {
    label: "Sales Returns",
    roles: ["admin", "staff", "accountant"] as const,
    permissions: ["billing.return"],
    resolveTo: () => "/app/billing/returns",
  },
  {
    label: "Customers",
    roles: ["admin", "staff", "accountant"] as const,
    permissions: ["customers.view"],
    resolveTo: () => "/app/customers",
  },
  {
    label: "Accounting",
    roles: ["admin", "staff", "accountant"] as const,
    permissions: ["payments.view"],
    resolveTo: () => "/app/accounting/customers",
  },
  {
    label: "Reports",
    roles: ["admin", "staff", "accountant"] as const,
    permissions: ["reports.view"],
    resolveTo: () => "/app/reports",
  },
  {
    label: "Shop Setup",
    permissions: ["shop.view"],
    resolveTo: () => "/app/shop-setup",
  },
  {
    label: "Staff Management",
    permissions: ["users.view"],
    resolveTo: () => "/app/staff-management",
  },
  {
    label: "Medicines",
    permissions: ["medicines.view"],
    resolveTo: () => "/app/medicines",
  },
  {
    label: "Suppliers",
    permissions: ["suppliers.view"],
    resolveTo: () => "/app/suppliers",
  },
  {
    label: "Purchases",
    permissions: ["purchases.view"],
    resolveTo: () => "/app/purchases",
  },
  {
    label: "Purchase Returns",
    roles: ["admin", "staff", "accountant"] as const,
    permissions: ["purchaseReturns.view"],
    resolveTo: () => "/app/purchase-returns",
  },
  {
    label: "Inventory",
    permissions: ["inventory.view"],
    resolveTo: () => "/app/inventory",
  },
  {
    label: "Stock Transfers",
    roles: ["admin"] as const,
    resolveTo: () => "/app/inventory/transfers",
  },
  {
    label: "Branches",
    roles: ["admin"] as const,
    permissions: ["shop.manage"],
    resolveTo: () => "/app/branches",
  },
  {
    label: "Data Management",
    roles: ["admin"] as const,
    resolveTo: () => "/app/data-management",
  },
  {
    label: "Admin Settings",
    roles: ["admin"] as const,
    permissions: ["settings.view"],
    resolveTo: () => "/app/admin-settings",
  },
];

export const AppLayout = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);

  const notificationsSummaryQuery = useQuery({
    queryKey: notificationsQueryKeys.summary,
    queryFn: getNotificationSummary,
    enabled: Boolean(sessionQuery.data),
    refetchInterval: 60_000,
  });

  const logoutMutation = useMutation({
    mutationFn: authService.logout,
    onSuccess: () => {
      queryClient.setQueryData(authQueryKeys.session, null);
      pushToast({
        title: "Signed out",
        description: "Your session has been closed safely.",
        variant: "info",
      });
      navigate("/login");
    },
  });

  const bulkReadMutation = useMutation({
    mutationFn: () => bulkMarkNotificationsRead(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.all });
      pushToast({
        title: "Notifications updated",
        description: "All visible unread notifications were marked as read.",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      pushToast({
        title: "Unable to update notifications",
        description: error.message,
        variant: "error",
      });
    },
  });

  useEffect(() => {
    const handleAuthExpired = () => {
      queryClient.setQueryData(authQueryKeys.session, null);
      pushToast({
        title: "Session expired",
        description: "Please sign in again to continue using the admin module.",
        variant: "error",
      });
      navigate("/login");
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);

    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, [navigate, pushToast, queryClient]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }

      if (!notificationMenuRef.current?.contains(event.target as Node)) {
        setIsNotificationMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const session = sessionQuery.data;
  const branchContext = session?.branchContext;
  const accessibleBranches = branchContext?.accessibleBranches ?? [];

  useEffect(() => {
    if (!branchContext) {
      return;
    }

    syncStoredBranchId(
      branchContext.accessibleBranches.map((branch) => branch.id),
      branchContext.currentBranch.id,
    );
  }, [branchContext]);

  if (!session) {
    return null;
  }

  const visibleNavigation = navigation
    .filter((item) =>
      canAccessModule(session.user, {
        roles: item.roles,
        permissions: item.permissions,
        permissionMode: "all",
      }),
    )
    .map((item) => ({
      label: item.label,
      to: item.resolveTo(session.user.role),
    }));
  const profileInitials = session.user.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const unreadCount = notificationsSummaryQuery.data?.unreadCount ?? 0;

  return (
    <div className="h-screen overflow-hidden bg-[linear-gradient(180deg,#f7fbfb_0%,#eef3f5_100%)] text-slate-900">
      <div className="mx-auto flex h-screen max-w-[1400px] flex-col gap-3 px-3 py-3 lg:flex-row lg:px-4">
        <aside className="w-full rounded-[28px] border border-slate-200/80 bg-[#0f2736] p-4 text-slate-50 shadow-xl shadow-slate-300/30 lg:h-[calc(100vh-1.5rem)] lg:w-[252px] lg:overflow-hidden">
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0">
              <div className="rounded-[22px] border border-white/10 bg-white/5 px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                  Admin Workspace
                </p>
                <h1 className="mt-1 text-[1.3rem] font-semibold tracking-tight text-white">
                  {session.shop.name}
                </h1>
                <p className="mt-1 text-sm text-slate-300">
                  Signed in as {session.user.role}
                </p>
                {branchContext ? (
                  <p className="mt-2 text-sm text-slate-300">
                    Branch {branchContext.currentBranch.name}
                  </p>
                ) : null}
              </div>
            </div>

            <nav className="hide-scrollbar mt-4 grid flex-1 auto-rows-min gap-1.5 overflow-y-auto pr-1">
              {visibleNavigation.map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      "rounded-2xl border px-3.5 py-2.5 text-[0.95rem] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                      isActive
                        ? "border-transparent bg-white text-slate-950 shadow-md shadow-black/10"
                        : "border-transparent text-slate-200 hover:border-white/10 hover:bg-white/10 hover:text-white",
                    )
                  }
                  end={item.to === "/app"}
                  key={item.to}
                  to={item.to}
                >
                  {({ isActive }) => (
                    <span
                      className={cn(
                        "block transition-colors",
                        isActive ? "text-slate-950" : "text-slate-200",
                      )}
                    >
                      {item.label}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col rounded-[28px] border border-white/70 bg-white/55 shadow-sm shadow-slate-200/60 backdrop-blur">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 px-4 py-2.5 lg:px-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Operations
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Stay on top of active stock and finance attention points.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {accessibleBranches.length > 1 ? (
                  <label className="hidden min-w-[220px] grid gap-1.5 lg:grid">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Branch
                    </span>
                    <select
                      className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                      onChange={async (event) => {
                        const nextBranchId = event.target.value;
                        setStoredBranchId(nextBranchId);
                        await Promise.all([
                          queryClient.invalidateQueries(),
                          queryClient.invalidateQueries({
                            queryKey: authQueryKeys.session,
                          }),
                        ]);
                        pushToast({
                          title: "Branch switched",
                          description: "Workspace data has been refreshed for the selected branch.",
                          variant: "success",
                        });
                      }}
                      value={branchContext?.currentBranch.id ?? ""}
                    >
                      {accessibleBranches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name} ({branch.code})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div className="relative" ref={notificationMenuRef}>
                  <button
                    aria-expanded={isNotificationMenuOpen}
                    className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    onClick={() =>
                      setIsNotificationMenuOpen((current) => !current)
                    }
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                      <path d="M10 20a2 2 0 0 0 4 0" />
                    </svg>
                    {unreadCount ? (
                      <span className="absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    ) : null}
                  </button>

                  {isNotificationMenuOpen ? (
                    <div className="absolute right-0 top-14 z-10 w-[360px] rounded-[24px] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/70">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            Notifications
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {unreadCount} unread item(s) in your queue.
                          </p>
                        </div>
                        <Link
                          className="rounded-2xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                          onClick={() => setIsNotificationMenuOpen(false)}
                          to="/app/notifications"
                        >
                          View all
                        </Link>
                      </div>

                      <div className="mt-4">
                        {notificationsSummaryQuery.isLoading ? (
                          <p className="text-sm text-slate-500">Loading notifications...</p>
                        ) : notificationsSummaryQuery.error ? (
                          <p className="text-sm text-rose-600">
                            {notificationsSummaryQuery.error.message}
                          </p>
                        ) : notificationsSummaryQuery.data?.latest.length ? (
                          <div className="space-y-2.5">
                            {notificationsSummaryQuery.data.latest.map((item) => (
                              <Link
                                className={cn(
                                  "block rounded-[20px] border px-3.5 py-3 transition hover:border-slate-300 hover:bg-slate-50",
                                  item.isRead
                                    ? "border-slate-200 bg-white"
                                    : "border-teal-200 bg-teal-50/50",
                                )}
                                key={item.id}
                                onClick={() => setIsNotificationMenuOpen(false)}
                                to={item.actionPath ?? "/app/notifications"}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "h-2.5 w-2.5 rounded-full",
                                      item.severity === "critical"
                                        ? "bg-rose-500"
                                        : item.severity === "warning"
                                          ? "bg-amber-500"
                                          : "bg-slate-400",
                                    )}
                                  />
                                  <p className="text-sm font-semibold text-slate-900">
                                    {item.title}
                                  </p>
                                </div>
                                <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-slate-600">
                                  {item.message}
                                </p>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">
                            Your notification queue is clear.
                          </p>
                        )}
                      </div>

                      <button
                        className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!unreadCount || bulkReadMutation.isPending}
                        onClick={() => bulkReadMutation.mutate()}
                        type="button"
                      >
                        {bulkReadMutation.isPending ? "Updating..." : "Mark all read"}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="relative" ref={profileMenuRef}>
                  <button
                    aria-expanded={isProfileMenuOpen}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    onClick={() => setIsProfileMenuOpen((current) => !current)}
                    type="button"
                  >
                    {profileInitials || "U"}
                  </button>

                  {isProfileMenuOpen ? (
                    <div className="absolute right-0 top-14 z-10 w-72 rounded-[24px] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/70">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-950">
                          {session.user.fullName}
                        </p>
                        <p className="text-sm text-slate-600">{session.user.email}</p>
                      </div>
                      <button
                        className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={logoutMutation.isPending}
                        onClick={() => logoutMutation.mutate()}
                        type="button"
                      >
                        {logoutMutation.isPending ? "Signing out..." : "Log out"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-4 lg:py-4">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
