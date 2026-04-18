import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useToast } from "../../hooks/use-toast";
import { AUTH_EXPIRED_EVENT } from "../../lib/api";
import { cn } from "../../lib/utils";
import { authService } from "../../services/auth";
import { authQueryKeys, useSessionQuery } from "../../features/auth/hooks/use-session";

type NavigationItem = {
  label: string;
  roles: Array<"admin" | "staff" | "accountant">;
  resolveTo: (role: "admin" | "staff" | "accountant") => string;
};

const navigation: NavigationItem[] = [
  {
    label: "Overview",
    roles: ["admin", "staff", "accountant"] as const,
    resolveTo: () => "/app",
  },
  {
    label: "Billing",
    roles: ["admin", "staff", "accountant"] as const,
    resolveTo: (role: "admin" | "staff" | "accountant") =>
      role === "accountant" ? "/app/billing/history" : "/app/billing",
  },
  {
    label: "Reports",
    roles: ["admin", "staff", "accountant"] as const,
    resolveTo: () => "/app/reports",
  },
  {
    label: "Shop Setup",
    roles: ["admin"] as const,
    resolveTo: () => "/app/shop-setup",
  },
  {
    label: "Staff Management",
    roles: ["admin"] as const,
    resolveTo: () => "/app/staff-management",
  },
  {
    label: "Medicines",
    roles: ["admin"] as const,
    resolveTo: () => "/app/medicines",
  },
  {
    label: "Suppliers",
    roles: ["admin"] as const,
    resolveTo: () => "/app/suppliers",
  },
  {
    label: "Purchases",
    roles: ["admin"] as const,
    resolveTo: () => "/app/purchases",
  },
  {
    label: "Inventory",
    roles: ["admin"] as const,
    resolveTo: () => "/app/inventory",
  },
];

export const AppLayout = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

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
    };

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  if (!sessionQuery.data) {
    return null;
  }

  const session = sessionQuery.data;
  const visibleNavigation = navigation
    .filter((item) => item.roles.includes(session.user.role))
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
            <div className="flex shrink-0 justify-end border-b border-slate-200/80 px-4 py-2.5 lg:px-4">
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

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-4 lg:py-4">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
