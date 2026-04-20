import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { canAccessModule } from "../../../types/auth";
import { billingQueryKeys, listBills } from "../../billing/api/billing";
import { useSessionQuery } from "../../auth/hooks/use-session";
import {
  accountingQueryKeys,
  listAccountingCustomerPayments,
  listAccountingSupplierPayments,
  listOutstandingCustomers,
  listOutstandingSuppliers,
} from "../../accounting/api/accounting";
import {
  getNotificationSummary,
  notificationsQueryKeys,
} from "../../notifications/api/notifications";
import {
  inventoryQueryKeys,
  listExpiryReport,
  listLowStock,
  listStockTransactions,
} from "../../inventory/api/inventory";
import {
  getProfitReport,
  getReportsDashboardSummary,
  getSalesReport,
  reportsQueryKeys,
} from "../../reports/api/reports";
import {
  purchaseReturnsQueryKeys,
  listPurchaseReturns,
} from "../../purchase-returns/api/purchaseReturns";
import {
  salesReturnsQueryKeys,
  listSalesReturns,
} from "../../sales-returns/api/salesReturns";
import {
  cn,
  formatCurrency,
  formatDate,
  formatNumber,
  getDaysUntil,
} from "../../../lib/utils";
import { AlertList } from "../components/AlertList";
import { ActivityList, type DashboardActivityItem } from "../components/ActivityList";
import { MetricCard } from "../components/MetricCard";
import { QuickLinkCard } from "../components/QuickLinkCard";
import { TrendChart, type TrendPoint } from "../components/TrendChart";

const toDateParam = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const toPeriodLabel = (value: string | Date) =>
  new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(new Date(value));

const parseMoney = (value?: string | number | null) => Number(value ?? 0);
const isPresent = <T,>(value: T | null | undefined): value is T => value !== null && value !== undefined;

const describeDelta = (value: number, label: string) =>
  `${formatNumber(value)} ${label}${value === 1 ? "" : "s"}`;

