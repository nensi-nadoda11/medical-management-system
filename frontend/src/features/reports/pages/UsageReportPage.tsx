import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { useToast } from "../../../hooks/use-toast";
import { formatCurrency, formatDate, formatNumber } from "../../../lib/utils";
import { useSessionQuery } from "../../auth/hooks/use-session";
import {
  listCategories,
  listManufacturers,
  medicinesQueryKeys,
} from "../../medicines/api/medicines";
import {
  exportUsageReport,
  getUsageReport,
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
  "min-h-12 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";
const periodButtonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-2xl border px-4 py-2 text-sm font-semibold transition";

export const UsageReportPage = () => {
  const { pushToast } = useToast();
  const role = useSessionQuery().data?.user.role;
  const today = useMemo(() => new Date(), []);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
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
    "medicineName" | "quantitySold" | "revenue" | "profit" | "lastSoldAt"
  >("quantitySold");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const groupBy: "day" | "month" = periodMode === "monthly" ? "month" : "day";

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
      categoryId: categoryId || undefined,
      manufacturerId: manufacturerId || undefined,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
      groupBy,
      branchId: branchId || undefined,
      combineBranches: combineBranches || undefined,
      sortBy,
      sortOrder,
      page,
      pageSize: 10,
    }),
    [
      branchId,
      categoryId,
      combineBranches,
      dateRange.dateFrom,
      dateRange.dateTo,
      deferredSearch,
      groupBy,
      manufacturerId,
      page,
      sortBy,
      sortOrder,
    ],
  );

  const reportQuery = useQuery({
    queryKey: reportsQueryKeys.usage(params),
    queryFn: () => getUsageReport(params),
    enabled: Boolean(role),
  });

  const categoriesQuery = useQuery({
    queryKey: medicinesQueryKeys.categoryList({
      page: 1,
      pageSize: 100,
      sortBy: "name",
      sortOrder: "asc",
    }),
    queryFn: () =>
      listCategories({
        page: 1,
        pageSize: 100,
        sortBy: "name",
        sortOrder: "asc",
      }),
    enabled: Boolean(role),
  });

  const manufacturersQuery = useQuery({
    queryKey: medicinesQueryKeys.manufacturerList({
      page: 1,
      pageSize: 100,
      sortBy: "name",
      sortOrder: "asc",
    }),
    queryFn: () =>
      listManufacturers({
        page: 1,
        pageSize: 100,
        sortBy: "name",
        sortOrder: "asc",
      }),
    enabled: Boolean(role),
  });

  if (!role || reportQuery.isLoading) {
    return <LoadingState title="Loading medicine usage report" />;
  }

  if (reportQuery.error) {
    return (
      <ErrorState
        description={reportQuery.error.message}
        onRetry={() => {
          reportQuery.refetch();
        }}
        title="Unable to load medicine usage report"
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
                void exportUsageReport(params, format)
                  .then(() =>
                    pushToast({
                      title: "Export ready",
                      description: `Usage report ${format.toUpperCase()} download started.`,
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
        titleClassName="whitespace-nowrap"
        title="Medicine usage report"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Units sold",
            tone:
              "border-emerald-100 bg-[linear-gradient(180deg,rgba(240,253,246,0.98),rgba(255,255,255,0.94))]",
            value: formatNumber(report.summary.totalUnitsSold),
          },
          {
            label: "Revenue",
            tone:
              "border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,255,0.94))]",
            value: formatCurrency(report.summary.revenue),
          },
          {
            label: "Cost",
            tone:
              "border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,255,0.94))]",
            value: formatCurrency(report.summary.cost),
          },
          {
            label: "Profit",
            tone:
              "border-emerald-100 bg-[linear-gradient(180deg,rgba(240,253,246,0.98),rgba(255,255,255,0.94))]",
            value: formatCurrency(report.summary.profit),
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

          <div
            className={`grid gap-3 md:grid-cols-2 ${
              periodMode === "custom" ? "xl:grid-cols-5" : "xl:grid-cols-4"
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
                placeholder="Search medicine, generic, or barcode"
                value={search}
              />
            </label>

            <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
              Category
              <select
                className={inputClassName}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setPage(1);
                }}
                value={categoryId}
              >
                <option value="">All categories</option>
                {(categoriesQuery.data?.items ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
              Manufacturer
              <select
                className={inputClassName}
                onChange={(event) => {
                  setManufacturerId(event.target.value);
                  setPage(1);
                }}
                value={manufacturerId}
              >
                <option value="">All manufacturers</option>
                {(manufacturersQuery.data?.items ?? []).map((manufacturer) => (
                  <option key={manufacturer.id} value={manufacturer.id}>
                    {manufacturer.name}
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
                <option value="quantitySold">Quantity sold</option>
                <option value="profit">Profit</option>
                <option value="revenue">Revenue</option>
                <option value="lastSoldAt">Last sold date</option>
                <option value="medicineName">Medicine name</option>
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

      <SectionCard title="Usage register">
        <div className="space-y-4">
          <div className="ui-subtle-scrollbar hidden overflow-x-auto xl:block">
            <table className="min-w-[1080px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Medicine</th>
                    <th className="px-4">Category</th>
                    <th className="px-4">Qty sold</th>
                    <th className="px-4">Revenue</th>
                    <th className="px-4">Cost</th>
                    <th className="px-4">Profit</th>
                    <th className="px-4">Last sold</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.items.length ? (
                    report.rows.items.map((item) => (
                      <tr className="rounded-3xl bg-slate-50" key={item.medicine.id}>
                        <td className="rounded-l-3xl px-4 py-4">
                          <p className="font-semibold text-slate-950">
                            {item.medicine.medicineName}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {item.category.name}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {formatNumber(item.quantitySold)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {formatCurrency(item.revenue)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {formatCurrency(item.cost)}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-emerald-700">
                          {formatCurrency(item.profit)}
                        </td>
                        <td className="rounded-r-3xl px-4 py-4 text-sm text-slate-700">
                          {formatDate(item.lastSoldAt)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={7}>
                        No medicine usage records found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
          </div>

          <div className="grid gap-3 xl:hidden">
            {report.rows.items.length ? (
              report.rows.items.map((item) => (
                <article
                  className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                  key={item.medicine.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {item.medicine.medicineName}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-700">
                      {formatNumber(item.quantitySold)} units
                    </p>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Revenue", formatCurrency(item.revenue)],
                      ["Cost", formatCurrency(item.cost)],
                      ["Profit", formatCurrency(item.profit)],
                      ["Last sold", formatDate(item.lastSoldAt)],
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
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No medicine usage records found for the selected filters.
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
