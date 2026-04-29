import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "../../../components/ui/ErrorState";
import { FilterBar } from "../../../components/ui/FilterBar";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { useToast } from "../../../hooks/use-toast";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "../../../lib/utils";
import { useSessionQuery } from "../../auth/hooks/use-session";
import {
  exportSalesReport,
  getSalesReport,
  reportsQueryKeys,
} from "../api/reports";
import { BranchScopeControl } from "../components/BranchScopeControl";
import { ReportExportButtons } from "../components/ReportExportButtons";
import { ReportPeriodControl } from "../components/ReportPeriodControl";
import { ReportsNav } from "../components/ReportsNav";
import {
  resolveReportDateRange,
  toLocalDateInputValue,
  toMonthInputValue,
  type ReportPeriodMode,
} from "../lib/report-period";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

export const SalesReportPage = () => {
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const role = sessionQuery.data?.user.role;
  const today = useMemo(() => new Date(), []);

  const [search, setSearch] = useState("");
  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>("monthly");
  const [selectedDate, setSelectedDate] = useState(toLocalDateInputValue(today));
  const [selectedMonth, setSelectedMonth] = useState(toMonthInputValue(today));
  const [customDateFrom, setCustomDateFrom] = useState(
    `${toMonthInputValue(today)}-01`,
  );
  const [customDateTo, setCustomDateTo] = useState(toLocalDateInputValue(today));
  const [groupBy, setGroupBy] = useState<"day" | "month">("day");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [branchId, setBranchId] = useState("");
  const [combineBranches, setCombineBranches] = useState(false);
  const [sortBy, setSortBy] = useState<"completedAt" | "billNumber" | "grandTotal">(
    "completedAt",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const deferredSearch = useDeferredValue(search);
  const dateRange = useMemo(
    () =>
      resolveReportDateRange({
        mode: periodMode,
        selectedDate,
        selectedMonth,
        customDateFrom,
        customDateTo,
      }),
    [customDateFrom, customDateTo, periodMode, selectedDate, selectedMonth],
  );
  const params = useMemo(
    () => ({
      search: deferredSearch || undefined,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
      groupBy,
      branchId: branchId || undefined,
      combineBranches: combineBranches || undefined,
      paymentMethod:
        (paymentMethod as "cash" | "upi" | "card" | "bank_transfer" | "split") ||
        undefined,
      sortBy,
      sortOrder,
      page,
      pageSize: 10,
    }),
    [
      branchId,
      combineBranches,
      dateRange.dateFrom,
      dateRange.dateTo,
      deferredSearch,
      groupBy,
      page,
      paymentMethod,
      sortBy,
      sortOrder,
    ],
  );

  const salesQuery = useQuery({
    queryKey: reportsQueryKeys.sales(params),
    queryFn: () => getSalesReport(params),
  });

  if (!role || salesQuery.isLoading) {
    return <LoadingState title="Loading sales report" />;
  }

  if (salesQuery.error) {
    return (
      <ErrorState
        description={salesQuery.error.message}
        onRetry={() => salesQuery.refetch()}
        title="Unable to load sales report"
      />
    );
  }

  const report = salesQuery.data!;
  const bills = report.rows.items;
  const paymentBreakdown = report.summary.paymentBreakdown;

  return (
    <div className="print-report-page space-y-6">
      <PageHeader
        actions={
          <>
            <ReportsNav role={role} />
            <ReportExportButtons
              isLoading={isExporting}
              onExport={(format) => {
                setIsExporting(true);
                void exportSalesReport(params, format)
                  .then(() => {
                    pushToast({
                      title: "Export ready",
                      description: `Sales report ${format.toUpperCase()} download started.`,
                      variant: "success",
                    });
                  })
                  .catch((error: Error) => {
                    pushToast({
                      title: "Export failed",
                      description: error.message,
                      variant: "error",
                    });
                  })
                  .finally(() => setIsExporting(false));
              }}
              onPrint={() => window.print()}
            />
          </>
        }
        description="Track sales value, billing volume, and payment mix across any date range."
        eyebrow="Reports & Analytics"
        title="Sales report"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          hint={report.filters.dateRangeLabel}
          label="Total sales"
          tone="accent"
          value={formatCurrency(report.summary.totalSales)}
        />
        <SummaryCard
          hint="Completed bills in the selected range"
          label="Total bills"
          value={formatNumber(report.summary.totalBills)}
        />
        <SummaryCard
          hint="Average completed bill value"
          label="Average bill"
          value={formatCurrency(report.summary.averageBillValue)}
        />
        <SummaryCard
          hint={`Grouped by ${report.filters.groupBy}`}
          label="Trend rows"
          value={formatNumber(report.trend.length)}
        />
      </div>

      <FilterBar
        className="print-hidden"
        description="Compact filters for quick operational reporting."
        title="Sales filters"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ReportPeriodControl
            customDateFrom={customDateFrom}
            customDateTo={customDateTo}
            inputClassName={inputClassName}
            mode={periodMode}
            onCustomDateFromChange={(value) => {
              setCustomDateFrom(value);
              setPage(1);
            }}
            onCustomDateToChange={(value) => {
              setCustomDateTo(value);
              setPage(1);
            }}
            onModeChange={(value) => {
              setPeriodMode(value);
              setPage(1);
            }}
            onSelectedDateChange={(value) => {
              setSelectedDate(value);
              setPage(1);
            }}
            onSelectedMonthChange={(value) => {
              setSelectedMonth(value);
              setPage(1);
            }}
            selectedDate={selectedDate}
            selectedMonth={selectedMonth}
          />

          <label className="grid gap-2 text-sm font-medium text-slate-700 xl:col-span-2">
            Search
            <input
              className={inputClassName}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search bill number or customer"
              value={search}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Group by
            <select
              className={inputClassName}
              onChange={(event) => setGroupBy(event.target.value as "day" | "month")}
              value={groupBy}
            >
              <option value="day">Day</option>
              <option value="month">Month</option>
            </select>
          </label>

          <BranchScopeControl
            branchId={branchId}
            combineBranches={combineBranches}
            onBranchIdChange={(value) => {
              setBranchId(value);
              setPage(1);
            }}
            onCombineBranchesChange={(value) => {
              setCombineBranches(value);
              setPage(1);
            }}
          />

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Payment mode
            <select
              className={inputClassName}
              onChange={(event) => {
                setPaymentMethod(event.target.value);
                setPage(1);
              }}
              value={paymentMethod}
            >
              <option value="">All payment modes</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="split">Split</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Sort by
            <select
              className={inputClassName}
              onChange={(event) => {
                setSortBy(event.target.value as typeof sortBy);
                setPage(1);
              }}
              value={sortBy}
            >
              <option value="completedAt">Completed date</option>
              <option value="billNumber">Bill number</option>
              <option value="grandTotal">Grand total</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Order
            <select
              className={inputClassName}
              onChange={(event) => {
                setSortOrder(event.target.value as "asc" | "desc");
                setPage(1);
              }}
              value={sortOrder}
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </label>
        </div>
      </FilterBar>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard
          description="Payment mode contribution in the selected period."
          title="Payment breakdown"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {paymentBreakdown.map((item) => (
              <article
                className="rounded-[20px] border border-slate-200 bg-slate-50 p-4"
                key={item.paymentMethod}
              >
                <p className="text-sm font-semibold text-slate-950">
                  {item.paymentMethod.toUpperCase()}
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-950">
                  {formatCurrency(item.totalSales)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {formatNumber(item.totalBills)} bills
                </p>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard description="Daily or monthly trend rows." title="Sales trend">
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4">Period</th>
                  <th className="px-4">Bills</th>
                  <th className="px-4">Average</th>
                  <th className="px-4">Sales</th>
                </tr>
              </thead>
              <tbody>
                {report.trend.map((item) => (
                  <tr className="rounded-3xl bg-slate-50" key={item.periodStart}>
                    <td className="rounded-l-3xl px-4 py-4 text-sm font-semibold text-slate-950">
                      {formatDate(item.periodStart)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatNumber(item.totalBills)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatCurrency(item.averageBillValue)}
                    </td>
                    <td className="rounded-r-3xl px-4 py-4 text-sm font-semibold text-slate-950">
                      {formatCurrency(item.totalSales)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <SectionCard description="Completed bill register for the selected filters." title="Sales register">
        <div className="space-y-4">
          <div className="hidden overflow-x-auto xl:block">
            <table className="min-w-[1120px] w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4">Bill</th>
                  <th className="px-4">Customer</th>
                  <th className="px-4">Payment</th>
                  <th className="px-4">Status</th>
                  <th className="px-4">Amount</th>
                  <th className="px-4">Completed</th>
                  <th className="px-4">Created by</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr className="rounded-3xl bg-slate-50" key={bill.id}>
                    <td className="rounded-l-3xl px-4 py-4">
                      <p className="font-semibold text-slate-950">{bill.billNumber}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{bill.customerName}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {bill.paymentMethod.toUpperCase()}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge label={bill.paymentStatus} />
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <p className="font-semibold text-slate-950">
                        {formatCurrency(bill.grandTotal)}
                      </p>
                      <p className="mt-1 text-slate-600">
                        Due {formatCurrency(bill.dueAmount)}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatDateTime(bill.completedAt)}
                    </td>
                    <td className="rounded-r-3xl px-4 py-4 text-sm text-slate-700">
                      {bill.createdBy.fullName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 xl:hidden">
            {bills.map((bill) => (
              <article
                className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                key={bill.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{bill.billNumber}</p>
                    <p className="mt-1 text-sm text-slate-600">{bill.customerName}</p>
                  </div>
                  <StatusBadge label={bill.paymentStatus} />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Amount
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      {formatCurrency(bill.grandTotal)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Completed
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      {formatDateTime(bill.completedAt)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="print-hidden">
            <Pagination
              onPageChange={setPage}
              page={report.rows.pagination.page}
              pageSize={report.rows.pagination.pageSize}
              totalItems={report.rows.pagination.total}
              totalPages={report.rows.pagination.totalPages}
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