export const DashboardHomePage = () => {
  const sessionQuery = useSessionQuery();

  if (!sessionQuery.data) {
    return null;
  }

  const { shop, user } = sessionQuery.data;
  const canViewReports = canAccessModule(user, {
    permissions: ["reports.view"],
    permissionMode: "all",
  });
  const canViewInventory = canAccessModule(user, {
    permissions: ["inventory.view"],
    permissionMode: "all",
  });
  const canViewPayments = canAccessModule(user, {
    permissions: ["payments.view"],
    permissionMode: "all",
  });
  const canViewBilling = canAccessModule(user, {
    permissions: ["billing.view"],
    permissionMode: "all",
  });
  const canViewSalesReturns = canAccessModule(user, {
    permissions: ["billing.return"],
    permissionMode: "all",
  });
  const canViewPurchaseReturns = canAccessModule(user, {
    permissions: ["purchaseReturns.view"],
    permissionMode: "all",
  });

  const today = new Date();
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(today);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const todayParam = toDateParam(todayStart);
  const monthStartParam = toDateParam(monthStart);
  const weekStartParam = toDateParam(weekStart);

  const notificationsSummaryQuery = useQuery({
    queryKey: notificationsQueryKeys.summary,
    queryFn: getNotificationSummary,
    refetchInterval: 60_000,
  });

  const reportsSummaryQuery = useQuery({
    queryKey: reportsQueryKeys.dashboard({}),
    queryFn: () => getReportsDashboardSummary({}),
    enabled: canViewReports,
    staleTime: 60_000,
  });

  const salesInsightsParams = {
    dateFrom: weekStartParam,
    dateTo: todayParam,
    groupBy: "day" as const,
    page: 1,
    pageSize: 4,
    sortBy: "completedAt" as const,
    sortOrder: "desc" as const,
  };
  const salesInsightsQuery = useQuery({
    queryKey: reportsQueryKeys.sales(salesInsightsParams),
    queryFn: () => getSalesReport(salesInsightsParams),
    enabled: canViewReports,
    staleTime: 60_000,
  });

  const profitMonthParams = {
    dateFrom: monthStartParam,
    dateTo: todayParam,
    groupBy: "day" as const,
    page: 1,
    pageSize: 5,
    sortBy: "profit" as const,
    sortOrder: "desc" as const,
  };
  const profitMonthQuery = useQuery({
    queryKey: reportsQueryKeys.profit(profitMonthParams),
    queryFn: () => getProfitReport(profitMonthParams),
    enabled: canViewReports,
    staleTime: 60_000,
  });

  const profitTodayParams = {
    dateFrom: todayParam,
    dateTo: todayParam,
    groupBy: "day" as const,
    page: 1,
    pageSize: 1,
    sortBy: "profit" as const,
    sortOrder: "desc" as const,
  };
  const profitTodayQuery = useQuery({
    queryKey: reportsQueryKeys.profit(profitTodayParams),
    queryFn: () => getProfitReport(profitTodayParams),
    enabled: canViewReports,
    staleTime: 60_000,
  });

  const lowStockParams = {
    page: 1,
    pageSize: 5,
    sortBy: "availableQuantity" as const,
    sortOrder: "asc" as const,
  };
  const lowStockQuery = useQuery({
    queryKey: inventoryQueryKeys.lowStock(lowStockParams),
    queryFn: () => listLowStock(lowStockParams),
    enabled: canViewInventory,
    staleTime: 60_000,
  });

  const expiryParams = {
    expiryWindow: "30" as const,
    page: 1,
    pageSize: 5,
    sortBy: "expiryDate" as const,
    sortOrder: "asc" as const,
  };
  const expiryQuery = useQuery({
    queryKey: inventoryQueryKeys.expiry(expiryParams),
    queryFn: () => listExpiryReport(expiryParams),
    enabled: canViewInventory,
    staleTime: 60_000,
  });

  const customerDueParams = {
    page: 1,
    pageSize: 5,
    sortBy: "outstandingAmount" as const,
    sortOrder: "desc" as const,
  };
  const customerDueQuery = useQuery({
    queryKey: accountingQueryKeys.outstandingCustomers(customerDueParams),
    queryFn: () => listOutstandingCustomers(customerDueParams),
    enabled: canViewPayments,
    staleTime: 60_000,
  });

  const supplierPayableParams = {
    page: 1,
    pageSize: 5,
    sortBy: "outstandingAmount" as const,
    sortOrder: "desc" as const,
  };
  const supplierPayableQuery = useQuery({
    queryKey: accountingQueryKeys.outstandingSuppliers(supplierPayableParams),
    queryFn: () => listOutstandingSuppliers(supplierPayableParams),
    enabled: canViewPayments,
    staleTime: 60_000,
  });

  const billParams = {
    status: "completed" as const,
    page: 1,
    pageSize: 4,
    sortBy: "completedAt" as const,
    sortOrder: "desc" as const,
  };
  const billsQuery = useQuery({
    queryKey: billingQueryKeys.list(billParams),
    queryFn: () => listBills(billParams),
    enabled: canViewBilling,
    staleTime: 60_000,
  });

  const salesReturnParams = {
    status: "completed" as const,
    page: 1,
    pageSize: 3,
    sortBy: "completedAt" as const,
    sortOrder: "desc" as const,
  };
  const salesReturnsQuery = useQuery({
    queryKey: salesReturnsQueryKeys.list(salesReturnParams),
    queryFn: () => listSalesReturns(salesReturnParams),
    enabled: canViewSalesReturns,
    staleTime: 60_000,
  });

  const purchaseReturnParams = {
    status: "completed" as const,
    page: 1,
    pageSize: 3,
    sortBy: "completedAt" as const,
    sortOrder: "desc" as const,
  };
  const purchaseReturnsQuery = useQuery({
    queryKey: purchaseReturnsQueryKeys.list(purchaseReturnParams),
    queryFn: () => listPurchaseReturns(purchaseReturnParams),
    enabled: canViewPurchaseReturns,
    staleTime: 60_000,
  });

  const customerPaymentParams = {
    status: "completed" as const,
    page: 1,
    pageSize: 3,
    sortBy: "paymentDate" as const,
    sortOrder: "desc" as const,
  };
  const customerPaymentsQuery = useQuery({
    queryKey: accountingQueryKeys.customerPayments(customerPaymentParams),
    queryFn: () => listAccountingCustomerPayments(customerPaymentParams),
    enabled: canViewPayments,
    staleTime: 60_000,
  });

  const supplierPaymentParams = {
    status: "completed" as const,
    page: 1,
    pageSize: 3,
    sortBy: "paymentDate" as const,
    sortOrder: "desc" as const,
  };
  const supplierPaymentsQuery = useQuery({
    queryKey: accountingQueryKeys.supplierPayments(supplierPaymentParams),
    queryFn: () => listAccountingSupplierPayments(supplierPaymentParams),
    enabled: canViewPayments,
    staleTime: 60_000,
  });

  const stockTransactionParams = {
    page: 1,
    pageSize: 4,
    sortBy: "createdAt" as const,
    sortOrder: "desc" as const,
  };
  const stockTransactionsQuery = useQuery({
    queryKey: inventoryQueryKeys.transactionList(stockTransactionParams),
    queryFn: () => listStockTransactions(stockTransactionParams),
    enabled: canViewInventory,
    staleTime: 60_000,
  });

  const reportsSummary = reportsSummaryQuery.data;
  const salesInsights = salesInsightsQuery.data;
  const profitMonth = profitMonthQuery.data;
  const profitToday = profitTodayQuery.data;
  const alerts = notificationsSummaryQuery.data?.latest ?? [];

  const salesTrendPoints: TrendPoint[] =
    salesInsights?.trend.map((item) => ({
      label: toPeriodLabel(item.periodStart),
      value: parseMoney(item.totalSales),
    })) ?? [];
  const profitTrendPoints: TrendPoint[] =
    profitMonth?.trend.map((item) => ({
      label: toPeriodLabel(item.periodStart),
      value: parseMoney(item.profit),
    })) ?? [];

  const strongestSalesDay =
    salesInsights?.trend.reduce((current, item) =>
      parseMoney(item.totalSales) > parseMoney(current?.totalSales)
        ? item
        : (current ?? item),
    ) ?? null;
  const strongestProfitDay =
    profitMonth?.trend.reduce((current, item) =>
      parseMoney(item.profit) > parseMoney(current?.profit)
        ? item
        : (current ?? item),
    ) ?? null;

  const topMetrics = [
    canViewReports
      ? {
          label: "Today sales",
          value: formatCurrency(reportsSummary?.todaySales.totalSales),
          hint: describeDelta(reportsSummary?.todaySales.totalBills ?? 0, "bill"),
          to: "/app/reports/sales",
          tone: "accent" as const,
        }
      : null,
    canViewReports
      ? {
          label: "Monthly sales",
          value: formatCurrency(reportsSummary?.monthlySales.totalSales),
          hint: describeDelta(reportsSummary?.monthlySales.totalBills ?? 0, "bill"),
          to: "/app/reports/sales",
          tone: "default" as const,
        }
      : null,
    canViewReports
      ? {
          label: "Today profit",
          value: formatCurrency(profitToday?.summary.profit),
          hint: "Completed sales for today",
          to: "/app/reports/profit",
          tone: "accent" as const,
        }
      : null,
    canViewReports
      ? {
          label: "Monthly profit",
          value: formatCurrency(profitMonth?.summary.profit ?? reportsSummary?.totalProfit),
          hint: `${formatNumber(parseMoney(profitMonth?.summary.profitPercent))}% margin`,
          to: "/app/reports/profit",
          tone: "default" as const,
        }
      : null,
    canViewInventory
      ? {
          label: "Low stock count",
          value: formatNumber(reportsSummary?.lowStockCount ?? lowStockQuery.data?.pagination.total),
          hint: "Medicines at or below reorder level",
          to: "/app/inventory/low-stock",
          tone:
            (reportsSummary?.lowStockCount ?? lowStockQuery.data?.pagination.total ?? 0) > 0
              ? ("warning" as const)
              : ("default" as const),
        }
      : null,
    canViewInventory
      ? {
          label: "Near expiry count",
          value: formatNumber(
            reportsSummary?.expiryBreakdown.next30Days ?? expiryQuery.data?.pagination.total,
          ),
          hint: "Batches expiring within 30 days",
          to: "/app/inventory/expiry",
          tone:
            (reportsSummary?.expiryBreakdown.next30Days ?? expiryQuery.data?.pagination.total ?? 0) > 0
              ? ("danger" as const)
              : ("default" as const),
        }
      : null,
    canViewPayments
      ? {
          label: "Customer due amount",
          value: formatCurrency(customerDueQuery.data?.summary.totalOutstandingAmount),
          hint: describeDelta(customerDueQuery.data?.summary.entityCount ?? 0, "customer"),
          to: "/app/accounting/customers",
          tone:
            (customerDueQuery.data?.summary.entityCount ?? 0) > 0
              ? ("warning" as const)
              : ("default" as const),
        }
      : null,
    canViewPayments
      ? {
          label: "Supplier payable amount",
          value: formatCurrency(supplierPayableQuery.data?.summary.totalOutstandingAmount),
          hint: describeDelta(supplierPayableQuery.data?.summary.entityCount ?? 0, "supplier"),
          to: "/app/accounting/suppliers",
          tone:
            (supplierPayableQuery.data?.summary.entityCount ?? 0) > 0
              ? ("warning" as const)
              : ("default" as const),
        }
      : null,
  ].filter(isPresent);

  const quickLinks = [
    canViewInventory
      ? {
          title: "Low stock follow-up",
          description: "Open the medicines under reorder level and resolve urgent shortages.",
          to: "/app/inventory/low-stock",
          metric: `${formatNumber(reportsSummary?.lowStockCount ?? lowStockQuery.data?.pagination.total ?? 0)} items`,
          tone:
            (reportsSummary?.lowStockCount ?? lowStockQuery.data?.pagination.total ?? 0) > 0
              ? ("warning" as const)
              : ("default" as const),
        }
      : null,
    canViewInventory
      ? {
          title: "Near expiry review",
          description: "See batches that need disposal, transfer, or sales push planning.",
          to: "/app/inventory/expiry",
          metric: `${formatNumber(
            reportsSummary?.expiryBreakdown.next30Days ?? expiryQuery.data?.pagination.total ?? 0,
          )} batches`,
          tone:
            (reportsSummary?.expiryBreakdown.next30Days ?? expiryQuery.data?.pagination.total ?? 0) > 0
              ? ("danger" as const)
              : ("default" as const),
        }
      : null,
    canViewPayments
      ? {
          title: "Receivables queue",
          description: "Review overdue customers, open bills, and collection priority.",
          to: "/app/accounting/customers",
          metric: formatCurrency(customerDueQuery.data?.summary.totalOutstandingAmount),
          tone: "warning" as const,
        }
      : null,
    canViewPayments
      ? {
          title: "Payables queue",
          description: "Monitor supplier balances and recent settlement pressure.",
          to: "/app/accounting/suppliers",
          metric: formatCurrency(supplierPayableQuery.data?.summary.totalOutstandingAmount),
          tone: "default" as const,
        }
      : null,
    canViewReports
      ? {
          title: "Sales reports",
          description: "Drill into completed bills, value trends, and performance snapshots.",
          to: "/app/reports/sales",
          metric: formatCurrency(reportsSummary?.monthlySales.totalSales),
          tone: "accent" as const,
        }
      : null,
    {
      title: "Notification center",
      description: "Review unread alerts, critical warnings, and system follow-up items.",
      to: "/app/notifications",
      metric: `${formatNumber(notificationsSummaryQuery.data?.unreadCount ?? 0)} unread`,
      tone:
        (notificationsSummaryQuery.data?.criticalCount ?? 0) > 0
          ? ("danger" as const)
          : ("default" as const),
    },
  ].filter(isPresent);

  const activityItems: DashboardActivityItem[] = [
    ...(billsQuery.data?.items ?? []).map((item) => ({
      id: `bill-${item.id}`,
      label: "completed",
      tone: item.paymentStatus,
      title: item.billNumber,
      description: `${item.customerLabel} • ${item.paymentMethod}`,
      amount: formatCurrency(item.grandTotal),
      occurredAt: item.completedAt ?? item.createdAt,
      to: `/app/billing/${item.id}`,
    })),
    ...(salesReturnsQuery.data?.items ?? []).map((item) => ({
      id: `sales-return-${item.id}`,
      label: "sale_return",
      title: item.returnNumber,
      description: `${item.customerLabel} • ${item.billNumber}`,
      amount: formatCurrency(item.totalReturnAmount),
      occurredAt: item.completedAt ?? item.createdAt,
      to: `/app/billing/returns/${item.id}`,
    })),
    ...(purchaseReturnsQuery.data?.items ?? []).map((item) => ({
      id: `purchase-return-${item.id}`,
      label: "purchase_return",
      title: item.returnNumber,
      description: `${item.supplierName} • ${item.purchaseNumber}`,
      amount: formatCurrency(item.totalReturnAmount),
      occurredAt: item.completedAt ?? item.createdAt,
      to: `/app/purchase-returns/${item.id}`,
    })),
    ...(customerPaymentsQuery.data?.items ?? []).map((item) => ({
      id: `customer-payment-${item.id}`,
      label: "payment_received",
      title: item.customer.fullName,
      description: `${item.paymentMethod} payment${item.linkedSale ? ` • ${item.linkedSale.billNumber}` : ""}`,
      amount: formatCurrency(item.amount),
      occurredAt: item.paymentDate,
      to: `/app/accounting/customers/${item.customer.id}`,
    })),
    ...(supplierPaymentsQuery.data?.items ?? []).map((item) => ({
      id: `supplier-payment-${item.id}`,
      label: "payment_made",
      title: item.supplier.supplierName,
      description: `${item.paymentMethod} payment${item.linkedPurchase ? ` • ${item.linkedPurchase.purchaseNumber}` : ""}`,
      amount: formatCurrency(item.amount),
      occurredAt: item.paymentDate,
      to: `/app/accounting/suppliers/${item.supplier.id}`,
    })),
    ...(stockTransactionsQuery.data?.items ?? []).map((item) => ({
      id: `stock-${item.id}`,
      label: item.transactionType,
      title: item.medicine.medicineName,
      description: `${item.batch.batchNumber} • balance ${formatNumber(item.balanceAfter)}`,
      amount:
        item.quantityIn > 0
          ? `+${formatNumber(item.quantityIn)}`
          : `-${formatNumber(item.quantityOut)}`,
      occurredAt: item.createdAt,
      to: `/app/inventory/${item.medicine.id}`,
    })),
  ]
    .sort(
      (left, right) =>
        new Date(right.occurredAt ?? 0).getTime() -
        new Date(left.occurredAt ?? 0).getTime(),
    )
    .slice(0, 8);

  const visibleSections =
    topMetrics.length ||
    quickLinks.length ||
    canViewReports ||
    canViewInventory ||
    canViewPayments ||
    alerts.length ||
    activityItems.length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Dashboard"
        title={`${shop.name} operations`}
        description={
          user.role === "accountant"
            ? "Keep collections, payables, profit movement, and operational alerts under one clean financial dashboard."
            : user.role === "staff"
              ? "Stay on top of bills, stock pressure, expiry risk, and the latest operational actions without extra noise."
              : "Review sales, profit, inventory risk, dues, alerts, and recent activity from one compact operational dashboard."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={user.role} tone={user.role} />
            {reportsSummary?.lowStockCount || reportsSummary?.expiryBreakdown.expired ? (
              <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                Attention required
              </span>
            ) : null}
          </div>
        }
      />

      {!visibleSections ? (
        <EmptyState
          title="No dashboard modules available"
          description="Your current role does not have any dashboard-enabled modules yet."
        />
      ) : null}

      {topMetrics.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {topMetrics.map((item) => (
            <MetricCard
              hint={item.hint}
              key={item.label}
              label={item.label}
              to={item.to}
              tone={item.tone}
              value={item.value}
            />
          ))}
        </div>
      ) : null}

      {quickLinks.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((item) => (
            <QuickLinkCard
              description={item.description}
              key={item.title}
              metric={item.metric}
              title={item.title}
              to={item.to}
              tone={item.tone}
            />
          ))}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        {canViewReports ? (
          <SectionCard
            title="Sales insights"
            description="Daily sales movement for the last 7 days, with compact month-to-date context for quick review."
            action={
              <Link
                className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                to="/app/reports/sales"
              >
                Open sales report
              </Link>
            }
          >
            {salesInsightsQuery.error ? (
              <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                {salesInsightsQuery.error.message}
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                <TrendChart points={salesTrendPoints} />
                <div className="grid gap-3">
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Last 7 days sales
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {formatCurrency(salesInsights?.summary.totalSales)}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-600">
                      {describeDelta(salesInsights?.summary.totalBills ?? 0, "completed bill")}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Average bill value
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {formatCurrency(salesInsights?.summary.averageBillValue)}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-600">
                      Month-to-date sales at {formatCurrency(reportsSummary?.monthlySales.totalSales)}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Strongest day
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {strongestSalesDay ? formatCurrency(strongestSalesDay.totalSales) : formatCurrency(0)}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-600">
                      {strongestSalesDay
                        ? `${toPeriodLabel(strongestSalesDay.periodStart)} • ${describeDelta(strongestSalesDay.totalBills, "bill")}`
                        : "No completed sales in the current window."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>
        ) : null}

        <SectionCard
          title="Alerts & notifications"
          description="Unread alerts stay visible so stock, expiry, and financial exceptions do not get buried."
          action={
            <Link
              className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              to="/app/notifications"
            >
              Open notifications
            </Link>
          }
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <MetricCard
              hint="Unread items in your queue"
              label="Unread"
              tone={(notificationsSummaryQuery.data?.unreadCount ?? 0) > 0 ? "accent" : "default"}
              value={formatNumber(notificationsSummaryQuery.data?.unreadCount)}
            />
            <MetricCard
              hint="Critical active alerts"
              label="Critical"
              tone={(notificationsSummaryQuery.data?.criticalCount ?? 0) > 0 ? "danger" : "default"}
              value={formatNumber(notificationsSummaryQuery.data?.criticalCount)}
            />
            <MetricCard
              hint="Latest dashboard alerts"
              label="Visible alerts"
              value={formatNumber(alerts.length)}
            />
          </div>

          {notificationsSummaryQuery.error ? (
            <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
              {notificationsSummaryQuery.error.message}
            </div>
          ) : (
            <AlertList items={alerts.slice(0, 4)} />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        {canViewReports ? (
          <SectionCard
            title="Profit insights"
            description="Track today vs month profit, margin, and the strongest profit day without opening a full report."
            action={
              <Link
                className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                to="/app/reports/profit"
              >
                Open profit report
              </Link>
            }
          >
            {profitMonthQuery.error || profitTodayQuery.error ? (
              <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                {profitMonthQuery.error?.message ?? profitTodayQuery.error?.message}
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <TrendChart color="amber" points={profitTrendPoints} />
                <div className="grid gap-3">
                  <MetricCard
                    hint="Completed sales for today"
                    label="Today profit"
                    tone="accent"
                    value={formatCurrency(profitToday?.summary.profit)}
                  />
                  <MetricCard
                    hint={`${formatNumber(parseMoney(profitMonth?.summary.profitPercent))}% margin this month`}
                    label="Monthly profit"
                    value={formatCurrency(profitMonth?.summary.profit)}
                  />
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Revenue
                        </p>
                        <p className="mt-1.5 text-sm font-semibold text-slate-950">
                          {formatCurrency(profitMonth?.summary.revenue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Cost
                        </p>
                        <p className="mt-1.5 text-sm font-semibold text-slate-950">
                          {formatCurrency(profitMonth?.summary.cost)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      {strongestProfitDay
                        ? `Best profit day: ${toPeriodLabel(strongestProfitDay.periodStart)} at ${formatCurrency(strongestProfitDay.profit)}.`
                        : "No completed profit records are available in this period."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>
        ) : null}

        {canViewInventory ? (
          <SectionCard
            title="Inventory intelligence"
            description="Low stock and near-expiry items are elevated first so urgent stock action stays obvious."
            action={
              <div className="flex flex-wrap gap-2">
                <Link
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  to="/app/inventory/low-stock"
                >
                  Low stock
                </Link>
                <Link
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  to="/app/inventory/expiry"
                >
                  Expiry report
                </Link>
              </div>
            }
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <MetricCard
                hint="Medicines under threshold"
                label="Low stock"
                tone={(reportsSummary?.lowStockCount ?? lowStockQuery.data?.pagination.total ?? 0) > 0 ? "warning" : "default"}
                value={formatNumber(reportsSummary?.lowStockCount ?? lowStockQuery.data?.pagination.total)}
              />
              <MetricCard
                hint="Expired batches with quantity"
                label="Expired stock"
                tone={(reportsSummary?.expiryBreakdown.expired ?? 0) > 0 ? "danger" : "default"}
                value={formatNumber(reportsSummary?.expiryBreakdown.expired)}
              />
              <MetricCard
                hint="Batches expiring in 30 days"
                label="Near expiry"
                tone={(reportsSummary?.expiryBreakdown.next30Days ?? expiryQuery.data?.pagination.total ?? 0) > 0 ? "danger" : "default"}
                value={formatNumber(reportsSummary?.expiryBreakdown.next30Days ?? expiryQuery.data?.pagination.total)}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Low stock medicines
                </p>
                {lowStockQuery.error ? (
                  <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                    {lowStockQuery.error.message}
                  </div>
                ) : (lowStockQuery.data?.items ?? []).length ? (
                  lowStockQuery.data!.items.map((item) => (
                    <Link
                      className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white"
                      key={item.medicine.id}
                      to={`/app/inventory/${item.medicine.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {item.medicine.medicineName}
                          </p>
                          <p className="mt-1.5 text-sm text-slate-600">
                            {item.category.name} • {item.manufacturer.name}
                          </p>
                        </div>
                        <StatusBadge label="low_stock" tone="low_stock" />
                      </div>
                      <p className="mt-3 text-sm text-slate-600">
                        {formatNumber(item.availableQuantity)} available against reorder level{" "}
                        {formatNumber(item.reorderLevel)}.
                      </p>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No low stock medicines need attention right now.
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Near expiry batches
                </p>
                {expiryQuery.error ? (
                  <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                    {expiryQuery.error.message}
                  </div>
                ) : (expiryQuery.data?.items ?? []).length ? (
                  expiryQuery.data!.items.map((item) => {
                    const daysUntilExpiry = getDaysUntil(item.expiryDate);

                    return (
                      <Link
                        className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white"
                        key={item.id}
                        to={`/app/inventory/${item.medicine.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              {item.medicine.medicineName}
                            </p>
                            <p className="mt-1.5 text-sm text-slate-600">
                              Batch {item.batchNumber} • expires {formatDate(item.expiryDate)}
                            </p>
                          </div>
                          <StatusBadge label={item.expiryStatus} tone={item.expiryStatus} />
                        </div>
                        <p className="mt-3 text-sm text-slate-600">
                          {formatNumber(item.quantityAvailable)} units available
                          {daysUntilExpiry !== null
                            ? ` • ${daysUntilExpiry <= 0 ? "expired" : `${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"} left`}`
                            : ""}
                        </p>
                      </Link>
                    );
                  })
                ) : (
                  <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No near-expiry batches are visible in the current 30-day window.
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        {canViewPayments ? (
          <SectionCard
            title="Dues & payables snapshot"
            description="Receivables and supplier balances stay compact, accurate, and directly connected to ledger drill-downs."
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                hint={`${formatNumber(customerDueQuery.data?.summary.openBillCount)} open bills`}
                label="Customer due"
                tone={(customerDueQuery.data?.summary.entityCount ?? 0) > 0 ? "warning" : "default"}
                value={formatCurrency(customerDueQuery.data?.summary.totalOutstandingAmount)}
              />
              <MetricCard
                hint={`${formatNumber(customerDueQuery.data?.summary.totalAdvanceAmount)} customer advance`}
                label="Due customers"
                value={formatNumber(customerDueQuery.data?.summary.entityCount)}
              />
              <MetricCard
                hint={`${formatNumber(supplierPayableQuery.data?.summary.openPurchaseCount)} open purchases`}
                label="Supplier payable"
                tone={(supplierPayableQuery.data?.summary.entityCount ?? 0) > 0 ? "warning" : "default"}
                value={formatCurrency(supplierPayableQuery.data?.summary.totalOutstandingAmount)}
              />
              <MetricCard
                hint={`${formatNumber(supplierPayableQuery.data?.summary.totalAdvanceAmount)} supplier advance`}
                label="Payable suppliers"
                value={formatNumber(supplierPayableQuery.data?.summary.entityCount)}
              />
            </div>

            {customerDueQuery.error || supplierPayableQuery.error ? (
              <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                {customerDueQuery.error?.message ?? supplierPayableQuery.error?.message}
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Top customer dues
                    </p>
                    <Link
                      className="text-sm font-semibold text-teal-700 hover:text-teal-800"
                      to="/app/accounting/customers"
                    >
                      View all
                    </Link>
                  </div>
                  {(customerDueQuery.data?.items ?? []).length ? (
                    customerDueQuery.data!.items.map((item) => (
                      <Link
                        className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white"
                        key={item.id}
                        to={`/app/accounting/customers/${item.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              {item.fullName}
                            </p>
                            <p className="mt-1.5 text-sm text-slate-600">
                              {item.customerCode} • {item.mobileNumber}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-amber-700">
                            {formatCurrency(item.summary.outstandingAmount)}
                          </p>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">
                          {formatNumber(item.summary.openBillCount)} open bills • last bill{" "}
                          {formatDate(item.summary.lastBillDate)}
                        </p>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      No outstanding customer dues right now.
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Top supplier payables
                    </p>
                    <Link
                      className="text-sm font-semibold text-teal-700 hover:text-teal-800"
                      to="/app/accounting/suppliers"
                    >
                      View all
                    </Link>
                  </div>
                  {(supplierPayableQuery.data?.items ?? []).length ? (
                    supplierPayableQuery.data!.items.map((item) => (
                      <Link
                        className="block rounded-[20px] border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white"
                        key={item.id}
                        to={`/app/accounting/suppliers/${item.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              {item.supplierName}
                            </p>
                            <p className="mt-1.5 text-sm text-slate-600">
                              {item.companyName || "Independent"} • {item.mobileNumber}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-amber-700">
                            {formatCurrency(item.summary.outstandingAmount)}
                          </p>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">
                          {formatNumber(item.summary.openPurchaseCount)} open purchases • last purchase{" "}
                          {formatDate(item.summary.lastPurchaseDate)}
                        </p>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      No supplier payables are outstanding right now.
                    </div>
                  )}
                </div>
              </div>
            )}
          </SectionCard>
        ) : null}

        <SectionCard
          title="Recent activity"
          description="Latest bills, returns, payments, and stock movements available to your role are merged into one operational feed."
        >
          <ActivityList items={activityItems} />
        </SectionCard>
      </div>

      {user.role === "admin" && reportsSummary ? (
        <div
          className={cn(
            "rounded-[24px] border px-4 py-4 shadow-sm shadow-slate-200/60",
            (reportsSummary.lowStockCount > 0 ||
              reportsSummary.expiryBreakdown.expired > 0 ||
              notificationsSummaryQuery.data?.criticalCount)
              ? "border-rose-200 bg-[linear-gradient(180deg,#fff7f7_0%,#fff3f3_100%)]"
              : "border-emerald-200 bg-[linear-gradient(180deg,#f6fffb_0%,#f1fbf6_100%)]",
          )}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Operations pulse
              </p>
              <p className="mt-1.5 text-sm text-slate-700">
                {reportsSummary.lowStockCount > 0 ||
                reportsSummary.expiryBreakdown.expired > 0 ||
                (notificationsSummaryQuery.data?.criticalCount ?? 0) > 0
                  ? `${formatNumber(reportsSummary.lowStockCount)} low stock medicines, ${formatNumber(
                      reportsSummary.expiryBreakdown.expired,
                    )} expired batches, and ${formatNumber(
                      notificationsSummaryQuery.data?.criticalCount ?? 0,
                    )} critical alerts need attention.`
                  : "Inventory risk and critical alerts are currently under control."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canViewInventory ? (
                <Link
                  className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  to="/app/inventory/low-stock"
                >
                  Review stock
                </Link>
              ) : null}
              <Link
                className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                to="/app/notifications"
              >
                Review alerts
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {(billsQuery.error ||
        salesReturnsQuery.error ||
        purchaseReturnsQuery.error ||
        customerPaymentsQuery.error ||
        supplierPaymentsQuery.error ||
        stockTransactionsQuery.error) && !activityItems.length ? (
        <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          Some recent activity widgets could not be loaded. Open the related module for details.
        </div>
      ) : null}
    </div>
  );
};
