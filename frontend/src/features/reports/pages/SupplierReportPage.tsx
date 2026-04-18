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
import { formatCurrency, formatNumber } from "../../../lib/utils";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { listSuppliers, suppliersQueryKeys } from "../../suppliers/api/suppliers";
import {
  exportSupplierReport,
  getSupplierReport,
  reportsQueryKeys,
} from "../api/reports";
import { ReportExportButtons } from "../components/ReportExportButtons";
import { ReportsNav } from "../components/ReportsNav";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

const defaultDateFrom = () => {
  const value = new Date();
  value.setDate(1);
  return value.toISOString().slice(0, 10);
};

export const SupplierReportPage = () => {
  const { pushToast } = useToast();
  const role = useSessionQuery().data?.user.role;
  const [search, setSearch] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [sortBy, setSortBy] = useState<
    "supplierName" | "totalPurchase" | "totalDue" | "purchaseCount"
  >("totalPurchase");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const params = useMemo(
    () => ({
      search: deferredSearch || undefined,
      supplierId: supplierId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortBy,
      sortOrder,
      page,
      pageSize: 10,
    }),
    [dateFrom, dateTo, deferredSearch, page, sortBy, sortOrder, supplierId],
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

  const activeError = reportQuery.error ?? suppliersQuery.error;

  if (!role || reportQuery.isLoading || suppliersQuery.isLoading) {
    return <LoadingState title="Loading supplier report" />;
  }

  if (activeError) {
    return (
      <ErrorState
        description={activeError.message}
        onRetry={() => {
          reportQuery.refetch();
          suppliersQuery.refetch();
        }}
        title="Unable to load supplier report"
      />
    );
  }

  const report = reportQuery.data!;

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
            />
          </>
        }
        description="Review supplier-wise purchase value, payments made, and outstanding dues."
        eyebrow="Reports & Analytics"
        title="Supplier report"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          hint={report.filters.dateRangeLabel}
          label="Suppliers"
          value={formatNumber(report.summary.supplierCount)}
        />
        <SummaryCard
          hint="Total finalized purchase value"
          label="Total purchase"
          tone="accent"
          value={formatCurrency(report.summary.totalPurchase)}
        />
        <SummaryCard
          hint="Payments already cleared"
          label="Total paid"
          value={formatCurrency(report.summary.totalPaid)}
        />
        <SummaryCard
          hint="Outstanding supplier balance"
          label="Total due"
          tone={Number(report.summary.totalDue) > 0 ? "warning" : "default"}
          value={formatCurrency(report.summary.totalDue)}
        />
      </div>

      <FilterBar description="Filter supplier liabilities by range and supplier master." title="Supplier filters">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700 xl:col-span-2">
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
              <option value="totalPurchase">Total purchase</option>
              <option value="totalDue">Total due</option>
              <option value="purchaseCount">Purchase count</option>
              <option value="supplierName">Supplier name</option>
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

      <SectionCard description="Supplier-wise purchase and outstanding register." title="Supplier register">
        <div className="space-y-4">
          <div className="hidden overflow-x-auto xl:block">
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
