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
import { formatCurrency, formatDate, formatNumber, humanizeLabel } from "../../../lib/utils";
import { listCategories, listManufacturers, medicinesQueryKeys } from "../../medicines/api/medicines";
import { useSessionQuery } from "../../auth/hooks/use-session";
import {
  exportStockReport,
  getStockReport,
  reportsQueryKeys,
} from "../api/reports";
import { ReportExportButtons } from "../components/ReportExportButtons";
import { ReportsNav } from "../components/ReportsNav";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

export const StockReportPage = () => {
  const { pushToast } = useToast();
  const role = useSessionQuery().data?.user.role;
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [batchStatus, setBatchStatus] = useState("");
  const [sortBy, setSortBy] = useState<
    "medicineName" | "expiryDate" | "quantityAvailable" | "stockValue"
  >("expiryDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const params = useMemo(
    () => ({
      search: deferredSearch || undefined,
      categoryId: categoryId || undefined,
      manufacturerId: manufacturerId || undefined,
      batchStatus: (batchStatus as "active" | "exhausted" | "expired") || undefined,
      sortBy,
      sortOrder,
      page,
      pageSize: 10,
    }),
    [batchStatus, categoryId, deferredSearch, manufacturerId, page, sortBy, sortOrder],
  );

  const stockQuery = useQuery({
    queryKey: reportsQueryKeys.stock(params),
    queryFn: () => getStockReport(params),
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

  const activeError =
    stockQuery.error ?? categoriesQuery.error ?? manufacturersQuery.error;

  if (!role || stockQuery.isLoading || categoriesQuery.isLoading || manufacturersQuery.isLoading) {
    return <LoadingState title="Loading stock report" />;
  }

  if (activeError) {
    return (
      <ErrorState
        description={activeError.message}
        onRetry={() => {
          stockQuery.refetch();
          categoriesQuery.refetch();
          manufacturersQuery.refetch();
        }}
        title="Unable to load stock report"
      />
    );
  }

  const report = stockQuery.data!;

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
                void exportStockReport(params, format)
                  .then(() =>
                    pushToast({
                      title: "Export ready",
                      description: `Stock report ${format.toUpperCase()} download started.`,
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
        description="Review current stock valuation and batch-wise availability from one compact report."
        eyebrow="Reports & Analytics"
        title="Stock report"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Medicines" value={formatNumber(report.summary.totalMedicines)} />
        <SummaryCard label="Batches" value={formatNumber(report.summary.totalBatches)} />
        <SummaryCard label="Units" value={formatNumber(report.summary.totalUnits)} />
        <SummaryCard
          label="Stock valuation"
          tone="accent"
          value={formatCurrency(report.summary.stockValuation)}
        />
        <SummaryCard
          label="Low stock count"
          tone={report.summary.lowStockCount ? "warning" : "default"}
          value={formatNumber(report.summary.lowStockCount)}
        />
      </div>

      <FilterBar description="Filter by product master and batch state." title="Stock filters">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700 xl:col-span-2">
            Search
            <input
              className={inputClassName}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search medicine, generic, or batch"
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
            Batch status
            <select
              className={inputClassName}
              onChange={(event) => {
                setBatchStatus(event.target.value);
                setPage(1);
              }}
              value={batchStatus}
            >
              <option value="">All batch states</option>
              <option value="active">Active</option>
              <option value="exhausted">Exhausted</option>
              <option value="expired">Expired</option>
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
              <option value="expiryDate">Expiry date</option>
              <option value="medicineName">Medicine name</option>
              <option value="quantityAvailable">Quantity</option>
              <option value="stockValue">Stock value</option>
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
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
        </div>
      </FilterBar>

      <SectionCard description="Batch-wise stock position and valuation." title="Stock register">
        <div className="space-y-4">
          <div className="hidden overflow-x-auto xl:block">
            <table className="min-w-[1240px] w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4">Medicine</th>
                  <th className="px-4">Category</th>
                  <th className="px-4">Manufacturer</th>
                  <th className="px-4">Batch</th>
                  <th className="px-4">Expiry</th>
                  <th className="px-4">Qty</th>
                  <th className="px-4">Purchase rate</th>
                  <th className="px-4">Stock value</th>
                  <th className="px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.items.map((item) => (
                  <tr className="rounded-3xl bg-slate-50" key={item.batch.id}>
                    <td className="rounded-l-3xl px-4 py-4">
                      <p className="font-semibold text-slate-950">{item.medicine.medicineName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.medicine.genericName} / {humanizeLabel(item.medicine.form)} / {humanizeLabel(item.medicine.unit)}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{item.category.name}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{item.manufacturer.name}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{item.batch.batchNumber}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{formatDate(item.batch.expiryDate)}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{formatNumber(item.batch.quantityAvailable)}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(item.batch.purchaseRate)}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-950">{formatCurrency(item.stockValue)}</td>
                    <td className="rounded-r-3xl px-4 py-4">
                      <StatusBadge label={item.batch.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 xl:hidden">
            {report.rows.items.map((item) => (
              <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-4" key={item.batch.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{item.medicine.medicineName}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.batch.batchNumber}</p>
                  </div>
                  <StatusBadge label={item.batch.status} />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {[
                    ["Expiry", formatDate(item.batch.expiryDate)],
                    ["Quantity", formatNumber(item.batch.quantityAvailable)],
                    ["Purchase rate", formatCurrency(item.batch.purchaseRate)],
                    ["Stock value", formatCurrency(item.stockValue)],
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
  );
};
