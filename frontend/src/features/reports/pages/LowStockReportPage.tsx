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
import { formatNumber, humanizeLabel } from "../../../lib/utils";
import { useSessionQuery } from "../../auth/hooks/use-session";
import {
  listCategories,
  listManufacturers,
  medicinesQueryKeys,
} from "../../medicines/api/medicines";
import {
  exportLowStockReport,
  getLowStockReport,
  reportsQueryKeys,
} from "../api/reports";
import { BranchScopeControl } from "../components/BranchScopeControl";
import { ReportExportButtons } from "../components/ReportExportButtons";
import { ReportsNav } from "../components/ReportsNav";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";
const reportRefreshIntervalMs = 300000;

export const LowStockReportPage = () => {
  const { pushToast } = useToast();
  const role = useSessionQuery().data?.user.role;
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [combineBranches, setCombineBranches] = useState(false);
  const [sortBy, setSortBy] = useState<
    "medicineName" | "availableQuantity" | "reorderLevel" | "shortage"
  >("shortage");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const params = useMemo(
    () => ({
      search: deferredSearch || undefined,
      categoryId: categoryId || undefined,
      manufacturerId: manufacturerId || undefined,
      branchId: branchId || undefined,
      combineBranches: combineBranches || undefined,
      sortBy,
      sortOrder,
      page,
      pageSize: 10,
    }),
    [branchId, categoryId, combineBranches, deferredSearch, manufacturerId, page, sortBy, sortOrder],
  );

  const reportQuery = useQuery({
    queryKey: reportsQueryKeys.lowStock(params),
    queryFn: () => getLowStockReport(params),
    enabled: Boolean(role),
    refetchInterval: reportRefreshIntervalMs,
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
    return <LoadingState title="Loading low stock report" />;
  }

  if (reportQuery.error) {
    return (
      <ErrorState
        description={reportQuery.error.message}
        onRetry={() => {
          reportQuery.refetch();
        }}
        title="Unable to load low stock report"
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
                void exportLowStockReport(params, format)
                  .then(() =>
                    pushToast({
                      title: "Export ready",
                      description: `Low stock report ${format.toUpperCase()} download started.`,
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
        description="Track medicines that have dropped to or below reorder level, with exact shortage quantity."
        eyebrow="Reports & Analytics"
        title="Low stock report"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          hint="Medicines requiring replenishment"
          label="Low stock medicines"
          tone="warning"
          value={formatNumber(report.summary.totalMedicines)}
        />
        <SummaryCard
          hint="Total units short against reorder level"
          label="Total shortage"
          tone="danger"
          value={formatNumber(report.summary.totalShortage)}
        />
        <SummaryCard
          hint="Current register rows"
          label="Visible rows"
          value={formatNumber(report.rows.pagination.total)}
        />
      </div>

      <FilterBar
        className="print-hidden"
        description="Filter shortage by medicine master attributes."
        title="Low stock filters"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
              <option value="shortage">Shortage</option>
              <option value="availableQuantity">Available quantity</option>
              <option value="reorderLevel">Reorder level</option>
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

      <SectionCard description="Medicines currently under required stock level." title="Shortage register">
        <div className="space-y-4">
          <div className="hidden overflow-x-auto xl:block">
            <table className="min-w-[1160px] w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4">Medicine</th>
                  <th className="px-4">Category</th>
                  <th className="px-4">Manufacturer</th>
                  <th className="px-4">Available</th>
                  <th className="px-4">Reorder</th>
                  <th className="px-4">Shortage</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.items.length ? (
                  report.rows.items.map((item) => (
                    <tr className="rounded-3xl bg-slate-50" key={item.medicine.id}>
                      <td className="rounded-l-3xl px-4 py-4">
                        <p className="font-semibold text-slate-950">{item.medicine.medicineName}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.medicine.genericName} / {humanizeLabel(item.medicine.form)} / {humanizeLabel(item.medicine.unit)}
                        </p>
                        {item.medicine.barcode ? (
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            Barcode: {item.medicine.barcode}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.category.name}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.manufacturer.name}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatNumber(item.availableQuantity)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatNumber(item.reorderLevel)}</td>
                      <td className="rounded-r-3xl px-4 py-4 text-sm font-semibold text-rose-700">
                        {formatNumber(item.shortage)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={6}>
                      No low stock medicines found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 xl:hidden">
            {report.rows.items.length ? (
              report.rows.items.map((item) => (
                <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-4" key={item.medicine.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{item.medicine.medicineName}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.manufacturer.name}</p>
                      {item.medicine.barcode ? (
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          Barcode: {item.medicine.barcode}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-sm font-semibold text-rose-700">
                      Short {formatNumber(item.shortage)}
                    </p>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Category", item.category.name],
                      ["Available", formatNumber(item.availableQuantity)],
                      ["Reorder level", formatNumber(item.reorderLevel)],
                      ["Unit", humanizeLabel(item.medicine.unit)],
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
                No low stock medicines found for the selected filters.
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
