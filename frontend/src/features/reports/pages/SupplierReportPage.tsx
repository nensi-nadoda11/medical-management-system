import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useToast } from "../../../hooks/use-toast";
import { formatCurrency, formatNumber } from "../../../lib/utils";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { listSuppliers, suppliersQueryKeys } from "../../suppliers/api/suppliers";
import {
  exportSupplierReport,
  getSupplierReport,
  reportsQueryKeys,
} from "../api/reports";
import { BranchScopeControl } from "../components/BranchScopeControl";
import { ReportExportButtons } from "../components/ReportExportButtons";
import { ReportsNav } from "../components/ReportsNav";
import {
  resolveReportDateRange,
  toLocalDateInputValue,
  toMonthInputValue,
  type ReportPeriodMode,
} from "../lib/report-period";

const inputClassName =
  "min-h-12 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";
const periodButtonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-2xl border px-4 py-2 text-sm font-semibold transition";

export const SupplierReportPage = () => {
  const { pushToast } = useToast();
  const role = useSessionQuery().data?.user.role;
  const today = useMemo(() => new Date(), []);
  const [search, setSearch] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>("monthly");
  const [selectedDate, setSelectedDate] = useState(toLocalDateInputValue(today));
  const [selectedMonth, setSelectedMonth] = useState(toMonthInputValue(today));
  const [customDateFrom, setCustomDateFrom] = useState(
    `${toMonthInputValue(today)}-01`,
  );
  const [customDateTo, setCustomDateTo] = useState(toLocalDateInputValue(today));
  const [branchId, setBranchId] = useState("");
  const [combineBranches, setCombineBranches] = useState(false);
  const [sortBy, setSortBy] = useState<
    "supplierName" | "totalPurchase" | "totalDue" | "purchaseCount"
  >("totalPurchase");
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
      supplierId: supplierId || undefined,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
      branchId: branchId || undefined,
      combineBranches: combineBranches || undefined,
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
      page,
      sortBy,
      sortOrder,
      supplierId,
    ],
  );

  const reportQuery = useQuery({
    queryKey: reportsQueryKeys.suppliers(params),
    queryFn: () => getSupplierReport(params),
    enabled: Boolean(role),
  });

  const suppliersQuery = useQuery({
    queryKey: suppliersQueryKeys.list({
      page: 1,
      pageSize: 100,
      sortBy: "supplierName",
      sortOrder: "asc",
    }),
    queryFn: () =>
      listSuppliers({
        page: 1,
        pageSize: 100,
        sortBy: "supplierName",
        sortOrder: "asc",
      }),
    enabled: Boolean(role),
  });

  if (!role || reportQuery.isLoading) {
    return <LoadingState title="Loading supplier report" />;
  }

  if (reportQuery.error) {
    return (
      <ErrorState
        description={reportQuery.error.message}
        onRetry={() => {
          reportQuery.refetch();
        }}
        title="Unable to load supplier report"
      />
    );
  }

  const report = reportQuery.data!;

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
                void exportSupplierReport(params, format)
                  .then(() =>
                    pushToast({
                      title: "Export ready",
                      description: `Supplier report ${format.toUpperCase()} download started.`,
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
              onPrint={() => window.print()}
            />
          </>
        }
        eyebrow="Reports & Analytics"
        title="Supplier report"
        titleClassName="whitespace-nowrap"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          {
            label: "Total purchase",
            tone: "border-emerald-100 bg-[linear-gradient(180deg,rgba(240,253,246,0.98),rgba(255,255,255,0.94))]",
            value: formatCurrency(report.summary.totalPurchase),
          },
          {
            label: "Total paid",
            tone: "border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,255,0.94))]",
            value: formatCurrency(report.summary.totalPaid),
          },
          {
            label: "Total due",
            tone:
              Number(report.summary.totalDue) > 0
                ? "border-amber-100 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,255,255,0.94))]"
                : "border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,255,0.94))]",
            value: formatCurrency(report.summary.totalDue),
          },
        ].map((item) => (
          <article
            className={`min-w-0 rounded-[24px] border px-5 py-3 shadow-[0_20px_48px_-40px_rgba(15,23,42,0.22)] ${item.tone}`}
            key={item.label}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {item.label}
            </p>
            <p className="mt-1 break-words text-[1.45rem] font-semibold tracking-tight text-slate-950 md:text-[1.6rem]">
              {item.value}
            </p>
          </article>
        ))}
      </div>

      <div className="print-hidden rounded-[22px] border border-slate-200/75 bg-white/92 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] md:p-4">
        <div className="space-y-3">
          <div className="grid gap-2 text-sm font-medium text-slate-700">
            <span>Range</span>
            <div className="ui-subtle-scrollbar flex flex-nowrap gap-2 overflow-x-auto pb-1">
              {[
                ["daily", "Daily"],
                ["monthly", "Monthly"],
                ["custom", "Custom"],
              ].map(([value, label]) => (
                <button
                  className={`${periodButtonClassName} ${
                    periodMode === value
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  key={value}
                  onClick={() => {
                    setPeriodMode(value as ReportPeriodMode);
                    setPage(1);
                  }}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`grid gap-3 md:grid-cols-2 ${
              periodMode === "custom" ? "xl:grid-cols-4" : "xl:grid-cols-3"
            }`}
          >
            {periodMode === "daily" ? (
              <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
                Report date
                <input
                  className={inputClassName}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setPage(1);
                  }}
                  type="date"
                  value={selectedDate}
                />
              </label>
            ) : null}

            {periodMode === "monthly" ? (
              <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
                Report month
                <input
                  className={inputClassName}
                  onChange={(event) => {
                    setSelectedMonth(event.target.value);
                    setPage(1);
                  }}
                  type="month"
                  value={selectedMonth}
                />
              </label>
            ) : null}

            {periodMode === "custom" ? (
              <>
                <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
                  Date from
                  <input
                    className={inputClassName}
                    onChange={(event) => {
                      setCustomDateFrom(event.target.value);
                      setPage(1);
                    }}
                    type="date"
                    value={customDateFrom}
                  />
                </label>
                <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
                  Date to
                  <input
                    className={inputClassName}
                    onChange={(event) => {
                      setCustomDateTo(event.target.value);
                      setPage(1);
                    }}
                    type="date"
                    value={customDateTo}
                  />
                </label>
              </>
            ) : null}

            <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
              Search
              <input
                className={inputClassName}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search supplier or company"
                value={search}
              />
            </label>
            <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
              Supplier
              <select
                className={inputClassName}
                onChange={(event) => {
                  setSupplierId(event.target.value);
                  setPage(1);
                }}
                value={supplierId}
              >
                <option value="">All suppliers</option>
                {(suppliersQuery.data?.items ?? []).map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplierName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
              Sort by
              <select
                className={inputClassName}
                onChange={(event) => {
                  setSortBy(event.target.value as typeof sortBy);
                  setPage(1);
                }}
                value={sortBy}
              >
                <option value="totalPurchase">Total purchase</option>
                <option value="totalDue">Total due</option>
                <option value="purchaseCount">Purchase count</option>
                <option value="supplierName">Supplier name</option>
              </select>
            </label>
            <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
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
        </div>
      </div>

      <SectionCard title="Supplier register">
        <div className="space-y-4">
          <div className="ui-subtle-scrollbar hidden overflow-x-auto xl:block">
            <table className="min-w-[1160px] w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4">Supplier</th>
                  <th className="px-4">Company</th>
                  <th className="px-4">Status</th>
                  <th className="px-4">Purchases</th>
                  <th className="px-4">Total purchase</th>
                  <th className="px-4">Paid</th>
                  <th className="px-4">Due</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.items.length ? (
                  report.rows.items.map((item) => (
                    <tr className="rounded-3xl bg-slate-50" key={item.supplier.id}>
                      <td className="rounded-l-3xl px-4 py-4">
                        <p className="font-semibold text-slate-950">{item.supplier.supplierName}</p>
                        <p className="mt-1 text-sm text-slate-600">{item.supplier.mobileNumber}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.supplier.companyName ?? "Not provided"}</td>
                      <td className="px-4 py-4">
                        <StatusBadge label={item.supplier.status} />
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatNumber(item.purchaseCount)}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-950">{formatCurrency(item.totalPurchase)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(item.totalPaid)}</td>
                      <td className="rounded-r-3xl px-4 py-4 text-sm font-semibold text-amber-700">{formatCurrency(item.totalDue)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={7}>
                      No supplier report records found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 xl:hidden">
            {report.rows.items.length ? (
              report.rows.items.map((item) => (
                <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-4" key={item.supplier.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{item.supplier.supplierName}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.supplier.companyName ?? item.supplier.mobileNumber}</p>
                    </div>
                    <StatusBadge label={item.supplier.status} />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Purchases", formatNumber(item.purchaseCount)],
                      ["Total purchase", formatCurrency(item.totalPurchase)],
                      ["Paid", formatCurrency(item.totalPaid)],
                      ["Due", formatCurrency(item.totalDue)],
                    ].map(([label, value]) => (
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5" key={label}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No supplier report records found for the selected filters.
              </div>
            )}
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
