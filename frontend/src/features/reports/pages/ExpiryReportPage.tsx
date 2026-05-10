import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useToast } from "../../../hooks/use-toast";
import { formatDate, formatNumber } from "../../../lib/utils";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { listMedicines, medicinesQueryKeys } from "../../medicines/api/medicines";
import {
  exportExpiryReport,
  getExpiryReport,
  reportsQueryKeys,
} from "../api/reports";
import { BranchScopeControl } from "../components/BranchScopeControl";
import { ReportExportButtons } from "../components/ReportExportButtons";
import { ReportsNav } from "../components/ReportsNav";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";
const reportRefreshIntervalMs = 300000;

export const ExpiryReportPage = () => {
  const { pushToast } = useToast();
  const role = useSessionQuery().data?.user.role;
  const [search, setSearch] = useState("");
  const [medicineId, setMedicineId] = useState("");
  const [expiryWindow, setExpiryWindow] = useState<"expired" | "30" | "60" | "90">("30");
  const [branchId, setBranchId] = useState("");
  const [combineBranches, setCombineBranches] = useState(false);
  const [sortBy, setSortBy] = useState<"expiryDate" | "medicineName">("expiryDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const params = useMemo(
    () => ({
      search: deferredSearch || undefined,
      medicineId: medicineId || undefined,
      expiryWindow,
      branchId: branchId || undefined,
      combineBranches: combineBranches || undefined,
      sortBy,
      sortOrder,
      page,
      pageSize: 10,
    }),
    [branchId, combineBranches, deferredSearch, expiryWindow, medicineId, page, sortBy, sortOrder],
  );

  const reportQuery = useQuery({
    queryKey: reportsQueryKeys.expiry(params),
    queryFn: () => getExpiryReport(params),
    enabled: Boolean(role),
    refetchInterval: reportRefreshIntervalMs,
  });

  const medicinesQuery = useQuery({
    queryKey: medicinesQueryKeys.list({
      page: 1,
      pageSize: 100,
      sortBy: "medicineName",
      sortOrder: "asc",
      status: "active",
    }),
    queryFn: () =>
      listMedicines({
        page: 1,
        pageSize: 100,
        sortBy: "medicineName",
        sortOrder: "asc",
        status: "active",
      }),
    enabled: Boolean(role),
  });

  if (!role || reportQuery.isLoading) {
    return <LoadingState title="Loading expiry report" />;
  }

  if (reportQuery.error) {
    return (
      <ErrorState
        description={reportQuery.error.message}
        onRetry={() => {
          reportQuery.refetch();
        }}
        title="Unable to load expiry report"
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
                void exportExpiryReport(params, format)
                  .then(() =>
                    pushToast({
                      title: "Export ready",
                      description: `Expiry report ${format.toUpperCase()} download started.`,
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
        title="Expiry report"
        titleClassName="whitespace-nowrap"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Expired",
            tone: report.summary.expiredCount ? "border-rose-100 bg-[linear-gradient(180deg,rgba(255,241,242,0.98),rgba(255,255,255,0.94))]" : "border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,255,0.94))]",
            value: formatNumber(report.summary.expiredCount),
          },
          {
            label: "Next 30 days",
            tone: report.summary.next30Count ? "border-amber-100 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,255,255,0.94))]" : "border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,255,0.94))]",
            value: formatNumber(report.summary.next30Count),
          },
          {
            label: "Next 60 days",
            tone: report.summary.next60Count ? "border-amber-100 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,255,255,0.94))]" : "border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,255,0.94))]",
            value: formatNumber(report.summary.next60Count),
          },
          {
            label: "Next 90 days",
            tone: "border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,255,0.94))]",
            value: formatNumber(report.summary.next90Count),
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700 xl:col-span-2">
            Search
            <input
              className={inputClassName}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search medicine, batch, or barcode"
              value={search}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Medicine
            <select
              className={inputClassName}
              onChange={(event) => {
                setMedicineId(event.target.value);
                setPage(1);
              }}
              value={medicineId}
            >
              <option value="">All medicines</option>
              {(medicinesQuery.data?.items ?? []).map((medicine) => (
                <option key={medicine.id} value={medicine.id}>
                  {medicine.medicineName}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Window
            <select
              className={inputClassName}
              onChange={(event) => {
                setExpiryWindow(event.target.value as typeof expiryWindow);
                setPage(1);
              }}
              value={expiryWindow}
            >
              <option value="expired">Expired only</option>
              <option value="30">Next 30 days</option>
              <option value="60">Next 60 days</option>
              <option value="90">Next 90 days</option>
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
              <option value="expiryDate">Expiry date</option>
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
              <option value="asc">Earliest first</option>
              <option value="desc">Latest first</option>
            </select>
          </label>
        </div>
      </div>

      <SectionCard title="Expiry register">
        <div className="space-y-4">
          <div className="hidden overflow-x-auto xl:block">
            <table className="min-w-[1120px] w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4">Medicine</th>
                  <th className="px-4">Batch</th>
                  <th className="px-4">Expiry</th>
                  <th className="px-4">Quantity</th>
                  <th className="px-4">Batch status</th>
                  <th className="px-4">Expiry status</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.items.length ? (
                  report.rows.items.map((item) => (
                    <tr className="rounded-3xl bg-slate-50" key={item.id}>
                      <td className="rounded-l-3xl px-4 py-3">
                        <p className="font-semibold text-slate-950">{item.medicine.medicineName}</p>
                        {item.medicine.barcode ? (
                          <p className="mt-0.5 text-xs font-medium text-slate-500">
                            Barcode: {item.medicine.barcode}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{item.batchNumber}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{formatDate(item.expiryDate)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(item.quantityAvailable)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge label={item.status} />
                      </td>
                      <td className="rounded-r-3xl px-4 py-3">
                        <StatusBadge label={item.expiryStatus} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={6}>
                      No expiry records found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 xl:hidden">
            {report.rows.items.length ? (
              report.rows.items.map((item) => (
                <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-3.5" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{item.medicine.medicineName}</p>
                      <p className="mt-0.5 text-sm text-slate-600">{item.batchNumber}</p>
                      {item.medicine.barcode ? (
                        <p className="mt-0.5 text-xs font-medium text-slate-500">
                          Barcode: {item.medicine.barcode}
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge label={item.expiryStatus} />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Expiry", formatDate(item.expiryDate)],
                      ["Quantity", formatNumber(item.quantityAvailable)],
                      ["Batch status", item.status],
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
                No expiry records found for the selected filters.
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
