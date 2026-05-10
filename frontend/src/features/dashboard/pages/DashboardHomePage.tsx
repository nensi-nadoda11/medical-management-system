import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeIndianRupee,
  BarChart3,
  ChevronDown,
  ClipboardPlus,
  Clock3,
  FilePlus2,
  HandCoins,
  LayoutGrid,
  PackagePlus,
  PillBottle,
  ShoppingCart,
  Sparkles,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { canAccessModule } from "../../../types/auth";
import { billingQueryKeys, listBills } from "../../billing/api/billing";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { customersQueryKeys, listCustomers } from "../../customers/api/customers";
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
  getStockReport,
  reportsQueryKeys,
} from "../../reports/api/reports";
import {
  purchaseReturnsQueryKeys,
  listPurchaseReturns,
} from "../../purchase-returns/api/purchaseReturns";
import {
  salesReturnsQueryKeys,
  listSalesReturns,
  type SalesReturnListItem,
} from "../../sales-returns/api/salesReturns";
import { type BillListItem } from "../../billing/api/billing";
import { type PurchaseReturnListItem } from "../../purchase-returns/api/purchaseReturns";
import { type AccountingCustomerPayment, type AccountingSupplierPayment } from "../../accounting/api/accounting";
import { type StockTransactionListItem } from "../../inventory/api/inventory";
import {
  cn,
  formatCurrency,
  formatDate,
  formatDateTime,
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

const calculateChange = (current: number, previous: number) => {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
};

const formatChange = (current: number, previous: number) => {
  const change = calculateChange(current, previous);
  const prefix = change >= 0 ? "+" : "";

  return `${prefix}${change.toFixed(1)}%`;
};

const defaultDashboardSummary = {
  todaySales: {
    totalSales: "0.00",
    totalBills: 0,
  },
  monthlySales: {
    totalSales: "0.00",
    totalBills: 0,
  },
  totalProfit: "0.00",
  lowStockCount: 0,
  expiryCount: 0,
  expiryBreakdown: {
    expired: 0,
    next30Days: 0,
    next60Days: 0,
    next90Days: 0,
  },
};

const defaultSalesSummary = {
  totalSales: "0.00",
  totalBills: 0,
  averageBillValue: "0.00",
};

const defaultProfitSummary = {
  revenue: "0.00",
  cost: "0.00",
  profit: "0.00",
  profitPercent: "0.00",
};

const defaultNotificationSummary = {
  unreadCount: 0,
  criticalCount: 0,
  latest: [],
};

const defaultOutstandingCustomersSummary = {
  entityCount: 0,
  openBillCount: 0,
  totalOutstandingAmount: "0.00",
  totalAdvanceAmount: "0.00",
};

const defaultOutstandingSuppliersSummary = {
  entityCount: 0,
  openPurchaseCount: 0,
  totalOutstandingAmount: "0.00",
  totalAdvanceAmount: "0.00",
};

type SalesOverviewPeriod = "today" | "week" | "month";

const renderSectionError = (message: string) => (
  <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
    {message}
  </div>
);

export const DashboardHomePage = () => {
  const [adminSalesPeriod, setAdminSalesPeriod] = useState<SalesOverviewPeriod>("week");
  const sessionQuery = useSessionQuery();
  const session = sessionQuery.data;
  const shop = session?.shop;
  const user = session?.user;
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
  const canViewCustomers = canAccessModule(user, {
    permissions: ["customers.view"],
    permissionMode: "all",
  });
  const canCreateBills = canAccessModule(user, {
    permissions: ["billing.create"],
    permissionMode: "all",
  });
  const canCreatePayments = canAccessModule(user, {
    permissions: ["payments.create"],
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
  const salesOverviewPeriodConfig: Record<
    SalesOverviewPeriod,
    {
      dateFrom: string;
      dateTo: string;
      label: string;
      pageSize: number;
    }
  > = {
    today: {
      dateFrom: todayParam,
      dateTo: todayParam,
      label: "Today",
      pageSize: 1,
    },
    week: {
      dateFrom: weekStartParam,
      dateTo: todayParam,
      label: "This Week",
      pageSize: 7,
    },
    month: {
      dateFrom: monthStartParam,
      dateTo: todayParam,
      label: "This Month",
      pageSize: 31,
    },
  };

  const notificationsSummaryQuery = useQuery({
    queryKey: notificationsQueryKeys.summary,
    queryFn: getNotificationSummary,
    enabled: Boolean(session),
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
  const adminSalesOverviewParams = {
    dateFrom: salesOverviewPeriodConfig[adminSalesPeriod].dateFrom,
    dateTo: salesOverviewPeriodConfig[adminSalesPeriod].dateTo,
    groupBy: "day" as const,
    page: 1,
    pageSize: salesOverviewPeriodConfig[adminSalesPeriod].pageSize,
    sortBy: "completedAt" as const,
    sortOrder: "desc" as const,
  };
  const adminSalesOverviewQuery = useQuery({
    queryKey: reportsQueryKeys.sales(adminSalesOverviewParams),
    queryFn: () => getSalesReport(adminSalesOverviewParams),
    enabled: canViewReports && user?.role === "admin",
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

  const stockOverviewParams = {
    page: 1,
    pageSize: 1,
    sortBy: "medicineName" as const,
    sortOrder: "asc" as const,
  };
  const stockOverviewQuery = useQuery({
    queryKey: reportsQueryKeys.stock(stockOverviewParams),
    queryFn: () => getStockReport(stockOverviewParams),
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

  const todayBillsParams = {
    status: "completed" as const,
    dateFrom: todayParam,
    dateTo: todayParam,
    page: 1,
    pageSize: 1,
    sortBy: "completedAt" as const,
    sortOrder: "desc" as const,
  };
  const todayBillsQuery = useQuery({
    queryKey: billingQueryKeys.list(todayBillsParams),
    queryFn: () => listBills(todayBillsParams),
    enabled: canViewBilling && !canViewReports,
    staleTime: 60_000,
  });

  const recentCustomersParams = {
    page: 1,
    pageSize: 50,
    sortBy: "createdAt" as const,
    sortOrder: "desc" as const,
  };
  const recentCustomersQuery = useQuery({
    queryKey: customersQueryKeys.list(recentCustomersParams),
    queryFn: () => listCustomers(recentCustomersParams),
    enabled: canViewCustomers,
    staleTime: 60_000,
  });

  const heldBillsParams = {
    status: "held" as const,
    page: 1,
    pageSize: 1,
    sortBy: "createdAt" as const,
    sortOrder: "desc" as const,
  };
  const heldBillsQuery = useQuery({
    queryKey: billingQueryKeys.list(heldBillsParams),
    queryFn: () => listBills(heldBillsParams),
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

  const todayCustomerPaymentParams = {
    status: "completed" as const,
    dateFrom: todayParam,
    dateTo: todayParam,
    page: 1,
    pageSize: 1,
    sortBy: "paymentDate" as const,
    sortOrder: "desc" as const,
  };
  const todayCustomerPaymentsQuery = useQuery({
    queryKey: accountingQueryKeys.customerPayments(todayCustomerPaymentParams),
    queryFn: () => listAccountingCustomerPayments(todayCustomerPaymentParams),
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

  const todaySupplierPaymentParams = {
    status: "completed" as const,
    dateFrom: todayParam,
    dateTo: todayParam,
    page: 1,
    pageSize: 1,
    sortBy: "paymentDate" as const,
    sortOrder: "desc" as const,
  };
  const todaySupplierPaymentsQuery = useQuery({
    queryKey: accountingQueryKeys.supplierPayments(todaySupplierPaymentParams),
    queryFn: () => listAccountingSupplierPayments(todaySupplierPaymentParams),
    enabled: canViewPayments,
    staleTime: 60_000,
  });

  const stockTransactionParams = {
    page: 1,
    pageSize: 40,
    sortBy: "createdAt" as const,
    sortOrder: "desc" as const,
  };
  const stockTransactionsQuery = useQuery({
    queryKey: inventoryQueryKeys.transactionList(stockTransactionParams),
    queryFn: () => listStockTransactions(stockTransactionParams),
    enabled: canViewInventory,
    staleTime: 60_000,
  });

  const reportsSummary = {
    ...defaultDashboardSummary,
    ...(reportsSummaryQuery.data ?? {}),
    todaySales: {
      ...defaultDashboardSummary.todaySales,
      ...(reportsSummaryQuery.data?.todaySales ?? {}),
    },
    monthlySales: {
      ...defaultDashboardSummary.monthlySales,
      ...(reportsSummaryQuery.data?.monthlySales ?? {}),
    },
    expiryBreakdown: {
      ...defaultDashboardSummary.expiryBreakdown,
      ...(reportsSummaryQuery.data?.expiryBreakdown ?? {}),
    },
  };
  const salesInsightsSummary = {
    ...defaultSalesSummary,
    ...(salesInsightsQuery.data?.summary ?? {}),
  };
  const salesTrend = salesInsightsQuery.data?.trend ?? [];
  const adminSalesOverviewSummary = {
    ...defaultSalesSummary,
    ...(adminSalesOverviewQuery.data?.summary ?? {}),
  };
  const adminSalesOverviewTrend = adminSalesOverviewQuery.data?.trend ?? [];
  const profitMonthSummary = {
    ...defaultProfitSummary,
    ...(profitMonthQuery.data?.summary ?? {}),
  };
  const profitMonthTrend = profitMonthQuery.data?.trend ?? [];
  const profitTodaySummary = {
    ...defaultProfitSummary,
    ...(profitTodayQuery.data?.summary ?? {}),
  };
  const notificationsSummary = {
    ...defaultNotificationSummary,
    ...(notificationsSummaryQuery.data ?? {}),
    latest: notificationsSummaryQuery.data?.latest ?? [],
  };
  const customerDueSummary = {
    ...defaultOutstandingCustomersSummary,
    ...(customerDueQuery.data?.summary ?? {}),
  };
  const supplierPayableSummary = {
    ...defaultOutstandingSuppliersSummary,
    ...(supplierPayableQuery.data?.summary ?? {}),
  };
  const alerts = notificationsSummary.latest;
  const lowStockTotal =
    reportsSummary.lowStockCount ?? lowStockQuery.data?.pagination?.total ?? 0;
  const nearExpiryTotal =
    reportsSummary.expiryBreakdown.next30Days ??
    expiryQuery.data?.pagination?.total ??
    0;

  const salesTrendPoints: TrendPoint[] =
    salesTrend.map((item) => ({
      label: toPeriodLabel(item.periodStart),
      value: parseMoney(item.totalSales),
    })) ?? [];
  const adminSalesTrendPoints: TrendPoint[] =
    adminSalesOverviewTrend.map((item) => ({
      label: toPeriodLabel(item.periodStart),
      value: parseMoney(item.totalSales),
    })) ?? [];
  const profitTrendPoints: TrendPoint[] =
    profitMonthTrend.map((item) => ({
      label: toPeriodLabel(item.periodStart),
      value: parseMoney(item.profit),
    })) ?? [];

  const strongestSalesDay =
    salesTrend.length
      ? salesTrend.reduce((current, item) =>
          parseMoney(item.totalSales) > parseMoney(current.totalSales)
            ? item
            : current,
        )
      : null;
  const strongestProfitDay =
    profitMonthTrend.length
      ? profitMonthTrend.reduce((current, item) =>
          parseMoney(item.profit) > parseMoney(current.profit)
            ? item
            : current,
        )
      : null;

  const topMetrics = [
    canViewReports
      ? {
          label: "Today sales",
          value: formatCurrency(reportsSummary.todaySales.totalSales),
          hint: describeDelta(reportsSummary.todaySales.totalBills, "bill"),
          to: "/app/reports/sales",
          tone: "accent" as const,
        }
      : null,
    canViewReports
      ? {
          label: "Monthly sales",
          value: formatCurrency(reportsSummary.monthlySales.totalSales),
          hint: describeDelta(reportsSummary.monthlySales.totalBills, "bill"),
          to: "/app/reports/sales",
          tone: "default" as const,
        }
      : null,
    canViewReports
      ? {
          label: "Today profit",
          value: formatCurrency(profitTodaySummary.profit),
          hint: "Completed sales for today",
          to: "/app/reports/profit",
          tone: "accent" as const,
        }
      : null,
    canViewReports
      ? {
          label: "Monthly profit",
          value: formatCurrency(profitMonthSummary.profit || reportsSummary.totalProfit),
          hint: `${formatNumber(parseMoney(profitMonthSummary.profitPercent))}% margin`,
          to: "/app/reports/profit",
          tone: "default" as const,
        }
      : null,
    canViewInventory
      ? {
          label: "Low stock count",
          value: formatNumber(lowStockTotal),
          hint: "Medicines at or below reorder level",
          to: "/app/inventory/low-stock",
          tone: lowStockTotal > 0 ? ("warning" as const) : ("default" as const),
        }
      : null,
    canViewInventory
      ? {
          label: "Near expiry count",
          value: formatNumber(nearExpiryTotal),
          hint: "Batches expiring within 30 days",
          to: "/app/inventory/expiry",
          tone: nearExpiryTotal > 0 ? ("danger" as const) : ("default" as const),
        }
      : null,
    canViewPayments
      ? {
          label: "Customer due amount",
          value: formatCurrency(customerDueSummary.totalOutstandingAmount),
          hint: describeDelta(customerDueSummary.entityCount, "customer"),
          to: "/app/accounting/customers",
          tone:
            customerDueSummary.entityCount > 0
              ? ("warning" as const)
              : ("default" as const),
        }
      : null,
    canViewPayments
      ? {
          label: "Supplier payable amount",
          value: formatCurrency(supplierPayableSummary.totalOutstandingAmount),
          hint: describeDelta(supplierPayableSummary.entityCount, "supplier"),
          to: "/app/accounting/suppliers",
          tone:
            supplierPayableSummary.entityCount > 0
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
          metric: `${formatNumber(lowStockTotal)} items`,
          tone: lowStockTotal > 0 ? ("warning" as const) : ("default" as const),
        }
      : null,
    canViewInventory
      ? {
          title: "Near expiry review",
          description: "See batches that need disposal, transfer, or sales push planning.",
          to: "/app/inventory/expiry",
          metric: `${formatNumber(nearExpiryTotal)} batches`,
          tone: nearExpiryTotal > 0 ? ("danger" as const) : ("default" as const),
        }
      : null,
    canViewPayments
      ? {
          title: "Receivables queue",
          description: "Review overdue customers, open bills, and collection priority.",
          to: "/app/accounting/customers",
          metric: formatCurrency(customerDueSummary.totalOutstandingAmount),
          tone: "warning" as const,
        }
      : null,
    canViewPayments
      ? {
          title: "Payables queue",
          description: "Monitor supplier balances and recent settlement pressure.",
          to: "/app/accounting/suppliers",
          metric: formatCurrency(supplierPayableSummary.totalOutstandingAmount),
          tone: "default" as const,
        }
      : null,
    canViewReports
      ? {
          title: "Sales reports",
          description: "Drill into completed bills, value trends, and performance snapshots.",
          to: "/app/reports/sales",
          metric: formatCurrency(reportsSummary.monthlySales.totalSales),
          tone: "accent" as const,
        }
      : null,
    {
      title: "Notification center",
      description: "Review unread alerts, critical warnings, and system follow-up items.",
      to: "/app/notifications",
      metric: `${formatNumber(notificationsSummary.unreadCount)} unread`,
      tone: notificationsSummary.criticalCount > 0 ? ("danger" as const) : ("default" as const),
    },
  ].filter(isPresent);

  const activityItems: DashboardActivityItem[] = [
    ...(billsQuery.data?.items ?? []).map((item: BillListItem) => ({
      id: `bill-${item.id}`,
      label: "completed",
      tone: item.paymentStatus,
      title: item.billNumber,
      description: `${item.customerLabel} • ${item.paymentMethod}`,
      amount: formatCurrency(item.grandTotal),
      occurredAt: item.completedAt ?? item.createdAt,
      to: `/app/billing/${item.id}`,
    })),
    ...(salesReturnsQuery.data?.items ?? []).map((item: SalesReturnListItem) => ({
      id: `sales-return-${item.id}`,
      label: "sale_return",
      title: item.returnNumber,
      description: `${item.customerLabel} • ${item.billNumber}`,
      amount: formatCurrency(item.totalReturnAmount),
      occurredAt: item.completedAt ?? item.createdAt,
      to: `/app/billing/returns/${item.id}`,
    })),
    ...(purchaseReturnsQuery.data?.items ?? []).map((item: PurchaseReturnListItem) => ({
      id: `purchase-return-${item.id}`,
      label: "purchase_return",
      title: item.returnNumber,
      description: `${item.supplierName} • ${item.purchaseNumber}`,
      amount: formatCurrency(item.totalReturnAmount),
      occurredAt: item.completedAt ?? item.createdAt,
      to: `/app/purchase-returns/${item.id}`,
    })),
    ...(customerPaymentsQuery.data?.items ?? []).map((item: AccountingCustomerPayment) => ({
      id: `customer-payment-${item.id}`,
      label: "payment_received",
      title: item.customer.fullName,
      description: `${item.paymentMethod} payment${item.linkedSale ? ` • ${item.linkedSale.billNumber}` : ""}`,
      amount: formatCurrency(item.amount),
      occurredAt: item.paymentDate,
      to: `/app/accounting/customers/${item.customer.id}`,
    })),
    ...(supplierPaymentsQuery.data?.items ?? []).map((item: AccountingSupplierPayment) => ({
      id: `supplier-payment-${item.id}`,
      label: "payment_made",
      title: item.supplier.supplierName,
      description: `${item.paymentMethod} payment${item.linkedPurchase ? ` • ${item.linkedPurchase.purchaseNumber}` : ""}`,
      amount: formatCurrency(item.amount),
      occurredAt: item.paymentDate,
      to: `/app/accounting/suppliers/${item.supplier.id}`,
    })),
    ...(stockTransactionsQuery.data?.items ?? []).map((item: StockTransactionListItem) => ({
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

  const recentBillItems: DashboardActivityItem[] = (billsQuery.data?.items ?? []).map(
    (item: BillListItem) => ({
      id: `recent-bill-${item.id}`,
      label: item.status,
      tone: item.paymentStatus,
      title: item.billNumber,
      description: `${item.customerLabel} • ${item.paymentMethod}`,
      amount: formatCurrency(item.grandTotal),
      occurredAt: item.completedAt ?? item.createdAt,
      to: `/app/billing/${item.id}`,
    }),
  );

  const recentCustomerPaymentItems: DashboardActivityItem[] = (
    customerPaymentsQuery.data?.items ?? []
  ).map((item: AccountingCustomerPayment) => ({
    id: `recent-customer-payment-${item.id}`,
    label: "payment_received",
    title: item.customer.fullName,
    description: `${item.paymentMethod} payment${item.linkedSale ? ` • ${item.linkedSale.billNumber}` : ""}`,
    amount: formatCurrency(item.amount),
    occurredAt: item.paymentDate,
    to: `/app/accounting/customers/${item.customer.id}`,
  }));

  const recentSupplierPaymentItems: DashboardActivityItem[] = (
    supplierPaymentsQuery.data?.items ?? []
  ).map((item: AccountingSupplierPayment) => ({
    id: `recent-supplier-payment-${item.id}`,
    label: "payment_made",
    title: item.supplier.supplierName,
    description: `${item.paymentMethod} payment${item.linkedPurchase ? ` • ${item.linkedPurchase.purchaseNumber}` : ""}`,
    amount: formatCurrency(item.amount),
    occurredAt: item.paymentDate,
    to: `/app/accounting/suppliers/${item.supplier.id}`,
  }));

  const todaySalesAmount = canViewReports
    ? reportsSummary.todaySales.totalSales
    : todayBillsQuery.data?.summary.grandTotal ?? "0.00";
  const todayBillsCount = canViewReports
    ? reportsSummary.todaySales.totalBills
    : todayBillsQuery.data?.summary.totalBills ?? 0;
  const heldBillsCount = heldBillsQuery.data?.pagination.total ?? 0;
  const todayCollectionsAmount = todayCustomerPaymentsQuery.data?.summary.totalAmount ?? "0.00";
  const todayCollectionsCount =
    todayCustomerPaymentsQuery.data?.summary.totalPayments ?? 0;
  const todaySupplierPaymentsAmount =
    todaySupplierPaymentsQuery.data?.summary.totalAmount ?? "0.00";
  const todaySupplierPaymentsCount =
    todaySupplierPaymentsQuery.data?.summary.totalPayments ?? 0;
  const todayCustomerCount = (recentCustomersQuery.data?.items ?? []).filter(
    (item) => toDateParam(new Date(item.createdAt)) === todayParam,
  ).length;
  const yesterdayDate = new Date(todayStart);
  yesterdayDate.setDate(todayStart.getDate() - 1);
  const yesterdayParam = toDateParam(yesterdayDate);
  const yesterdayCustomerCount = (recentCustomersQuery.data?.items ?? []).filter(
    (item) => toDateParam(new Date(item.createdAt)) === yesterdayParam,
  ).length;

  const orderedSalesTrend = [...salesTrend].sort(
    (left, right) =>
      new Date(left.periodStart).getTime() - new Date(right.periodStart).getTime(),
  );
  const orderedProfitTrend = [...profitMonthTrend].sort(
    (left, right) =>
      new Date(left.periodStart).getTime() - new Date(right.periodStart).getTime(),
  );
  const latestSalesTrend = orderedSalesTrend.at(-1);
  const previousSalesTrend = orderedSalesTrend.at(-2);
  const latestProfitTrend = orderedProfitTrend.at(-1);
  const previousProfitTrend = orderedProfitTrend.at(-2);
  const totalInventoryItems = stockOverviewQuery.data?.summary.totalMedicines ?? 0;
  const inventoryNearExpiry = nearExpiryTotal;
  const inventoryLowStock = lowStockTotal;
  const inventoryOutOfStock = Math.max(
    totalInventoryItems - Math.max(totalInventoryItems - inventoryLowStock - inventoryNearExpiry, 0) - inventoryLowStock - inventoryNearExpiry,
    0,
  );
  const inventoryInStock = Math.max(
    totalInventoryItems - inventoryLowStock - inventoryNearExpiry - inventoryOutOfStock,
    0,
  );
  const inventoryLegend = [
    { label: "In Stock", value: inventoryInStock, color: "#4ade80" },
    { label: "Low Stock", value: inventoryLowStock, color: "#fbbf24" },
    { label: "Near Expiry", value: inventoryNearExpiry, color: "#fb7185" },
    { label: "Out of Stock", value: inventoryOutOfStock, color: "#cbd5e1" },
  ];
  const inventoryLegendTotal = inventoryLegend.reduce((sum, item) => sum + item.value, 0);
  const inventoryChartStops = inventoryLegend.reduce<string[]>((stops, item, index) => {
    const before = inventoryLegend
      .slice(0, index)
      .reduce((sum, entry) => sum + entry.value, 0);
    const start = inventoryLegendTotal > 0 ? (before / inventoryLegendTotal) * 100 : 0;
    const end =
      inventoryLegendTotal > 0
        ? ((before + item.value) / inventoryLegendTotal) * 100
        : start;

    if (start === end) {
      return stops;
    }

    return [...stops, `${item.color} ${start}% ${end}%`];
  }, []);

  const topSellingMedicines = Object.values(
    (stockTransactionsQuery.data?.items ?? []).reduce<
      Record<
        string,
        {
          medicineId: string;
          medicineName: string;
          quantity: number;
        }
      >
    >((accumulator, item) => {
      if (item.transactionType !== "sale_out" || item.quantityOut <= 0) {
        return accumulator;
      }

      const current = accumulator[item.medicine.id] ?? {
        medicineId: item.medicine.id,
        medicineName: item.medicine.medicineName,
        quantity: 0,
      };

      current.quantity += item.quantityOut;
      accumulator[item.medicine.id] = current;

      return accumulator;
    }, {}),
  )
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 5);

  const adminStatCards = [
    canViewReports
      ? {
          label: "Today's Sales",
          value: formatCurrency(todaySalesAmount),
          change: formatChange(
            parseMoney(latestSalesTrend?.totalSales ?? todaySalesAmount),
            parseMoney(previousSalesTrend?.totalSales ?? 0),
          ),
          changeTone: "positive" as const,
          note: "vs yesterday",
          icon: <BadgeIndianRupee className="h-6 w-6" />,
          iconClassName: "bg-violet-50 text-violet-600",
        }
      : null,
    canViewReports
      ? {
          label: "Today's Profit",
          value: formatCurrency(profitTodaySummary.profit),
          change: formatChange(
            parseMoney(latestProfitTrend?.profit ?? profitTodaySummary.profit),
            parseMoney(previousProfitTrend?.profit ?? 0),
          ),
          changeTone: "positive" as const,
          note: "vs yesterday",
          icon: <Sparkles className="h-6 w-6" />,
          iconClassName: "bg-emerald-50 text-emerald-600",
        }
      : null,
    canViewBilling
      ? {
          label: "Invoices Created",
          value: formatNumber(todayBillsCount),
          change: formatChange(
            todayBillsCount,
            previousSalesTrend?.totalBills ?? 0,
          ),
          changeTone: "positive" as const,
          note: "vs yesterday",
          icon: <FilePlus2 className="h-6 w-6" />,
          iconClassName: "bg-sky-50 text-sky-600",
        }
      : null,
    canViewCustomers
      ? {
          label: "New Customers",
          value: formatNumber(todayCustomerCount),
          change: formatChange(todayCustomerCount, yesterdayCustomerCount),
          changeTone: "positive" as const,
          note: "vs yesterday",
          icon: <UserPlus className="h-6 w-6" />,
          iconClassName: "bg-amber-50 text-amber-500",
        }
      : null,
  ].filter(isPresent);

  const dashboardShortcuts = [
    canCreateBills
      ? {
          label: "New Sale",
          to: "/app/billing",
          icon: <ShoppingCart className="h-6 w-6" />,
          tileClassName: "bg-emerald-50 text-emerald-600",
        }
      : null,
    canViewCustomers
      ? {
          label: "Add Customer",
          to: "/app/customers",
          icon: <UserPlus className="h-6 w-6" />,
          tileClassName: "bg-violet-50 text-violet-600",
        }
      : null,
    canViewInventory
      ? {
          label: "New Purchase",
          to: "/app/purchases",
          icon: <PackagePlus className="h-6 w-6" />,
          tileClassName: "bg-sky-50 text-sky-600",
        }
      : null,
    canViewInventory
      ? {
          label: "Stock Transfer",
          to: "/app/inventory/transfers",
          icon: <ArrowRight className="h-6 w-6" />,
          tileClassName: "bg-amber-50 text-amber-500",
        }
      : null,
    canViewReports
      ? {
          label: "Sales Report",
          to: "/app/reports/sales",
          icon: <BarChart3 className="h-6 w-6" />,
          tileClassName: "bg-rose-50 text-rose-500",
        }
      : null,
    canViewInventory
      ? {
          label: "Expiry Report",
          to: "/app/inventory/expiry",
          icon: <Clock3 className="h-6 w-6" />,
          tileClassName: "bg-indigo-50 text-indigo-500",
        }
      : null,
  ].filter(isPresent);

  const staffTopMetrics = [
    canViewBilling
      ? {
          label: "Today bills",
          value: formatNumber(todayBillsCount),
          hint: "Completed bills processed today",
          to: "/app/billing/history",
          tone: "accent" as const,
        }
      : null,
    canViewBilling
      ? {
          label: "Today sales",
          value: formatCurrency(todaySalesAmount),
          hint: "Completed billing value for today",
          to: "/app/billing/history",
          tone: "default" as const,
        }
      : null,
    canViewBilling
      ? {
          label: "Held bills",
          value: formatNumber(heldBillsCount),
          hint: "Bills waiting to be reopened",
          to: "/app/billing/held",
          tone: heldBillsCount > 0 ? ("warning" as const) : ("default" as const),
        }
      : null,
    canViewInventory
      ? {
          label: "Low stock alerts",
          value: formatNumber(lowStockTotal),
          hint: "Medicines at reorder level",
          to: "/app/inventory/low-stock",
          tone: lowStockTotal > 0 ? ("warning" as const) : ("default" as const),
        }
      : null,
    canViewInventory
      ? {
          label: "Near expiry alerts",
          value: formatNumber(nearExpiryTotal),
          hint: "Batches expiring in 30 days",
          to: "/app/inventory/expiry",
          tone: nearExpiryTotal > 0 ? ("danger" as const) : ("default" as const),
        }
      : null,
  ].filter(isPresent);

  const staffQuickLinks = [
    canCreateBills
      ? {
          title: "Start billing",
          description: "Open POS and create a fresh bill without leaving the dashboard.",
          to: "/app/billing",
          metric: `${formatNumber(todayBillsCount)} bills today`,
          tone: "accent" as const,
        }
      : null,
    canViewBilling
      ? {
          title: "Held bills",
          description: "Resume paused bills and complete customer checkout faster.",
          to: "/app/billing/held",
          metric: `${formatNumber(heldBillsCount)} pending`,
          tone: heldBillsCount > 0 ? ("warning" as const) : ("default" as const),
        }
      : null,
    canViewBilling
      ? {
          title: "Billing history",
          description: "Review completed bills and reopen recent customer details when needed.",
          to: "/app/billing/history",
          metric: formatCurrency(todaySalesAmount),
          tone: "default" as const,
        }
      : null,
    canViewInventory
      ? {
          title: "Low stock queue",
          description: "See medicines that need restock attention before they run out.",
          to: "/app/inventory/low-stock",
          metric: `${formatNumber(lowStockTotal)} items`,
          tone: lowStockTotal > 0 ? ("warning" as const) : ("default" as const),
        }
      : null,
    canViewInventory
      ? {
          title: "Expiry report",
          description: "Monitor batches nearing expiry so day-to-day sales stay safe.",
          to: "/app/inventory/expiry",
          metric: `${formatNumber(nearExpiryTotal)} batches`,
          tone: nearExpiryTotal > 0 ? ("danger" as const) : ("default" as const),
        }
      : null,
  ].filter(isPresent);

  const accountantTopMetrics = [
    canViewPayments
      ? {
          label: "Customer outstanding",
          value: formatCurrency(customerDueSummary.totalOutstandingAmount),
          hint: "Open receivables across customers",
          to: "/app/accounting/customers",
          tone:
            customerDueSummary.entityCount > 0
              ? ("warning" as const)
              : ("default" as const),
        }
      : null,
    canViewPayments
      ? {
          label: "Supplier payable",
          value: formatCurrency(supplierPayableSummary.totalOutstandingAmount),
          hint: "Open payables across suppliers",
          to: "/app/accounting/suppliers",
          tone:
            supplierPayableSummary.entityCount > 0
              ? ("warning" as const)
              : ("default" as const),
        }
      : null,
    canViewPayments
      ? {
          label: "Today collections",
          value: formatCurrency(todayCollectionsAmount),
          hint: `${formatNumber(todayCollectionsCount)} received today`,
          to: "/app/accounting/customers",
          tone: "accent" as const,
        }
      : null,
    canViewPayments
      ? {
          label: "Today supplier payments",
          value: formatCurrency(todaySupplierPaymentsAmount),
          hint: `${formatNumber(todaySupplierPaymentsCount)} settlements today`,
          to: "/app/accounting/suppliers",
          tone: "default" as const,
        }
      : null,
    canViewPayments
      ? {
          label: "Due customers",
          value: formatNumber(customerDueSummary.entityCount),
          hint: `${formatNumber(customerDueSummary.openBillCount)} open bills`,
          to: "/app/accounting/customers",
          tone:
            customerDueSummary.entityCount > 0
              ? ("warning" as const)
              : ("default" as const),
        }
      : null,
    canViewPayments
      ? {
          label: "Payable suppliers",
          value: formatNumber(supplierPayableSummary.entityCount),
          hint: `${formatNumber(supplierPayableSummary.openPurchaseCount)} open purchases`,
          to: "/app/accounting/suppliers",
          tone:
            supplierPayableSummary.entityCount > 0
              ? ("warning" as const)
              : ("default" as const),
        }
      : null,
  ].filter(isPresent);

  const accountantQuickLinks = [
    canCreatePayments
      ? {
          title: "Customer collections",
          description: "Open receivables and record incoming customer payments quickly.",
          to: "/app/accounting/customers",
          metric: formatCurrency(customerDueSummary.totalOutstandingAmount),
          tone: "accent" as const,
        }
      : null,
    canCreatePayments
      ? {
          title: "Supplier settlements",
          description: "Review outstanding supplier balances and record payment entries.",
          to: "/app/accounting/suppliers",
          metric: formatCurrency(supplierPayableSummary.totalOutstandingAmount),
          tone: "default" as const,
        }
      : null,
    canViewPayments
      ? {
          title: "Customer ledger follow-up",
          description: "Check customer balances, open bills, and latest payment movement.",
          to: "/app/accounting/customers",
          metric: `${formatNumber(customerDueSummary.entityCount)} customers`,
          tone: customerDueSummary.entityCount > 0 ? ("warning" as const) : ("default" as const),
        }
      : null,
    canViewPayments
      ? {
          title: "Supplier ledger follow-up",
          description: "Monitor payable suppliers, open purchases, and last settlement activity.",
          to: "/app/accounting/suppliers",
          metric: `${formatNumber(supplierPayableSummary.entityCount)} suppliers`,
          tone:
            supplierPayableSummary.entityCount > 0
              ? ("warning" as const)
              : ("default" as const),
        }
      : null,
  ].filter(isPresent);

  const staffVisibleSections =
    staffTopMetrics.length ||
    staffQuickLinks.length ||
    recentBillItems.length ||
    canViewInventory;

  const accountantVisibleSections =
    accountantTopMetrics.length ||
    accountantQuickLinks.length ||
    recentCustomerPaymentItems.length ||
    recentSupplierPaymentItems.length ||
    canViewPayments;

  const visibleSections =
    topMetrics.length ||
    quickLinks.length ||
    canViewReports ||
    canViewInventory ||
    canViewPayments ||
    alerts.length ||
    activityItems.length;

  if (!session || !shop || !user) {
    return null;
  }

  if (user.role === "staff") {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Dashboard"
          title="Staff dashboard"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={user.role} tone={user.role} />
              {lowStockTotal > 0 || nearExpiryTotal > 0 || heldBillsCount > 0 ? (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                  Action queue active
                </span>
              ) : null}
            </div>
          }
        />

        {!staffVisibleSections ? (
          <EmptyState
            title="No dashboard modules available"
            description="Your current role does not have any dashboard-enabled modules yet."
          />
        ) : null}

        {staffTopMetrics.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {staffTopMetrics.map((item) => (
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

        {staffQuickLinks.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {staffQuickLinks.map((item) => (
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

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          {canViewBilling ? (
            <SectionCard
              title="Recent bills"
              action={
                <Link
                  className="ui-btn ui-btn--secondary !min-h-[2.4rem] !px-3.5 !py-2"
                  to="/app/billing/history"
                >
                  Open billing history
                </Link>
              }
            >
              {billsQuery.error ? (
                renderSectionError("Recent billing activity is not available right now.")
              ) : (
                <ActivityList items={recentBillItems} />
              )}
            </SectionCard>
          ) : null}

          {canViewInventory ? (
            <SectionCard
              title="Stock attention"
              contentClassName="overflow-y-auto pr-1.5 custom-scrollbar"
              action={
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="ui-btn ui-btn--secondary !min-h-[2.4rem] !px-3 !py-2"
                    to="/app/inventory/low-stock"
                  >
                    Low stock
                  </Link>
                  <Link
                    className="ui-btn ui-btn--secondary !min-h-[2.4rem] !px-3 !py-2"
                    to="/app/inventory/expiry"
                  >
                    Expiry report
                  </Link>
                </div>
              }
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="ui-feed-list lg:!max-h-[25rem]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Low stock
                  </p>
                  {lowStockQuery.error ? (
                    renderSectionError("Low stock medicines could not be loaded.")
                  ) : (lowStockQuery.data?.items ?? []).length ? (
                    lowStockQuery.data!.items.map((item) => (
                      <Link
                        className="block rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.28)] transition hover:border-slate-300 hover:bg-white"
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

                <div className="ui-feed-list lg:!max-h-[25rem]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Near expiry
                  </p>
                  {expiryQuery.error ? (
                    renderSectionError("Near-expiry batches could not be loaded.")
                  ) : (expiryQuery.data?.items ?? []).length ? (
                    expiryQuery.data!.items.map((item) => {
                      const daysUntilExpiry = getDaysUntil(item.expiryDate);

                      return (
                        <Link
                          className="block rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.28)] transition hover:border-slate-300 hover:bg-white"
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
                              ? ` • ${
                                  daysUntilExpiry <= 0
                                    ? "expired"
                                    : `${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"} left`
                                }`
                              : ""}
                          </p>
                        </Link>
                      );
                    })
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      No near-expiry batches are visible right now.
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>
    );
  }

  if (user.role === "accountant") {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Dashboard"
          title="Accountant dashboard"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={user.role} tone={user.role} />
              {customerDueSummary.entityCount > 0 || supplierPayableSummary.entityCount > 0 ? (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                  Follow-up pending
                </span>
              ) : null}
            </div>
          }
        />

        {!accountantVisibleSections ? (
          <EmptyState
            title="No dashboard modules available"
            description="Your current role does not have any dashboard-enabled modules yet."
          />
        ) : null}

        {accountantTopMetrics.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accountantTopMetrics.map((item) => (
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

        {accountantQuickLinks.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {accountantQuickLinks.map((item) => (
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

        <div className="grid gap-5 xl:grid-cols-2">
          {canViewPayments ? (
            <SectionCard title="Recent customer payments">
              {customerPaymentsQuery.error ? (
                renderSectionError("Recent customer payments are not available right now.")
              ) : (
                <ActivityList items={recentCustomerPaymentItems} />
              )}
            </SectionCard>
          ) : null}

          {canViewPayments ? (
            <SectionCard title="Recent supplier payments">
              {supplierPaymentsQuery.error ? (
                renderSectionError("Recent supplier payments are not available right now.")
              ) : (
                <ActivityList items={recentSupplierPaymentItems} />
              )}
            </SectionCard>
          ) : null}
        </div>

        {canViewPayments ? (
          <SectionCard title="Pending follow-up">
            {customerDueQuery.error || supplierPayableQuery.error ? (
              renderSectionError("Outstanding follow-up lists are not available right now.")
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="ui-feed-list lg:!max-h-[25rem]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Customer dues
                    </p>
                    <Link className="ui-link-inline" to="/app/accounting/customers">
                      View all
                    </Link>
                  </div>
                  {(customerDueQuery.data?.items ?? []).length ? (
                    customerDueQuery.data!.items.map((item) => (
                      <Link
                        className="block rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.28)] transition hover:border-slate-300 hover:bg-white"
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

                <div className="ui-feed-list lg:!max-h-[25rem]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Supplier payables
                    </p>
                    <Link className="ui-link-inline" to="/app/accounting/suppliers">
                      View all
                    </Link>
                  </div>
                  {(supplierPayableQuery.data?.items ?? []).length ? (
                    supplierPayableQuery.data!.items.map((item) => (
                      <Link
                        className="block rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.28)] transition hover:border-slate-300 hover:bg-white"
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
      </div>
    );
  }

  if (user.role === "admin") {
    const topMedicineMax = topSellingMedicines[0]?.quantity ?? 1;

    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-4 rounded-[30px] border border-white/75 bg-[radial-gradient(circle_at_top_left,rgba(109,61,245,0.1),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,255,0.95))] px-5 py-4 shadow-[0_28px_72px_-48px_rgba(15,23,42,0.24)] lg:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-[2rem] font-semibold tracking-tight text-slate-950">
                {shop.name}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge label={user.role} tone={user.role} />
              <Link
                className="ui-btn ui-btn--primary !min-h-[2.8rem] !rounded-[18px] !px-4"
                to={canCreateBills ? "/app/billing" : "/app/reports"}
              >
                <Sparkles className="h-4 w-4" />
                Quick actions
                <ChevronDown className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {!visibleSections ? (
          <EmptyState
            title="No dashboard modules available"
            description="Your current role does not have any dashboard-enabled modules yet."
          />
        ) : null}

        {adminStatCards.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {adminStatCards.map((card) => (
              <article
                className="rounded-[22px] border border-white/80 bg-[radial-gradient(circle_at_top_left,rgba(109,61,245,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,255,0.94))] px-4 py-3.5 shadow-[0_24px_56px_-42px_rgba(15,23,42,0.22)]"
                key={card.label}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.95rem] font-medium text-slate-500">{card.label}</p>
                    <p className="mt-1.5 text-[1.75rem] font-semibold tracking-tight text-slate-950">
                      {card.value}
                    </p>
                  </div>
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-[16px] ${card.iconClassName}`}
                  >
                    {card.icon}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2 text-[13px]">
                  <span
                    className={cn(
                      "font-semibold",
                      card.changeTone === "positive" ? "text-emerald-600" : "text-rose-500",
                    )}
                  >
                    {card.change}
                  </span>
                  <span className="text-slate-500">{card.note}</span>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
          <section className="flex flex-col overflow-hidden rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,255,0.95))] p-5 shadow-[0_28px_60px_-46px_rgba(15,23,42,0.24)] xl:h-[28rem]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[1.4rem] font-semibold tracking-tight text-slate-950">
                  Sales Overview
                </h2>
                <p className="mt-1 text-sm text-slate-500">Total Sales</p>
                <p className="mt-2 text-[2rem] font-semibold tracking-tight text-slate-950">
                  {formatCurrency(adminSalesOverviewSummary.totalSales)}
                </p>
              </div>
              <div className="relative shrink-0">
                <select
                  aria-label="Select sales overview period"
                  className="ui-input min-w-[9.75rem] appearance-none !rounded-[14px] !py-2.5 !pl-3.5 !pr-10 text-sm font-semibold text-slate-700"
                  onChange={(event) =>
                    setAdminSalesPeriod(event.target.value as SalesOverviewPeriod)
                  }
                  value={adminSalesPeriod}
                >
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            {adminSalesOverviewQuery.error ? (
              <div className="flex-1 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                {adminSalesOverviewQuery.error.message}
              </div>
            ) : (
              <div className="min-h-0 flex-1">
                <TrendChart
                  emptyLabel={`No sales data available for ${salesOverviewPeriodConfig[adminSalesPeriod].label.toLowerCase()}.`}
                  points={adminSalesTrendPoints}
                />
              </div>
            )}
          </section>

          <section className="self-start overflow-hidden rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,255,0.95))] p-5 shadow-[0_28px_60px_-46px_rgba(15,23,42,0.24)] xl:h-[28rem]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[1.4rem] font-semibold tracking-tight text-slate-950">
                  Inventory Health
                </h2>
              </div>
              <Link
                className="ui-btn ui-btn--secondary !min-h-[2.2rem] !rounded-[14px] !px-3"
                to="/app/inventory"
              >
                View all
              </Link>
            </div>

            {stockOverviewQuery.error ? (
              <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                {stockOverviewQuery.error.message}
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-center">
                <div className="mx-auto flex flex-col items-center justify-center">
                  <div
                    className="relative h-[190px] w-[190px] rounded-full"
                    style={{
                      background: `conic-gradient(${inventoryChartStops.length ? inventoryChartStops.join(", ") : "#e2e8f0 0% 100%"})`,
                    }}
                  >
                    <div className="absolute inset-[28px] flex flex-col items-center justify-center rounded-full bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                      <p className="text-[2rem] font-semibold tracking-tight text-slate-950">
                        {formatNumber(totalInventoryItems)}
                      </p>
                      <p className="text-sm text-slate-500">Total Items</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  {inventoryLegend.map((item) => (
                    <div className="flex items-center justify-between gap-3" key={item.label}>
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3.5 w-3.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-base font-medium text-slate-700">
                          {item.label}
                        </span>
                      </div>
                      <span className="text-base font-semibold text-slate-950">
                        {formatNumber(item.value)}{" "}
                        <span className="text-slate-500">
                          ({inventoryLegendTotal > 0 ? Math.round((item.value / inventoryLegendTotal) * 100) : 0}%)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.08fr_1fr_0.96fr]">
          <section className="rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,255,0.95))] p-5 shadow-[0_28px_60px_-46px_rgba(15,23,42,0.24)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[1.35rem] font-semibold tracking-tight text-slate-950">
                  Alerts & Notifications
                </h2>
              </div>
              <Link
                className="ui-btn ui-btn--secondary !min-h-[2.2rem] !rounded-[14px] !px-3"
                to="/app/notifications"
              >
                View all
              </Link>
            </div>

            {notificationsSummaryQuery.error ? (
              <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                {notificationsSummaryQuery.error.message}
              </div>
            ) : alerts.length ? (
              <div className="ui-subtle-scrollbar grid max-h-[20.75rem] gap-[0.65rem] overflow-y-auto pr-1.5">
                {alerts.map((item) => (
                  <Link
                    className={cn(
                      "block rounded-[20px] border px-3.5 py-3 transition hover:-translate-y-0.5",
                      item.severity === "critical"
                        ? "border-rose-200 bg-rose-50/60"
                        : item.severity === "warning"
                          ? "border-amber-200 bg-amber-50/60"
                          : "border-sky-200 bg-sky-50/50",
                    )}
                    key={item.id}
                    to={item.actionPath ?? "/app/notifications"}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div
                          className={cn(
                            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]",
                            item.severity === "critical"
                              ? "bg-rose-100 text-rose-500"
                              : item.severity === "warning"
                                ? "bg-amber-100 text-amber-500"
                                : "bg-sky-100 text-sky-500",
                          )}
                        >
                          {item.severity === "critical" ? (
                            <TriangleAlert className="h-5 w-5" />
                          ) : item.severity === "warning" ? (
                            <PillBottle className="h-5 w-5" />
                          ) : (
                            <ClipboardPlus className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-950">
                              {item.title}
                            </p>
                            <span className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] font-medium text-slate-500">
                              {formatDateTime(item.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-600">
                            {item.message}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <StatusBadge label={item.type} tone={item.type} />
                            <StatusBadge label={item.severity} tone={item.severity} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="All caught up!"
                description="You're all set. New alerts will appear here."
              />
            )}
          </section>

          <section className="rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,255,0.95))] p-5 shadow-[0_28px_60px_-46px_rgba(15,23,42,0.24)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[1.35rem] font-semibold tracking-tight text-slate-950">
                  Top Selling Medicines
                </h2>
              </div>
              <Link
                className="ui-btn ui-btn--secondary !min-h-[2.2rem] !rounded-[14px] !px-3"
                to="/app/reports/sales"
              >
                This Month
                <ChevronDown className="h-4 w-4" />
              </Link>
            </div>

            {topSellingMedicines.length ? (
              <div className="space-y-5">
                {topSellingMedicines.map((item) => (
                  <Link
                    className="block"
                    key={item.medicineId}
                    to={`/app/inventory/${item.medicineId}`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-base font-semibold text-slate-900">
                        {item.medicineName}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatNumber(item.quantity)} strips
                      </p>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-[linear-gradient(90deg,#8b5cf6_0%,#c4b5fd_100%)]"
                        style={{
                          width: `${Math.max((item.quantity / topMedicineMax) * 100, 8)}%`,
                        }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No medicine trend yet"
                description="Recent sale-out stock movements will appear here once billing activity is available."
              />
            )}
          </section>

          <section className="rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,255,0.95))] p-5 shadow-[0_28px_60px_-46px_rgba(15,23,42,0.24)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[1.35rem] font-semibold tracking-tight text-slate-950">
                  Quick Shortcuts
                </h2>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-slate-50 text-slate-500">
                <LayoutGrid className="h-5 w-5" />
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {dashboardShortcuts.map((shortcut) => (
                <Link
                  className="rounded-[22px] border border-slate-100 bg-white/92 p-4 text-center shadow-[0_20px_44px_-40px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:border-slate-200"
                  key={shortcut.label}
                  to={shortcut.to}
                >
                  <div
                    className={`mx-auto flex h-16 w-16 items-center justify-center rounded-[18px] ${shortcut.tileClassName}`}
                  >
                    {shortcut.icon}
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-900">
                    {shortcut.label}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-3 rounded-[24px] border border-white/70 bg-white/80 px-5 py-4 text-sm text-slate-500 shadow-[0_18px_44px_-40px_rgba(15,23,42,0.18)] md:flex-row md:items-center md:justify-between">
          <p>© 2026 {shop.name}. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span>Version 1.0.0</span>
            <span className="inline-flex items-center gap-2">
              <HandCoins className="h-4 w-4" />
              Need help?
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Dashboard"
        title={`${shop.name} operations`}
        description="Review sales, profit, inventory risk, dues, alerts, and recent activity from one compact operational dashboard."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={user.role} tone={user.role} />
            {reportsSummary.lowStockCount || reportsSummary.expiryBreakdown.expired ? (
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
            className="w-full"
            description="Daily sales movement for the last 7 days, with compact month-to-date context for quick review."
            action={
              <Link
                className="ui-btn ui-btn--secondary !min-h-[2.4rem] !px-3.5 !py-2"
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
                      {formatCurrency(salesInsightsSummary.totalSales)}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-600">
                      {describeDelta(salesInsightsSummary.totalBills, "completed bill")}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Average bill value
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {formatCurrency(salesInsightsSummary.averageBillValue)}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-600">
                      Month-to-date sales at {formatCurrency(reportsSummary.monthlySales.totalSales)}
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

        <div className={cn("w-full", canViewReports ? "h-[32rem] xl:h-full xl:min-h-[24rem] relative" : "")}>
          <SectionCard
            title="Alerts & notifications"
            className={cn(canViewReports ? "xl:absolute xl:inset-0 xl:h-full" : "")}
            contentClassName="overflow-y-auto pr-1.5 custom-scrollbar"
          description="Unread alerts stay visible so stock, expiry, and financial exceptions do not get buried."
          action={
            <Link
              className="ui-btn ui-btn--secondary !min-h-[2.4rem] !px-3.5 !py-2"
              to="/app/notifications"
            >
              Open notifications
            </Link>
          }
        >
          <div className="mb-4 grid shrink-0 gap-3 sm:grid-cols-3">
            <MetricCard
              hint="Unread items in your queue"
              label="Unread"
                tone={notificationsSummary.unreadCount > 0 ? "accent" : "default"}
                value={formatNumber(notificationsSummary.unreadCount)}
            />
            <MetricCard
              hint="Critical active alerts"
              label="Critical"
                tone={notificationsSummary.criticalCount > 0 ? "danger" : "default"}
                value={formatNumber(notificationsSummary.criticalCount)}
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
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        {canViewReports ? (
          <SectionCard
            className="xl:h-[35rem]"
            contentClassName="overflow-y-auto pr-1.5 custom-scrollbar"
            title="Profit insights"
            description="Track today vs month profit, margin, and the strongest profit day without opening a full report."
            action={
              <Link
                className="ui-btn ui-btn--secondary !min-h-[2.4rem] !px-3.5 !py-2"
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
                    value={formatCurrency(profitTodaySummary.profit)}
                  />
                  <MetricCard
                    hint={`${formatNumber(parseMoney(profitMonthSummary.profitPercent))}% margin this month`}
                    label="Monthly profit"
                    value={formatCurrency(profitMonthSummary.profit)}
                  />
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Revenue
                        </p>
                        <p className="mt-1.5 text-sm font-semibold text-slate-950">
                          {formatCurrency(profitMonthSummary.revenue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Cost
                        </p>
                        <p className="mt-1.5 text-sm font-semibold text-slate-950">
                          {formatCurrency(profitMonthSummary.cost)}
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
            className="xl:h-[35rem]"
            contentClassName="overflow-y-auto pr-1.5 custom-scrollbar"
            title="Inventory intelligence"
            description="Low stock and near-expiry items are elevated first so urgent stock action stays obvious."
            action={
              <div className="flex flex-wrap gap-2">
                <Link
                  className="ui-btn ui-btn--secondary !min-h-[2.4rem] !px-3 !py-2"
                  to="/app/inventory/low-stock"
                >
                  Low stock
                </Link>
                <Link
                  className="ui-btn ui-btn--secondary !min-h-[2.4rem] !px-3 !py-2"
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
                tone={lowStockTotal > 0 ? "warning" : "default"}
                value={formatNumber(lowStockTotal)}
              />
              <MetricCard
                hint="Expired batches with quantity"
                label="Expired stock"
                tone={reportsSummary.expiryBreakdown.expired > 0 ? "danger" : "default"}
                value={formatNumber(reportsSummary.expiryBreakdown.expired)}
              />
              <MetricCard
                hint="Batches expiring in 30 days"
                label="Near expiry"
                tone={nearExpiryTotal > 0 ? "danger" : "default"}
                value={formatNumber(nearExpiryTotal)}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="ui-feed-list lg:!max-h-[27rem]">
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
                      className="block rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.28)] transition hover:border-slate-300 hover:bg-white"
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

              <div className="ui-feed-list lg:!max-h-[27rem]">
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
                        className="block rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.28)] transition hover:border-slate-300 hover:bg-white"
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
            className="w-full"
            description="Receivables and supplier balances stay compact, accurate, and directly connected to ledger drill-downs."
          >
            <div className="mb-4 grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                hint={`${formatNumber(customerDueSummary.openBillCount)} open bills`}
                label="Customer due"
                tone={customerDueSummary.entityCount > 0 ? "warning" : "default"}
                value={formatCurrency(customerDueSummary.totalOutstandingAmount)}
              />
              <MetricCard
                hint={`${formatNumber(customerDueSummary.totalAdvanceAmount)} customer advance`}
                label="Due customers"
                value={formatNumber(customerDueSummary.entityCount)}
              />
              <MetricCard
                hint={`${formatNumber(supplierPayableSummary.openPurchaseCount)} open purchases`}
                label="Supplier payable"
                tone={supplierPayableSummary.entityCount > 0 ? "warning" : "default"}
                value={formatCurrency(supplierPayableSummary.totalOutstandingAmount)}
              />
              <MetricCard
                hint={`${formatNumber(supplierPayableSummary.totalAdvanceAmount)} supplier advance`}
                label="Payable suppliers"
                value={formatNumber(supplierPayableSummary.entityCount)}
              />
            </div>

            {customerDueQuery.error || supplierPayableQuery.error ? (
              <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                {customerDueQuery.error?.message ?? supplierPayableQuery.error?.message}
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="ui-feed-list lg:!max-h-[27rem]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Top customer dues
                    </p>
                    <Link
                      className="ui-link-inline"
                      to="/app/accounting/customers"
                    >
                      View all
                    </Link>
                  </div>
                  {(customerDueQuery.data?.items ?? []).length ? (
                    customerDueQuery.data!.items.map((item) => (
                      <Link
                        className="block rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.28)] transition hover:border-slate-300 hover:bg-white"
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

                <div className="ui-feed-list lg:!max-h-[27rem]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Top supplier payables
                    </p>
                    <Link
                      className="ui-link-inline"
                      to="/app/accounting/suppliers"
                    >
                      View all
                    </Link>
                  </div>
                  {(supplierPayableQuery.data?.items ?? []).length ? (
                    supplierPayableQuery.data!.items.map((item) => (
                      <Link
                        className="block rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.28)] transition hover:border-slate-300 hover:bg-white"
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

        <div className={cn("w-full", canViewPayments ? "h-[32rem] xl:h-full xl:min-h-[24rem] relative" : "")}>
          <SectionCard
            title="Recent activity"
            className={cn(canViewPayments ? "xl:absolute xl:inset-0 xl:h-full" : "")}
            contentClassName="overflow-y-auto pr-1.5 custom-scrollbar"
            description="Latest bills, returns, payments, and stock movements available to your role are merged into one operational feed."
          >
            <ActivityList items={activityItems} />
          </SectionCard>
        </div>
      </div>

      {user.role === "admin" ? (
        <div
          className={cn(
            "rounded-[24px] border px-4 py-4 shadow-sm shadow-slate-200/60",
            (reportsSummary.lowStockCount > 0 ||
              reportsSummary.expiryBreakdown.expired > 0 ||
              notificationsSummary.criticalCount)
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
                notificationsSummary.criticalCount > 0
                  ? `${formatNumber(reportsSummary.lowStockCount)} low stock medicines, ${formatNumber(
                      reportsSummary.expiryBreakdown.expired,
                    )} expired batches, and ${formatNumber(
                      notificationsSummary.criticalCount,
                    )} critical alerts need attention.`
                  : "Inventory risk and critical alerts are currently under control."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canViewInventory ? (
                <Link
                  className="ui-btn ui-btn--secondary !min-h-[2.4rem] !px-3.5 !py-2"
                  to="/app/inventory/low-stock"
                >
                  Review stock
                </Link>
              ) : null}
              <Link
                className="ui-btn ui-btn--secondary !min-h-[2.4rem] !px-3.5 !py-2"
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
