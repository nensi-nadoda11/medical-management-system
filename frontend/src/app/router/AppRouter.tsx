import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "../../components/layout/AppLayout";
import {
  RequireAdmin,
  RequireAuth,
  RequireGuest,
  RequireRoles,
} from "../../components/layout/RouteGuards";
import { LoadingState } from "../../components/ui/LoadingState";
import { useSessionQuery } from "../../features/auth/hooks/use-session";
import { AuthPage } from "../../features/auth/pages/AuthPage";
import { BillingDetailPage } from "../../features/billing/pages/BillingDetailPage";
import { BillingHistoryPage } from "../../features/billing/pages/BillingHistoryPage";
import { BillingPage } from "../../features/billing/pages/BillingPage";
import { HeldBillsPage } from "../../features/billing/pages/HeldBillsPage";
import { DashboardHomePage } from "../../features/dashboard/pages/DashboardHomePage";
import { SetPasswordPage } from "../../features/invitations/pages/SetPasswordPage";
import { ExpiryReportPage as InventoryExpiryReportPage } from "../../features/inventory/pages/ExpiryReportPage";
import { InventoryDetailPage } from "../../features/inventory/pages/InventoryDetailPage";
import { InventorySummaryPage } from "../../features/inventory/pages/InventorySummaryPage";
import { LowStockPage } from "../../features/inventory/pages/LowStockPage";
import { MedicinesPage } from "../../features/medicines/pages/MedicinesPage";
import { PurchaseCreatePage } from "../../features/purchases/pages/PurchaseCreatePage";
import { PurchaseDetailPage } from "../../features/purchases/pages/PurchaseDetailPage";
import { PurchaseEditPage } from "../../features/purchases/pages/PurchaseEditPage";
import { PurchasesPage } from "../../features/purchases/pages/PurchasesPage";
import { ExpiryReportPage } from "../../features/reports/pages/ExpiryReportPage";
import { LowStockReportPage } from "../../features/reports/pages/LowStockReportPage";
import { ProfitReportPage } from "../../features/reports/pages/ProfitReportPage";
import { ReportsDashboardPage } from "../../features/reports/pages/ReportsDashboardPage";
import { SalesReportPage } from "../../features/reports/pages/SalesReportPage";
import { StockReportPage } from "../../features/reports/pages/StockReportPage";
import { SupplierReportPage } from "../../features/reports/pages/SupplierReportPage";
import { ShopSetupPage } from "../../features/shop/pages/ShopSetupPage";
import { StaffManagementPage } from "../../features/staff/pages/StaffManagementPage";
import { SuppliersPage } from "../../features/suppliers/pages/SuppliersPage";

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
        <Route element={<RequireRoles roles={["admin", "staff"]} />}>
          <Route element={<BillingPage />} path="billing" />
        </Route>
        <Route element={<RequireRoles roles={["admin", "staff", "accountant"]} />}>
          <Route element={<HeldBillsPage />} path="billing/held" />
          <Route element={<BillingHistoryPage />} path="billing/history" />
          <Route element={<BillingDetailPage />} path="billing/:id" />
          <Route element={<Navigate replace to="/app/reports/dashboard" />} path="reports" />
          <Route element={<ReportsDashboardPage />} path="reports/dashboard" />
          <Route element={<SalesReportPage />} path="reports/sales" />
        </Route>
        <Route element={<RequireRoles roles={["admin", "accountant"]} />}>
          <Route element={<ProfitReportPage />} path="reports/profit" />
          <Route element={<StockReportPage />} path="reports/stock" />
          <Route element={<LowStockReportPage />} path="reports/low-stock" />
          <Route element={<ExpiryReportPage />} path="reports/expiry" />
          <Route element={<SupplierReportPage />} path="reports/suppliers" />
        </Route>
        <Route element={<RequireAdmin />}>
          <Route element={<ShopSetupPage />} path="shop-setup" />
          <Route element={<StaffManagementPage />} path="staff-management" />
          <Route element={<MedicinesPage />} path="medicines" />
          <Route element={<SuppliersPage />} path="suppliers" />
          <Route element={<PurchasesPage />} path="purchases" />
          <Route element={<PurchaseCreatePage />} path="purchases/new" />
          <Route element={<PurchaseDetailPage />} path="purchases/:id" />
          <Route element={<PurchaseEditPage />} path="purchases/:id/edit" />
          <Route element={<InventorySummaryPage />} path="inventory" />
          <Route element={<LowStockPage />} path="inventory/low-stock" />
          <Route element={<InventoryExpiryReportPage />} path="inventory/expiry" />
          <Route element={<InventoryDetailPage />} path="inventory/:medicineId" />
        </Route>
      </Route>
    </Route>

    <Route element={<Navigate replace to="/" />} path="*" />
  </Routes>
);
