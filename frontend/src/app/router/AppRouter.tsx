import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "../../components/layout/AppLayout";
import {
  RequireAdmin,
  RequireAuth,
  RequireGuest,
} from "../../components/layout/RouteGuards";
import { LoadingState } from "../../components/ui/LoadingState";
import { useSessionQuery } from "../../features/auth/hooks/use-session";
import { AuthPage } from "../../features/auth/pages/AuthPage";
import { DashboardHomePage } from "../../features/dashboard/pages/DashboardHomePage";
import { SetPasswordPage } from "../../features/invitations/pages/SetPasswordPage";
import { ShopSetupPage } from "../../features/shop/pages/ShopSetupPage";
import { StaffManagementPage } from "../../features/staff/pages/StaffManagementPage";

const RootRedirect = () => {
  const sessionQuery = useSessionQuery();

  if (sessionQuery.isLoading) {
    return <LoadingState title="Opening workspace" />;
  }

  return <Navigate replace to={sessionQuery.data ? "/app" : "/login"} />;
};

export const AppRouter = () => (
  <Routes>
    <Route element={<RootRedirect />} path="/" />

    <Route element={<RequireGuest />}>
      <Route element={<AuthPage initialView="login" />} path="/login" />
      <Route element={<AuthPage initialView="register" />} path="/register" />
      <Route element={<AuthPage initialView="verify" />} path="/verify" />
    </Route>

    <Route element={<SetPasswordPage />} path="/set-password" />

    <Route element={<RequireAuth />}>
      <Route element={<AppLayout />} path="/app">
        <Route element={<DashboardHomePage />} index />
        <Route element={<RequireAdmin />}>
          <Route element={<ShopSetupPage />} path="shop-setup" />
          <Route element={<StaffManagementPage />} path="staff-management" />
        </Route>
      </Route>
    </Route>

    <Route element={<Navigate replace to="/" />} path="*" />
  </Routes>
);
