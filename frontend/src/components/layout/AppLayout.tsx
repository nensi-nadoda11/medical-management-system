import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  Database,
  GitBranch,
  HandCoins,
  Home,
  Menu,
  PackageSearch,
  Pill,
  Receipt,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useToast } from "../../hooks/use-toast";
import { AUTH_EXPIRED_EVENT } from "../../lib/api";
import {
  setStoredBranchId,
  syncStoredBranchId,
} from "../../lib/branch-context";
import { cn } from "../../lib/utils";
import { authService } from "../../services/auth";
import {
  authQueryKeys,
  useSessionQuery,
} from "../../features/auth/hooks/use-session";
import { WorkspaceErrorBoundary } from "../ui/WorkspaceErrorBoundary";
import {
  bulkMarkNotificationsRead,
  getNotificationSummary,
  notificationsQueryKeys,
} from "../../features/notifications/api/notifications";
import { canAccessModule } from "../../types/auth";
import type { AdminPermissionKey } from "../../types/admin-settings";

type NavigationGroup =
  | "Overview"
  | "Sales & Finance"
  | "Inventory & Supply"
  | "Administration";

type NavigationItem = {
  label: string;
  group: NavigationGroup;
  description: string;
  icon: LucideIcon;
  roles?: Array<"admin" | "staff" | "accountant">;
  permissions?: AdminPermissionKey[];
  resolveTo: (role: "admin" | "staff" | "accountant") => string;
};

const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    group: "Overview",
    description: "Review the most important activity, stock, and finance signals.",
    icon: Home,
    roles: ["admin", "staff", "accountant"] as const,
    resolveTo: () => "/app",
  },
  {
    label: "Notifications",
    group: "Overview",
    description: "Handle unread alerts, reminders, and operational exceptions quickly.",
    icon: Bell,
    roles: ["admin", "staff", "accountant"] as const,
    resolveTo: () => "/app/notifications",
  },
  {
    label: "Billing",
    group: "Sales & Finance",
    description: "Create bills fast and keep the counter flow focused.",
    icon: Receipt,
    roles: ["admin", "staff", "accountant"] as const,
    permissions: ["billing.view"],
    resolveTo: (role) =>
      role === "accountant" ? "/app/billing/history" : "/app/billing",
  },
  {
    label: "Sales Returns",
    group: "Sales & Finance",
    description: "Process returns without hunting through extra screens.",
    icon: RotateCcw,
    roles: ["admin", "staff", "accountant"] as const,
    permissions: ["billing.return"],
    resolveTo: () => "/app/billing/returns",
  },
  {
    label: "Customers",
    group: "Sales & Finance",
    description: "Track customers, history, balances, and follow-up in one place.",
    icon: Users,
    roles: ["admin", "staff", "accountant"] as const,
    permissions: ["customers.view"],
    resolveTo: () => "/app/customers",
  },
  {
    label: "Accounting",
    group: "Sales & Finance",
    description: "Review dues, ledgers, and payments with fewer clicks.",
    icon: HandCoins,
    roles: ["admin", "staff", "accountant"] as const,
    permissions: ["payments.view"],
    resolveTo: () => "/app/accounting/customers",
  },
  {
    label: "Reports",
    group: "Sales & Finance",
    description: "Open high-value reports from a single analytics workspace.",
    icon: BarChart3,
    roles: ["admin", "staff", "accountant"] as const,
    permissions: ["reports.view"],
    resolveTo: () => "/app/reports",
  },
  {
    label: "Medicines",
    group: "Inventory & Supply",
    description: "Maintain a clean medicine catalog for billing and stock workflows.",
    icon: Pill,
    permissions: ["medicines.view"],
    resolveTo: () => "/app/medicines",
  },
  {
    label: "Suppliers",
    group: "Inventory & Supply",
    description: "Keep supplier information, balances, and contacts organized.",
    icon: Truck,
    permissions: ["suppliers.view"],
    resolveTo: () => "/app/suppliers",
  },
  {
    label: "Purchases",
    group: "Inventory & Supply",
    description: "Manage incoming stock documents and supplier invoices.",
    icon: ShoppingCart,
    permissions: ["purchases.view"],
    resolveTo: () => "/app/purchases",
  },
  {
    label: "Purchase Returns",
    group: "Inventory & Supply",
    description: "Reverse purchase stock with a controlled return flow.",
    icon: RotateCcw,
    roles: ["admin", "staff", "accountant"] as const,
    permissions: ["purchaseReturns.view"],
    resolveTo: () => "/app/purchase-returns",
  },
  {
    label: "Inventory",
    group: "Inventory & Supply",
    description: "Monitor stock movement, low stock, and expiry pressure quickly.",
    icon: PackageSearch,
    permissions: ["inventory.view"],
    resolveTo: () => "/app/inventory",
  },
  {
    label: "Stock Transfers",
    group: "Inventory & Supply",
    description: "Move stock between branches without leaving the inventory flow.",
    icon: ClipboardList,
    roles: ["admin"] as const,
    resolveTo: () => "/app/inventory/transfers",
  },
  {
    label: "Shop Setup",
    group: "Administration",
    description: "Control shop details and core defaults from one setup page.",
    icon: Store,
    permissions: ["shop.view"],
    resolveTo: () => "/app/shop-setup",
  },
  {
    label: "Staff Management",
    group: "Administration",
    description: "Manage users, roles, and invitations with less clutter.",
    icon: UsersRound,
    permissions: ["users.view"],
    resolveTo: () => "/app/staff-management",
  },
  {
    label: "Branches",
    group: "Administration",
    description: "Handle branch-level settings and branch visibility.",
    icon: GitBranch,
    roles: ["admin"] as const,
    permissions: ["shop.manage"],
    resolveTo: () => "/app/branches",
  },
  {
    label: "Data Management",
    group: "Administration",
    description: "Import, export, and cleanup tools stay isolated from daily work.",
    icon: Database,
    roles: ["admin"] as const,
    resolveTo: () => "/app/data-management",
  },
  {
    label: "Admin Settings",
    group: "Administration",
    description: "Control permissions and advanced operational settings.",
    icon: ShieldCheck,
    roles: ["admin"] as const,
    permissions: ["settings.view"],
    resolveTo: () => "/app/admin-settings",
  },
];

