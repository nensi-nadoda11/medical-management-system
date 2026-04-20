import { Navigate, Outlet, useLocation } from "react-router-dom";

import { LoadingState } from "../ui/LoadingState";
import { useSessionQuery } from "../../features/auth/hooks/use-session";
import { canAccessModule } from "../../types/auth";
import type { AdminPermissionKey } from "../../types/admin-settings";

export const RequireAuth = () => {
  const location = useLocation();
  const sessionQuery = useSessionQuery();

  if (sessionQuery.isLoading) {
    return <LoadingState title="Checking your session" />;
  }

  if (!sessionQuery.data) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  return <Outlet />;
};

export const RequireGuest = () => {
  const sessionQuery = useSessionQuery();

  if (sessionQuery.isLoading) {
    return <LoadingState title="Preparing secure access" />;
  }

  if (sessionQuery.data) {
    return <Navigate replace to="/app" />;
  }

  return <Outlet />;
};

export const RequireAdmin = () => {
  const sessionQuery = useSessionQuery();

  if (sessionQuery.isLoading) {
    return <LoadingState title="Loading admin workspace" />;
  }

  if (!sessionQuery.data) {
    return <Navigate replace to="/login" />;
  }

  if (sessionQuery.data.user.role !== "admin") {
    return <Navigate replace to="/app" />;
  }

  return <Outlet />;
};

export const RequireRoles = ({
  roles,
}: {
  roles: Array<"admin" | "staff" | "accountant">;
}) => {
  const sessionQuery = useSessionQuery();

  if (sessionQuery.isLoading) {
    return <LoadingState title="Loading workspace access" />;
  }

  if (!sessionQuery.data) {
    return <Navigate replace to="/login" />;
  }

  if (!roles.includes(sessionQuery.data.user.role)) {
    return <Navigate replace to="/app" />;
  }

  return <Outlet />;
};

export const RequirePermissions = ({
  permissions,
  mode = "any",
}: {
  permissions: AdminPermissionKey[];
  mode?: "any" | "all";
}) => {
  const sessionQuery = useSessionQuery();

  if (sessionQuery.isLoading) {
    return <LoadingState title="Loading workspace access" />;
  }

  if (!sessionQuery.data) {
    return <Navigate replace to="/login" />;
  }

  const session = sessionQuery.data;
  const allowed = canAccessModule(session.user, {
    permissions,
    permissionMode: mode,
  });

  if (!allowed) {
    return <Navigate replace to="/app" />;
  }

  return <Outlet />;
};
