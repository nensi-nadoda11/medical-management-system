import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useToast } from "../../hooks/use-toast";
import { AUTH_EXPIRED_EVENT } from "../../lib/api";
import { cn } from "../../lib/utils";
import { authService } from "../../services/auth";
import { authQueryKeys, useSessionQuery } from "../../features/auth/hooks/use-session";
import { StatusBadge } from "../ui/StatusBadge";

const navigation = [
  { label: "Overview", to: "/app", adminOnly: false },
  { label: "Shop Setup", to: "/app/shop-setup", adminOnly: true },
  { label: "Staff Management", to: "/app/staff-management", adminOnly: true },
  { label: "Medicines", to: "/app/medicines", adminOnly: true },
  { label: "Suppliers", to: "/app/suppliers", adminOnly: true },
] as const;

export const AppLayout = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();

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

  if (!sessionQuery.data) {
    return null;
  }

  const session = sessionQuery.data;
  const visibleNavigation = navigation.filter(
    (item) => !item.adminOnly || session.user.role === "admin",
  );

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

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbfb_0%,#eef3f5_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-6 px-4 py-4 lg:flex-row lg:px-6">
        <aside className="w-full rounded-[32px] border border-slate-200/80 bg-[#0f2736] p-5 text-slate-50 shadow-xl shadow-slate-300/30 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-[292px] lg:overflow-hidden">
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-300">
                  Medical Management
                </p>
                <h1 className="mt-3 text-xl font-semibold">{session.shop.name}</h1>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Shop, staff, medicine, and supplier operations in one workspace.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge label={session.user.role} tone={session.user.role} />
                <StatusBadge label={session.shop.status} tone={session.shop.status} />
              </div>
            </div>

            <nav className="mt-8 grid flex-1 auto-rows-min gap-2 overflow-y-auto pr-1">
              {visibleNavigation.map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      "rounded-2xl border px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
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

            <div className="mt-5 shrink-0 rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold">{session.user.fullName}</p>
              <p className="mt-1 text-sm text-slate-300">{session.user.email}</p>
              <button
                className="mt-4 w-full rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={logoutMutation.isPending}
                onClick={() => logoutMutation.mutate()}
                type="button"
              >
                {logoutMutation.isPending ? "Signing out..." : "Log out"}
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="rounded-[32px] border border-white/70 bg-white/50 p-4 shadow-sm shadow-slate-200/60 backdrop-blur lg:min-h-[calc(100vh-2rem)] lg:p-6">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};
