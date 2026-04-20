import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "../../../components/ui/ErrorState";
import { FilterBar } from "../../../components/ui/FilterBar";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { useToast } from "../../../hooks/use-toast";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "../../../lib/utils";
import { useSessionQuery } from "../../auth/hooks/use-session";
import {
  exportProfitReport,
  getProfitReport,
  reportsQueryKeys,
} from "../api/reports";
import { BranchScopeControl } from "../components/BranchScopeControl";
import { ReportExportButtons } from "../components/ReportExportButtons";
import { ReportsNav } from "../components/ReportsNav";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

const defaultDateFrom = () => {
  const value = new Date();
  value.setDate(1);
  return value.toISOString().slice(0, 10);
};

export const ProfitReportPage = () => {
  const { pushToast } = useToast();
  const role = useSessionQuery().data?.user.role;
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [groupBy, setGroupBy] = useState<"day" | "month">("day");
  const [branchId, setBranchId] = useState("");
  const [combineBranches, setCombineBranches] = useState(false);
  const [sortBy, setSortBy] = useState<"completedAt" | "revenue" | "profit">(
    "completedAt",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const params = useMemo(
    () => ({
      search: deferredSearch || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      groupBy,
      branchId: branchId || undefined,
      combineBranches: combineBranches || undefined,
      sortBy,
      sortOrder,
      page,
      pageSize: 10,
    }),
    [branchId, combineBranches, dateFrom, dateTo, deferredSearch, groupBy, page, sortBy, sortOrder],
  );

  const profitQuery = useQuery({
    queryKey: reportsQueryKeys.profit(params),
    queryFn: () => getProfitReport(params),
    enabled: Boolean(role),
  });

  if (!role || profitQuery.isLoading) {
    return <LoadingState title="Loading profit report" />;
  }

  if (profitQuery.error) {
    return (
      <ErrorState
        description={profitQuery.error.message}
        onRetry={() => profitQuery.refetch()}
        title="Unable to load profit report"
      />
    );
  }

  const report = profitQuery.data!;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <ReportsNav role={role} />
            <ReportExportButtons
              isLoading={isExporting}
              onExport={(format) => {
                setIsExporting(true);
                void exportProfitReport(params, format)
                  .then(() =>
                    pushToast({
                      title: "Export ready",
                      description: `Profit report ${format.toUpperCase()} download started.`,
                      variant: "success",
                    }),
                  )
                  .catch((error: Error) =>
                    pushToast({
                      title: "Export failed",
                      description: error.message,
                      variant: "error",
                    }),
                  )
                  .finally(() => setIsExporting(false));
              }}
            />
          </>
        }
        description="Measure revenue, cost, and realized margin from completed sales using batch-level cost data."
        eyebrow="Reports & Analytics"
        title="Profit report"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          hint={report.filters.dateRangeLabel}
          label="Revenue"
          tone="accent"
          value={formatCurrency(report.summary.revenue)}
        />
        <SummaryCard label="Cost" value={formatCurrency(report.summary.cost)} />
        <SummaryCard
          hint={`${report.summary.profitPercent}% margin`}
          label="Profit"
          tone="accent"
          value={formatCurrency(report.summary.profit)}
        />
        <SummaryCard
          hint={`Grouped by ${report.filters.groupBy}`}
          label="Profit %"
          value={`${formatNumber(report.summary.profitPercent)}%`}
        />
      </div>

      <FilterBar description="Use date range and search to focus the profitability window." title="Profit filters">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            Date from
            <input
              className={inputClassName}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
              type="date"
              value={dateFrom}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Date to
            <input
              className={inputClassName}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
              type="date"
              value={dateTo}
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
              <option value="revenue">Revenue</option>
              <option value="profit">Profit</option>
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
              <option value="desc">Highest first</option>
              <option value="asc">Lowest first</option>
            </select>
          </label>
        </div>
      </FilterBar>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard description="Profit trend across the selected range." title="Trend register">
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4">Period</th>
                  <th className="px-4">Revenue</th>
                  <th className="px-4">Cost</th>
                  <th className="px-4">Profit</th>
                  <th className="px-4">Profit %</th>
                </tr>
              </thead>
              <tbody>
                {report.trend.map((item) => (
                  <tr className="rounded-3xl bg-slate-50" key={item.periodStart}>
                    <td className="rounded-l-3xl px-4 py-4 text-sm font-semibold text-slate-950">
                      {formatDate(item.periodStart)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(item.revenue)}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(item.cost)}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-emerald-700">
                      {formatCurrency(item.profit)}
                    </td>
                    <td className="rounded-r-3xl px-4 py-4 text-sm font-semibold text-slate-950">
                      {formatNumber(item.profitPercent)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard description="Bill-wise realized profitability." title="Bill profitability">
          <div className="space-y-4">
            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-[1040px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Bill</th>
                    <th className="px-4">Customer</th>
                    <th className="px-4">Completed</th>
                    <th className="px-4">Revenue</th>
                    <th className="px-4">Cost</th>
                    <th className="px-4">Profit</th>
                    <th className="px-4">Profit %</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.items.map((item) => (
                    <tr className="rounded-3xl bg-slate-50" key={item.saleId}>
                      <td className="rounded-l-3xl px-4 py-4 font-semibold text-slate-950">
                        {item.billNumber}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.customerName}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatDateTime(item.completedAt)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(item.revenue)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(item.cost)}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-emerald-700">
                        {formatCurrency(item.profit)}
                      </td>
                      <td className="rounded-r-3xl px-4 py-4 text-sm font-semibold text-slate-950">
                        {formatNumber(item.profitPercent)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 xl:hidden">
              {report.rows.items.map((item) => (
                <article
                  className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                  key={item.saleId}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{item.billNumber}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.customerName}</p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-700">
                      {formatCurrency(item.profit)}
                    </p>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Revenue", formatCurrency(item.revenue)],
                      ["Cost", formatCurrency(item.cost)],
                      ["Profit %", `${formatNumber(item.profitPercent)}%`],
                      ["Completed", formatDateTime(item.completedAt)],
                    ].map(([label, value]) => (
                      <div
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                        key={label}
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <Pagination
              onPageChange={setPage}
              page={report.rows.pagination.page}
              pageSize={report.rows.pagination.pageSize}
              totalItems={report.rows.pagination.total}
              totalPages={report.rows.pagination.totalPages}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