const groupOrder: NavigationGroup[] = [
  "Overview",
  "Sales & Finance",
  "Inventory & Supply",
  "Administration",
];

type VisibleNavigationItem = NavigationItem & {
  to: string;
};

export const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);

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
      await queryClient.invalidateQueries({
        queryKey: notificationsQueryKeys.all,
      });
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

  useEffect(() => {
    Promise.resolve().then(() => {
      setIsMobileNavigationOpen(false);
      setIsNotificationMenuOpen(false);
      setIsProfileMenuOpen(false);
    });
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileNavigationOpen) {
      return;
    }

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isMobileNavigationOpen]);

  const session = sessionQuery.data;
  const branchContext = session?.branchContext;
  const accessibleBranches = branchContext?.accessibleBranches ?? [];

  useEffect(() => {
    if (
      !branchContext?.currentBranch?.id ||
      !Array.isArray(branchContext.accessibleBranches)
    ) {
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

  const visibleNavigation: VisibleNavigationItem[] = navigation
    .filter((item) =>
      canAccessModule(session.user, {
        roles: item.roles,
        permissions: item.permissions,
        permissionMode: "all",
      }),
    )
    .map((item) => ({
      ...item,
      to: item.resolveTo(session.user.role),
    }));

  const visibleGroups = groupOrder
    .map((group) => ({
      group,
      items: visibleNavigation.filter((item) => item.group === group),
    }))
    .filter((group) => group.items.length > 0);

  const currentNavigation =
    [...visibleNavigation]
      .sort((left, right) => right.to.length - left.to.length)
      .find(
        (item) =>
          location.pathname === item.to ||
          location.pathname.startsWith(`${item.to}/`),
      ) ?? null;

  const workspaceDate = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const profileInitials = session.user.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const unreadCount = notificationsSummaryQuery.data?.unreadCount ?? 0;
  const shopNameParts = session.shop.name.split(" ").filter(Boolean);
  const primaryShopName =
    shopNameParts.length > 1 ? shopNameParts.slice(0, -1).join(" ") : session.shop.name;
  const secondaryShopName =
    shopNameParts.length > 1 ? shopNameParts.at(-1) : "medical";
  const currentGroupLabel = currentNavigation?.group ?? "Workspace";

  return (
    <div className="app-shell min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(91,33,182,0.14),transparent_26%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_24%),linear-gradient(180deg,#f6f7ff_0%,#eef2fb_50%,#f8fafc_100%)] text-slate-900">
      <div className="app-frame mx-auto flex min-h-screen max-w-[1720px] gap-4 px-3 py-3 lg:px-5 lg:py-5">
        <div
          aria-hidden="true"
          className={cn(
            "fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm transition lg:hidden",
            isMobileNavigationOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0",
          )}
          onClick={() => setIsMobileNavigationOpen(false)}
        />

        <aside
          id="mobile-navigation"
          className={cn(
            "app-sidebar print-hidden fixed inset-y-3 left-3 z-40 flex w-[min(18rem,calc(100vw-1.5rem))] flex-col rounded-[30px] border border-white/[0.08] bg-[linear-gradient(180deg,#0b1020_0%,#11182d_48%,#0d1425_100%)] p-4 text-slate-100 shadow-[0_40px_90px_-42px_rgba(15,23,42,0.82)] transition duration-200 lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:w-[276px] lg:translate-x-0",
            isMobileNavigationOpen
              ? "translate-x-0 opacity-100"
              : "-translate-x-[108%] opacity-0 lg:opacity-100",
          )}
        >
          <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#8b5cf6_0%,#6d3df5_100%)] shadow-[0_18px_30px_-18px_rgba(139,92,246,0.9)]">
                  <svg
                    aria-hidden="true"
                    className="h-7 w-7 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <div>
                  <p className="text-[1.2rem] font-semibold leading-tight tracking-tight text-white">
                    {primaryShopName}
                  </p>
                  <p className="text-[1.2rem] font-semibold leading-tight tracking-tight text-violet-400">
                    {secondaryShopName}
                  </p>
                </div>
              </div>
              <button
                aria-label="Close navigation"
                className="ui-icon-button lg:hidden"
                onClick={() => setIsMobileNavigationOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-5 flex min-h-0 flex-1 flex-col">
            <nav className="hide-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="space-y-5">
                {visibleGroups.map(({ group, items }) => (
                  <div className="space-y-2" key={group}>
                    <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-400">
                      {group}
                    </p>
                    <div className="space-y-1.5">
                      {items.map((item) => {
                        const Icon = item.icon;
                        const isNotificationsItem = item.label === "Notifications";

                        return (
                        <NavLink
                          className={({ isActive }) =>
                            cn(
                              "group flex min-h-[3rem] items-center justify-between gap-3 rounded-[18px] border px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none",
                              isActive
                                ? "border-violet-500/40 bg-[linear-gradient(135deg,rgba(109,61,245,0.42),rgba(91,33,182,0.28))] text-white shadow-[0_18px_30px_-24px_rgba(109,61,245,0.78)]"
                                : "border-transparent bg-white/[0.03] text-slate-100 hover:border-white/10 hover:bg-white/[0.06] hover:text-white",
                            )
                          }
                          end={item.to === "/app"}
                          key={item.to}
                          to={item.to}
                        >
                          {({ isActive }) => (
                            <>
                              <div className="flex min-w-0 items-center gap-3">
                                <span
                                  className={cn(
                                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border transition",
                                    isActive
                                      ? "border-white/10 bg-white/10 text-white"
                                      : "border-white/[0.08] bg-white/[0.04] text-slate-300 group-hover:text-white",
                                  )}
                                >
                                  <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                                </span>
                                <span className="min-w-0 truncate">{item.label}</span>
                              </div>
                              {isNotificationsItem && unreadCount > 0 ? (
                                <span className="inline-flex min-w-[1.55rem] items-center justify-center rounded-full bg-violet-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  {unreadCount > 99 ? "99+" : unreadCount}
                                </span>
                              ) : (
                                <span
                                  className={cn(
                                    "h-2.5 w-2.5 shrink-0 rounded-full transition",
                                    isActive ? "bg-emerald-400" : "bg-white/30",
                                  )}
                                />
                              )}
                            </>
                          )}
                        </NavLink>
                      )})}
                    </div>
                  </div>
                ))}
              </div>
            </nav>
          </div>

          <div className="mt-4 rounded-[24px] border border-white/[0.08] bg-white/[0.04] px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                {profileInitials || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {session.user.fullName}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {session.user.role === "admin" ? "Administrator" : session.user.role}
                </p>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex min-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,250,255,0.96))] shadow-[0_34px_86px_-52px_rgba(15,23,42,0.3)] backdrop-blur-xl">
            <header className="app-header print-hidden shrink-0 border-b border-slate-200/75 px-4 py-4 lg:px-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex w-full items-center justify-between gap-3 xl:w-auto xl:justify-start">
                  <button
                    aria-controls="mobile-navigation"
                    aria-expanded={isMobileNavigationOpen}
                    aria-label="Open navigation"
                    className="ui-icon-button lg:hidden"
                    onClick={() => setIsMobileNavigationOpen(true)}
                    type="button"
                  >
                    <Menu aria-hidden="true" className="h-[18px] w-[18px]" />
                  </button>

                  <div className="flex flex-wrap items-center gap-2 md:hidden">
                    <span className="rounded-full border border-slate-200/80 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                      Workspace
                    </span>
                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                      {currentGroupLabel}
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3 xl:max-w-[min(66rem,100%)] xl:flex-row xl:items-center xl:justify-end">
                  <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
                    <span className="rounded-full border border-slate-200/80 bg-white px-3.5 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm shadow-slate-200/40">
                      Workspace
                    </span>
                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-1.5 text-[11px] font-semibold text-emerald-700 shadow-sm shadow-emerald-100/60">
                      {currentGroupLabel}
                    </span>
                  </div>

                  {accessibleBranches.length > 1 ? (
                    <label className="grid min-w-0 gap-1.5 sm:min-w-[220px]">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Active branch
                      </span>
                      <select
                        className="ui-input min-w-0 !rounded-[18px] !py-2.5 !font-semibold"
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
                            description:
                              "Workspace data has been refreshed for the selected branch.",
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

                  <div className="flex flex-wrap items-center gap-2.5 xl:justify-end">
                    <div className="hidden items-center gap-2 rounded-[18px] border border-slate-200/80 bg-white/88 px-3.5 py-2.5 shadow-sm shadow-slate-200/35 md:flex">
                      <CalendarDays aria-hidden="true" className="h-[18px] w-[18px] text-slate-500" />
                      <p className="text-sm font-semibold text-slate-800">
                        {workspaceDate}
                      </p>
                    </div>

                    <div className="relative" ref={notificationMenuRef}>
                    <button
                      aria-expanded={isNotificationMenuOpen}
                      className="ui-icon-button relative"
                      onClick={() =>
                        setIsNotificationMenuOpen((current) => !current)
                      }
                      type="button"
                    >
                      <Bell aria-hidden="true" className="h-[18px] w-[18px]" />
                      {unreadCount ? (
                        <span className="absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      ) : null}
                    </button>

                    {isNotificationMenuOpen ? (
                      <div className="absolute right-0 top-14 z-20 w-[min(30rem,calc(100vw-1.5rem))] rounded-[26px] border border-slate-200/80 bg-white/96 p-4 shadow-[0_28px_80px_-38px_rgba(15,23,42,0.26)] backdrop-blur-xl">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              Notifications
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {unreadCount} unread item(s) in your queue.
                            </p>
                          </div>
                          <Link
                            className="ui-btn ui-btn--secondary !min-h-[2.2rem] !px-3 !py-2 !text-xs"
                            onClick={() => setIsNotificationMenuOpen(false)}
                            to="/app/notifications"
                          >
                            View all
                          </Link>
                        </div>

                        <div className="mt-2 max-h-[16rem] overflow-x-hidden overflow-y-auto">
                          {notificationsSummaryQuery.isLoading ? (
                            <p className="text-sm text-slate-500">
                              Loading notifications...
                            </p>
                          ) : notificationsSummaryQuery.error ? (
                            <p className="text-sm text-rose-600">
                              {notificationsSummaryQuery.error.message}
                            </p>
                          ) : notificationsSummaryQuery.data?.latest?.length ? (
                            <div className="ui-feed-list">
                              {notificationsSummaryQuery.data.latest.map(
                                (item) => (
                                  <Link
                                    className={cn(
                                      "block rounded-[20px] border px-3.5 py-3 transition",
                                      item.isRead
                                        ? "border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white"
                                        : "border-violet-100 bg-violet-50/80 hover:border-violet-200",
                                    )}
                                    key={item.id}
                                    onClick={() =>
                                      setIsNotificationMenuOpen(false)
                                    }
                                    to={item.actionPath ?? "/app/notifications"}
                                  >
                                    <div className="flex min-w-0 items-start gap-2">
                                      <span
                                        className={cn(
                                          "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                                          item.severity === "critical"
                                            ? "bg-rose-500"
                                            : item.severity === "warning"
                                              ? "bg-amber-500"
                                              : "bg-slate-400",
                                        )}
                                      />
                                      <p className="min-w-0 flex-1 break-words text-sm font-semibold leading-5 text-slate-900">
                                        {item.title}
                                      </p>
                                    </div>
                                    <p className="mt-2 break-words text-sm leading-5 text-slate-600">
                                      {item.message}
                                    </p>
                                  </Link>
                                ),
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500">
                              Your notification queue is clear.
                            </p>
                          )}
                        </div>

                        <button
                          className="ui-btn ui-btn--primary mt-4 w-full"
                          disabled={!unreadCount || bulkReadMutation.isPending}
                          onClick={() => bulkReadMutation.mutate()}
                          type="button"
                        >
                          {bulkReadMutation.isPending
                            ? "Updating..."
                            : "Mark all read"}
                        </button>
                      </div>
                    ) : null}
                    </div>

                    <div className="relative" ref={profileMenuRef}>
                    <button
                      aria-expanded={isProfileMenuOpen}
                      className="flex h-11 min-w-[2.75rem] items-center justify-center rounded-full border border-slate-200/80 bg-[linear-gradient(180deg,#f1eaff_0%,#ffffff_100%)] px-3 text-sm font-bold text-violet-700 shadow-sm shadow-slate-200/40 transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white"
                      onClick={() => setIsProfileMenuOpen((current) => !current)}
                      type="button"
                    >
                      {profileInitials || "U"}
                    </button>

                    {isProfileMenuOpen ? (
                      <div className="absolute right-0 top-14 z-20 w-72 rounded-[26px] border border-slate-200/80 bg-white/96 p-4 shadow-[0_28px_80px_-38px_rgba(15,23,42,0.26)] backdrop-blur-xl">
                        <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                          <p className="text-sm font-semibold text-slate-950">
                            {session.user.fullName}
                          </p>
                          <p className="mt-1 break-words text-sm text-slate-600">
                            {session.user.email}
                          </p>
                        </div>
                        <button
                          className="ui-btn ui-btn--primary mt-4 w-full"
                          disabled={logoutMutation.isPending}
                          onClick={() => logoutMutation.mutate()}
                          type="button"
                        >
                          {logoutMutation.isPending
                            ? "Signing out..."
                            : "Log out"}
                        </button>
                      </div>
                    ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div className="app-content min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-5 lg:py-5">
              <WorkspaceErrorBoundary
                resetKey={`${location.pathname}${location.search}${location.hash}`}
              >
                <Outlet />
              </WorkspaceErrorBoundary>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
