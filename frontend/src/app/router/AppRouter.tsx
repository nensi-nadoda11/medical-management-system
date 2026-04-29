import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "../../components/layout/AppLayout";
import {
  RequireAdmin,
  RequireAuth,
  RequireGuest,
  RequirePermissions,
} from "../../components/layout/RouteGuards";
import { LoadingState } from "../../components/ui/LoadingState";
import { AdminSettingsPage } from "../../features/admin-settings/pages/AdminSettingsPage";
import { useSessionQuery } from "../../features/auth/hooks/use-session";
import { CustomerAccountingPage } from "../../features/accounting/pages/CustomerAccountingPage";
import { CustomerLedgerPage } from "../../features/accounting/pages/CustomerLedgerPage";
import { SupplierAccountingPage } from "../../features/accounting/pages/SupplierAccountingPage";
import { SupplierLedgerPage } from "../../features/accounting/pages/SupplierLedgerPage";
import { AuthPage } from "../../features/auth/pages/AuthPage";
import { BillingDetailPage } from "../../features/billing/pages/BillingDetailPage";
import { BillingHistoryPage } from "../../features/billing/pages/BillingHistoryPage";
import { BillingPage } from "../../features/billing/pages/BillingPage";
import { BranchesPage } from "../../features/branches/pages/BranchesPage";
import { DocumentPreviewPage } from "../../features/documents/pages/DocumentPreviewPage";
import { HeldBillsPage } from "../../features/billing/pages/HeldBillsPage";
import { SalesReturnDetailPage } from "../../features/sales-returns/pages/SalesReturnDetailPage";
import { SalesReturnEditorPage } from "../../features/sales-returns/pages/SalesReturnEditorPage";
import { SalesReturnsPage } from "../../features/sales-returns/pages/SalesReturnsPage";
import { DashboardHomePage } from "../../features/dashboard/pages/DashboardHomePage";
import { DataManagementPage } from "../../features/data-management/pages/DataManagementPage";
import { SetPasswordPage } from "../../features/invitations/pages/SetPasswordPage";
import { ExpiryReportPage as InventoryExpiryReportPage } from "../../features/inventory/pages/ExpiryReportPage";
import { InventoryDetailPage } from "../../features/inventory/pages/InventoryDetailPage";
import { InventorySummaryPage } from "../../features/inventory/pages/InventorySummaryPage";
import { LowStockPage } from "../../features/inventory/pages/LowStockPage";
import { MedicinesPage } from "../../features/medicines/pages/MedicinesPage";
import { CustomerDetailPage } from "../../features/customers/pages/CustomerDetailPage";
import { CustomersPage } from "../../features/customers/pages/CustomersPage";
import { PurchaseCreatePage } from "../../features/purchases/pages/PurchaseCreatePage";
import { PurchaseDetailPage } from "../../features/purchases/pages/PurchaseDetailPage";
import { PurchaseEditPage } from "../../features/purchases/pages/PurchaseEditPage";
import { PurchasesPage } from "../../features/purchases/pages/PurchasesPage";
import { PurchaseReturnDetailPage } from "../../features/purchase-returns/pages/PurchaseReturnDetailPage";
import { PurchaseReturnEditorPage } from "../../features/purchase-returns/pages/PurchaseReturnEditorPage";
import { PurchaseReturnsPage } from "../../features/purchase-returns/pages/PurchaseReturnsPage";
import { NotificationCenterPage } from "../../features/notifications/pages/NotificationCenterPage";
import { ExpiryReportPage } from "../../features/reports/pages/ExpiryReportPage";
import { LowStockReportPage } from "../../features/reports/pages/LowStockReportPage";
import { ProfitReportPage } from "../../features/reports/pages/ProfitReportPage";
import { ReportsDashboardPage } from "../../features/reports/pages/ReportsDashboardPage";
import { SalesReportPage } from "../../features/reports/pages/SalesReportPage";
import { StockReportPage } from "../../features/reports/pages/StockReportPage";
import { SupplierReportPage } from "../../features/reports/pages/SupplierReportPage";
import { UsageReportPage } from "../../features/reports/pages/UsageReportPage";
import { ShopSetupPage } from "../../features/shop/pages/ShopSetupPage";
import { StaffManagementPage } from "../../features/staff/pages/StaffManagementPage";
import { StockTransfersPage } from "../../features/stock-transfers/pages/StockTransfersPage";
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
      <Route element={<DocumentPreviewPage />} path="/documents/:kind/:id" />
      <Route element={<AppLayout />} path="/app">
        <Route element={<DashboardHomePage />} index />
        <Route element={<NotificationCenterPage />} path="notifications" />
        <Route element={<RequirePermissions permissions={["billing.create"]} />}>
          <Route element={<BillingPage />} path="billing" />
        </Route>
        <Route element={<RequirePermissions permissions={["customers.view"]} />}>
          <Route element={<CustomersPage />} path="customers" />
          <Route element={<CustomerDetailPage />} path="customers/:id" />
        </Route>
        <Route element={<RequirePermissions permissions={["payments.view"]} />}>
          <Route element={<Navigate replace to="/app/accounting/customers" />} path="accounting" />
          <Route element={<CustomerAccountingPage />} path="accounting/customers" />
          <Route element={<CustomerLedgerPage />} path="accounting/customers/:id" />
          <Route element={<SupplierAccountingPage />} path="accounting/suppliers" />
          <Route element={<SupplierLedgerPage />} path="accounting/suppliers/:id" />
        </Route>
        <Route element={<RequirePermissions permissions={["billing.view"]} />}>
          <Route element={<HeldBillsPage />} path="billing/held" />
          <Route element={<BillingHistoryPage />} path="billing/history" />
          <Route element={<BillingDetailPage />} path="billing/:id" />
        </Route>
        <Route element={<RequirePermissions permissions={["billing.return"]} />}>
          <Route element={<SalesReturnsPage />} path="billing/returns" />
          <Route element={<SalesReturnDetailPage />} path="billing/returns/:id" />
        </Route>
        <Route element={<RequirePermissions permissions={["reports.view"]} />}>
          <Route element={<Navigate replace to="/app/reports/dashboard" />} path="reports" />
          <Route element={<ReportsDashboardPage />} path="reports/dashboard" />
          <Route element={<SalesReportPage />} path="reports/sales" />
        </Route>
        <Route element={<RequirePermissions permissions={["billing.return"]} />}>
          <Route element={<SalesReturnEditorPage />} path="billing/returns/new" />
          <Route element={<SalesReturnEditorPage />} path="billing/returns/:id/edit" />
        </Route>
        <Route element={<RequirePermissions permissions={["reports.financial"]} />}>
          <Route element={<ProfitReportPage />} path="reports/profit" />
          <Route element={<StockReportPage />} path="reports/stock" />
          <Route element={<LowStockReportPage />} path="reports/low-stock" />
          <Route element={<ExpiryReportPage />} path="reports/expiry" />
          <Route element={<SupplierReportPage />} path="reports/suppliers" />
          <Route element={<UsageReportPage />} path="reports/usage" />
        </Route>
        <Route element={<RequirePermissions permissions={["shop.view"]} />}>
          <Route element={<ShopSetupPage />} path="shop-setup" />
        </Route>
        <Route element={<RequirePermissions permissions={["users.view"]} />}>
          <Route element={<StaffManagementPage />} path="staff-management" />
        </Route>
        <Route element={<RequirePermissions permissions={["medicines.view"]} />}>
          <Route element={<MedicinesPage />} path="medicines" />
        </Route>
        <Route element={<RequirePermissions permissions={["suppliers.view"]} />}>
          <Route element={<SuppliersPage />} path="suppliers" />
        </Route>
        <Route element={<RequirePermissions permissions={["purchases.view"]} />}>
          <Route element={<PurchasesPage />} path="purchases" />
          <Route element={<PurchaseDetailPage />} path="purchases/:id" />
        </Route>
        <Route element={<RequirePermissions permissions={["purchases.create"]} />}>
          <Route element={<PurchaseCreatePage />} path="purchases/new" />
          <Route element={<PurchaseEditPage />} path="purchases/:id/edit" />
        </Route>
        <Route element={<RequirePermissions permissions={["purchaseReturns.view"]} />}>
          <Route element={<PurchaseReturnsPage />} path="purchase-returns" />
          <Route element={<PurchaseReturnDetailPage />} path="purchase-returns/:id" />
        </Route>
        <Route element={<RequirePermissions permissions={["purchaseReturns.create"]} />}>
          <Route element={<PurchaseReturnEditorPage />} path="purchase-returns/new" />
          <Route element={<PurchaseReturnEditorPage />} path="purchase-returns/:id/edit" />
        </Route>
        <Route element={<RequirePermissions permissions={["inventory.view"]} />}>
          <Route element={<InventorySummaryPage />} path="inventory" />
          <Route element={<LowStockPage />} path="inventory/low-stock" />
          <Route element={<InventoryExpiryReportPage />} path="inventory/expiry" />
          <Route element={<InventoryDetailPage />} path="inventory/:medicineId" />
        </Route>
        <Route element={<RequireAdmin />}>
          <Route element={<StockTransfersPage />} path="inventory/transfers" />
          <Route element={<BranchesPage />} path="branches" />
        </Route>
        <Route element={<RequireAdmin />}>
          <Route element={<DataManagementPage />} path="data-management" />
          <Route element={<AdminSettingsPage />} path="admin-settings" />
        </Route>
      </Route>
    </Route>

    <Route element={<Navigate replace to="/" />} path="*" />
  </Routes>
);
