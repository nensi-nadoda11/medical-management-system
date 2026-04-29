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
import {
  formatCurrency,
  formatDate,
  formatNumber,
  humanizeLabel,
} from "../../../lib/utils";
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
  const [groupBy, setGroupBy] = useState<"day" | "month">("day");
  const [branchId, setBranchId] = useState("");
  const [combineBranches, setCombineBranches] = useState(false);
  const [sortBy, setSortBy] = useState<
    "medicineName" | "quantitySold" | "revenue" | "profit" | "lastSoldAt"
  >("quantitySold");
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
        description="Review medicine-wise consumption, realized revenue, and margin across daily or monthly periods."
        eyebrow="Reports & Analytics"
        title="Medicine usage report"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          hint={report.filters.dateRangeLabel}
          label="Units sold"
          tone="accent"
          value={formatNumber(report.summary.totalUnitsSold)}
        />
        <SummaryCard
          hint="Medicines sold in the selected period"
          label="Medicines used"
          value={formatNumber(report.summary.uniqueMedicines)}
        />
        <SummaryCard label="Revenue" value={formatCurrency(report.summary.revenue)} />
        <SummaryCard label="Cost" value={formatCurrency(report.summary.cost)} />
        <SummaryCard
          hint={`${formatNumber(report.summary.profitPercent)}% margin`}
          label="Profit"
          tone="accent"
          value={formatCurrency(report.summary.profit)}
        />
      </div>

      <FilterBar
        className="print-hidden"
        description="Switch between daily, monthly, or custom range review and filter by medicine master."
        title="Usage filters"
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
              placeholder="Search medicine, generic, or barcode"
              value={search}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
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

          <label className="grid gap-2 text-sm font-medium text-slate-700">
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

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Trend grouping
            <select
              className={inputClassName}
              onChange={(event) => {
                setGroupBy(event.target.value as "day" | "month");
                setPage(1);
              }}
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
              <option value="quantitySold">Quantity sold</option>
              <option value="profit">Profit</option>
              <option value="revenue">Revenue</option>
              <option value="lastSoldAt">Last sold date</option>
              <option value="medicineName">Medicine name</option>
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
        <SectionCard
          description="Daily or monthly usage movement for the selected period."
          title="Usage trend"
        >
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4">Period</th>
                  <th className="px-4">Units sold</th>
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
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatNumber(item.totalUnitsSold)}
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
                    <td className="rounded-r-3xl px-4 py-4 text-sm font-semibold text-slate-950">
                      {formatNumber(item.profitPercent)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          description="Medicine-wise usage register for the selected filters."
          title="Usage register"
        >
          <div className="space-y-4">
            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-[1280px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Medicine</th>
                    <th className="px-4">Category</th>
                    <th className="px-4">Manufacturer</th>
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
                          <p className="mt-1 text-sm text-slate-600">
                            {item.medicine.genericName} / {humanizeLabel(item.medicine.form)} /{" "}
                            {humanizeLabel(item.medicine.unit)}
                          </p>
                          {item.medicine.barcode ? (
                            <p className="mt-1 text-xs font-medium text-slate-500">
                              Barcode: {item.medicine.barcode}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {item.category.name}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {item.manufacturer.name}
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
                      <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={8}>
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
                        <p className="mt-1 text-sm text-slate-600">
                          {item.manufacturer.name}
                        </p>
                        {item.medicine.barcode ? (
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            Barcode: {item.medicine.barcode}
                          </p>
                        ) : null}
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
    </div>
  );
};
