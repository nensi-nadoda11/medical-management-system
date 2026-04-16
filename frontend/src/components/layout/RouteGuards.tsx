import { Navigate, Outlet, useLocation } from "react-router-dom";

import { LoadingState } from "../ui/LoadingState";
import { useSessionQuery } from "../../features/auth/hooks/use-session";

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
