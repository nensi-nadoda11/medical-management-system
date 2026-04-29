import {
  Suspense,
  lazy,
  type ComponentType,
  type ReactNode,
} from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "../../components/layout/AppLayout";
import {
  RequireAdmin,
  RequireAuth,
  RequireGuest,
  RequirePermissions,
} from "../../components/layout/RouteGuards";
import { LoadingState } from "../../components/ui/LoadingState";
import { useSessionQuery } from "../../features/auth/hooks/use-session";

const lazyPage = <T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
) => lazy(loader);

const renderLazyRoute = (element: ReactNode) => (
  <Suspense fallback={<LoadingState title="Loading page" />}>
    {element}
  </Suspense>
);

const AdminSettingsPage = lazyPage(() =>
  import("../../features/admin-settings/pages/AdminSettingsPage").then(
    (module) => ({ default: module.AdminSettingsPage }),
  ),
);
const CustomerAccountingPage = lazyPage(() =>
  import("../../features/accounting/pages/CustomerAccountingPage").then(
    (module) => ({ default: module.CustomerAccountingPage }),
  ),
);
const CustomerLedgerPage = lazyPage(() =>
  import("../../features/accounting/pages/CustomerLedgerPage").then((module) => ({
    default: module.CustomerLedgerPage,
  })),
);
const SupplierAccountingPage = lazyPage(() =>
  import("../../features/accounting/pages/SupplierAccountingPage").then(
    (module) => ({ default: module.SupplierAccountingPage }),
  ),
);
const SupplierLedgerPage = lazyPage(() =>
  import("../../features/accounting/pages/SupplierLedgerPage").then((module) => ({
    default: module.SupplierLedgerPage,
  })),
);
const AuthPage = lazyPage(() =>
  import("../../features/auth/pages/AuthPage").then((module) => ({
    default: module.AuthPage,
  })),
);
const BillingDetailPage = lazyPage(() =>
  import("../../features/billing/pages/BillingDetailPage").then((module) => ({
    default: module.BillingDetailPage,
  })),
);
const BillingHistoryPage = lazyPage(() =>
  import("../../features/billing/pages/BillingHistoryPage").then((module) => ({
    default: module.BillingHistoryPage,
  })),
);
const BillingPage = lazyPage(() =>
  import("../../features/billing/pages/BillingPage").then((module) => ({
    default: module.BillingPage,
  })),
);
const BranchesPage = lazyPage(() =>
  import("../../features/branches/pages/BranchesPage").then((module) => ({
    default: module.BranchesPage,
  })),
);
const DocumentPreviewPage = lazyPage(() =>
  import("../../features/documents/pages/DocumentPreviewPage").then((module) => ({
    default: module.DocumentPreviewPage,
  })),
);
const HeldBillsPage = lazyPage(() =>
  import("../../features/billing/pages/HeldBillsPage").then((module) => ({
    default: module.HeldBillsPage,
  })),
);
const SalesReturnDetailPage = lazyPage(() =>
  import("../../features/sales-returns/pages/SalesReturnDetailPage").then(
    (module) => ({ default: module.SalesReturnDetailPage }),
  ),
);
const SalesReturnEditorPage = lazyPage(() =>
  import("../../features/sales-returns/pages/SalesReturnEditorPage").then(
    (module) => ({ default: module.SalesReturnEditorPage }),
  ),
);
const SalesReturnsPage = lazyPage(() =>
  import("../../features/sales-returns/pages/SalesReturnsPage").then((module) => ({
    default: module.SalesReturnsPage,
  })),
);
const DashboardHomePage = lazyPage(() =>
  import("../../features/dashboard/pages/DashboardHomePage").then((module) => ({
    default: module.DashboardHomePage,
  })),
);
const DataManagementPage = lazyPage(() =>
  import("../../features/data-management/pages/DataManagementPage").then(
    (module) => ({ default: module.DataManagementPage }),
  ),
);
const SetPasswordPage = lazyPage(() =>
  import("../../features/invitations/pages/SetPasswordPage").then((module) => ({
    default: module.SetPasswordPage,
  })),
);
const InventoryExpiryReportPage = lazyPage(() =>
  import("../../features/inventory/pages/ExpiryReportPage").then((module) => ({
    default: module.ExpiryReportPage,
  })),
);
const InventoryDetailPage = lazyPage(() =>
  import("../../features/inventory/pages/InventoryDetailPage").then((module) => ({
    default: module.InventoryDetailPage,
  })),
);
const InventorySummaryPage = lazyPage(() =>
  import("../../features/inventory/pages/InventorySummaryPage").then((module) => ({
    default: module.InventorySummaryPage,
  })),
);
const LowStockPage = lazyPage(() =>
  import("../../features/inventory/pages/LowStockPage").then((module) => ({
    default: module.LowStockPage,
  })),
);
const MedicinesPage = lazyPage(() =>
  import("../../features/medicines/pages/MedicinesPage").then((module) => ({
    default: module.MedicinesPage,
  })),
);
const CustomerDetailPage = lazyPage(() =>
  import("../../features/customers/pages/CustomerDetailPage").then((module) => ({
    default: module.CustomerDetailPage,
  })),
);
const CustomersPage = lazyPage(() =>
  import("../../features/customers/pages/CustomersPage").then((module) => ({
    default: module.CustomersPage,
  })),
);
const PurchaseCreatePage = lazyPage(() =>
  import("../../features/purchases/pages/PurchaseCreatePage").then((module) => ({
    default: module.PurchaseCreatePage,
  })),
);
const PurchaseDetailPage = lazyPage(() =>
  import("../../features/purchases/pages/PurchaseDetailPage").then((module) => ({
    default: module.PurchaseDetailPage,
  })),
);
const PurchaseEditPage = lazyPage(() =>
  import("../../features/purchases/pages/PurchaseEditPage").then((module) => ({
    default: module.PurchaseEditPage,
  })),
);
const PurchasesPage = lazyPage(() =>
  import("../../features/purchases/pages/PurchasesPage").then((module) => ({
    default: module.PurchasesPage,
  })),
);
const PurchaseReturnDetailPage = lazyPage(() =>
  import("../../features/purchase-returns/pages/PurchaseReturnDetailPage").then(
    (module) => ({ default: module.PurchaseReturnDetailPage }),
  ),
);
const PurchaseReturnEditorPage = lazyPage(() =>
  import("../../features/purchase-returns/pages/PurchaseReturnEditorPage").then(
    (module) => ({ default: module.PurchaseReturnEditorPage }),
  ),
);
const PurchaseReturnsPage = lazyPage(() =>
  import("../../features/purchase-returns/pages/PurchaseReturnsPage").then(
    (module) => ({ default: module.PurchaseReturnsPage }),
  ),
);
const NotificationCenterPage = lazyPage(() =>
  import("../../features/notifications/pages/NotificationCenterPage").then(
    (module) => ({ default: module.NotificationCenterPage }),
  ),
);
const ExpiryReportPage = lazyPage(() =>
  import("../../features/reports/pages/ExpiryReportPage").then((module) => ({
    default: module.ExpiryReportPage,
  })),
);
const LowStockReportPage = lazyPage(() =>
  import("../../features/reports/pages/LowStockReportPage").then((module) => ({
    default: module.LowStockReportPage,
  })),
);
const ProfitReportPage = lazyPage(() =>
  import("../../features/reports/pages/ProfitReportPage").then((module) => ({
    default: module.ProfitReportPage,
  })),
);
const ReportsDashboardPage = lazyPage(() =>
  import("../../features/reports/pages/ReportsDashboardPage").then((module) => ({
    default: module.ReportsDashboardPage,
  })),
);
const SalesReportPage = lazyPage(() =>
  import("../../features/reports/pages/SalesReportPage").then((module) => ({
    default: module.SalesReportPage,
  })),
);
const StockReportPage = lazyPage(() =>
  import("../../features/reports/pages/StockReportPage").then((module) => ({
    default: module.StockReportPage,
  })),
);
const SupplierReportPage = lazyPage(() =>
  import("../../features/reports/pages/SupplierReportPage").then((module) => ({
    default: module.SupplierReportPage,
  })),
);
const UsageReportPage = lazyPage(() =>
  import("../../features/reports/pages/UsageReportPage").then((module) => ({
    default: module.UsageReportPage,
  })),
);
const ShopSetupPage = lazyPage(() =>
  import("../../features/shop/pages/ShopSetupPage").then((module) => ({
    default: module.ShopSetupPage,
  })),
);
const StaffManagementPage = lazyPage(() =>
  import("../../features/staff/pages/StaffManagementPage").then((module) => ({
    default: module.StaffManagementPage,
  })),
);
const StockTransfersPage = lazyPage(() =>
  import("../../features/stock-transfers/pages/StockTransfersPage").then(
    (module) => ({ default: module.StockTransfersPage }),
  ),
);
const SuppliersPage = lazyPage(() =>
  import("../../features/suppliers/pages/SuppliersPage").then((module) => ({
    default: module.SuppliersPage,
  })),
);

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
      <Route
        element={renderLazyRoute(<AuthPage initialView="login" />)}
        path="/login"
      />
      <Route
        element={renderLazyRoute(<AuthPage initialView="register" />)}
        path="/register"
      />
      <Route
        element={renderLazyRoute(<AuthPage initialView="verify" />)}
        path="/verify"
      />
    </Route>

    <Route
      element={renderLazyRoute(<SetPasswordPage />)}
      path="/set-password"
    />

    <Route element={<RequireAuth />}>
      <Route
        element={renderLazyRoute(<DocumentPreviewPage />)}
        path="/documents/:kind/:id"
      />
      <Route element={<AppLayout />} path="/app">
        <Route element={renderLazyRoute(<DashboardHomePage />)} index />
        <Route
          element={renderLazyRoute(<NotificationCenterPage />)}
          path="notifications"
        />
        <Route element={<RequirePermissions permissions={["billing.create"]} />}>
          <Route element={renderLazyRoute(<BillingPage />)} path="billing" />
        </Route>
        <Route element={<RequirePermissions permissions={["customers.view"]} />}>
          <Route element={renderLazyRoute(<CustomersPage />)} path="customers" />
          <Route
            element={renderLazyRoute(<CustomerDetailPage />)}
            path="customers/:id"
          />
        </Route>
        <Route element={<RequirePermissions permissions={["payments.view"]} />}>
          <Route
            element={<Navigate replace to="/app/accounting/customers" />}
            path="accounting"
          />
          <Route
            element={renderLazyRoute(<CustomerAccountingPage />)}
            path="accounting/customers"
          />
          <Route
            element={renderLazyRoute(<CustomerLedgerPage />)}
            path="accounting/customers/:id"
          />
          <Route
            element={renderLazyRoute(<SupplierAccountingPage />)}
            path="accounting/suppliers"
          />
          <Route
            element={renderLazyRoute(<SupplierLedgerPage />)}
            path="accounting/suppliers/:id"
          />
        </Route>
        <Route element={<RequirePermissions permissions={["billing.view"]} />}>
          <Route
            element={renderLazyRoute(<HeldBillsPage />)}
            path="billing/held"
          />
          <Route
            element={renderLazyRoute(<BillingHistoryPage />)}
            path="billing/history"
          />
          <Route
            element={renderLazyRoute(<BillingDetailPage />)}
            path="billing/:id"
          />
        </Route>
        <Route element={<RequirePermissions permissions={["billing.return"]} />}>
          <Route
            element={renderLazyRoute(<SalesReturnsPage />)}
            path="billing/returns"
          />
          <Route
            element={renderLazyRoute(<SalesReturnDetailPage />)}
            path="billing/returns/:id"
          />
        </Route>
        <Route element={<RequirePermissions permissions={["reports.view"]} />}>
          <Route
            element={<Navigate replace to="/app/reports/dashboard" />}
            path="reports"
          />
          <Route
            element={renderLazyRoute(<ReportsDashboardPage />)}
            path="reports/dashboard"
          />
          <Route
            element={renderLazyRoute(<SalesReportPage />)}
            path="reports/sales"
          />
        </Route>
        <Route element={<RequirePermissions permissions={["billing.return"]} />}>
          <Route
            element={renderLazyRoute(<SalesReturnEditorPage />)}
            path="billing/returns/new"
          />
          <Route
            element={renderLazyRoute(<SalesReturnEditorPage />)}
            path="billing/returns/:id/edit"
          />
        </Route>
        <Route element={<RequirePermissions permissions={["reports.financial"]} />}>
          <Route
            element={renderLazyRoute(<ProfitReportPage />)}
            path="reports/profit"
          />
          <Route
            element={renderLazyRoute(<StockReportPage />)}
            path="reports/stock"
          />
          <Route
            element={renderLazyRoute(<LowStockReportPage />)}
            path="reports/low-stock"
          />
          <Route
            element={renderLazyRoute(<ExpiryReportPage />)}
            path="reports/expiry"
          />
          <Route
            element={renderLazyRoute(<SupplierReportPage />)}
            path="reports/suppliers"
          />
          <Route
            element={renderLazyRoute(<UsageReportPage />)}
            path="reports/usage"
          />
        </Route>
        <Route element={<RequirePermissions permissions={["shop.view"]} />}>
          <Route
            element={renderLazyRoute(<ShopSetupPage />)}
            path="shop-setup"
          />
        </Route>
        <Route element={<RequirePermissions permissions={["users.view"]} />}>
          <Route
            element={renderLazyRoute(<StaffManagementPage />)}
            path="staff-management"
          />
        </Route>
        <Route element={<RequirePermissions permissions={["medicines.view"]} />}>
          <Route
            element={renderLazyRoute(<MedicinesPage />)}
            path="medicines"
          />
        </Route>
        <Route element={<RequirePermissions permissions={["suppliers.view"]} />}>
          <Route
            element={renderLazyRoute(<SuppliersPage />)}
            path="suppliers"
          />
        </Route>
        <Route element={<RequirePermissions permissions={["purchases.view"]} />}>
          <Route
            element={renderLazyRoute(<PurchasesPage />)}
            path="purchases"
          />
          <Route
            element={renderLazyRoute(<PurchaseDetailPage />)}
            path="purchases/:id"
          />
        </Route>
        <Route element={<RequirePermissions permissions={["purchases.create"]} />}>
          <Route
            element={renderLazyRoute(<PurchaseCreatePage />)}
            path="purchases/new"
          />
          <Route
            element={renderLazyRoute(<PurchaseEditPage />)}
            path="purchases/:id/edit"
          />
        </Route>
        <Route
          element={<RequirePermissions permissions={["purchaseReturns.view"]} />}
        >
          <Route
            element={renderLazyRoute(<PurchaseReturnsPage />)}
            path="purchase-returns"
          />
          <Route
            element={renderLazyRoute(<PurchaseReturnDetailPage />)}
            path="purchase-returns/:id"
          />
        </Route>
        <Route
          element={<RequirePermissions permissions={["purchaseReturns.create"]} />}
        >
          <Route
            element={renderLazyRoute(<PurchaseReturnEditorPage />)}
            path="purchase-returns/new"
          />
          <Route
            element={renderLazyRoute(<PurchaseReturnEditorPage />)}
            path="purchase-returns/:id/edit"
          />
        </Route>
        <Route element={<RequirePermissions permissions={["inventory.view"]} />}>
          <Route
            element={renderLazyRoute(<InventorySummaryPage />)}
            path="inventory"
          />
          <Route
            element={renderLazyRoute(<LowStockPage />)}
            path="inventory/low-stock"
          />
          <Route
            element={renderLazyRoute(<InventoryExpiryReportPage />)}
            path="inventory/expiry"
          />
          <Route
            element={renderLazyRoute(<InventoryDetailPage />)}
            path="inventory/:medicineId"
          />
        </Route>
        <Route element={<RequireAdmin />}>
          <Route
            element={renderLazyRoute(<StockTransfersPage />)}
            path="inventory/transfers"
          />
          <Route
            element={renderLazyRoute(<BranchesPage />)}
            path="branches"
          />
        </Route>
        <Route element={<RequireAdmin />}>
          <Route
            element={renderLazyRoute(<DataManagementPage />)}
            path="data-management"
          />
          <Route
            element={renderLazyRoute(<AdminSettingsPage />)}
            path="admin-settings"
          />
        </Route>
      </Route>
    </Route>

    <Route element={<Navigate replace to="/" />} path="*" />
  </Routes>
);
