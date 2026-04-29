import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { FilterBar } from "../../../components/ui/FilterBar";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import {
  formatDate,
  formatNumber,
  getDaysUntil,
} from "../../../lib/utils";
import { inventoryQueryKeys, listExpiryReport } from "../api/inventory";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";
const inventoryRefreshIntervalMs = 300000;

const getExpiryBadge = (status: string) => {
  if (status === "expired") {
    return {
      label: "Expired",
      tone: "expired",
    };
  }

  return {
    label: "Near Expiry",
    tone: "near_expiry",
  };
};

export const ExpiryReportPage = () => {
  const [search, setSearch] = useState("");
  const [expiryWindow, setExpiryWindow] = useState<"expired" | "30" | "60" | "90">("30");
  const [sortBy, setSortBy] = useState<"expiryDate" | "medicineName">("expiryDate");
  const [page, setPage] = useState(1);

  const deferredSearch = useDeferredValue(search);

  const params = {
    search: deferredSearch || undefined,
    expiryWindow,
    sortBy,
    sortOrder: "asc" as const,
    page,
    pageSize: 10,
  };

  const expiryQuery = useQuery({
    queryKey: inventoryQueryKeys.expiry(params),
    queryFn: () => listExpiryReport(params),
    refetchInterval: inventoryRefreshIntervalMs,
  });

  if (expiryQuery.isLoading) {
    return <LoadingState title="Loading expiry report" />;
  }

  if (expiryQuery.error) {
    return (
      <ErrorState
        description={expiryQuery.error.message}
        onRetry={() => expiryQuery.refetch()}
        title="Unable to load expiry report"
      />
    );
  }

  const items = expiryQuery.data?.items ?? [];
  const pagination = expiryQuery.data?.pagination;
  const expiredCount = items.filter((item) => item.expiryStatus === "expired").length;
  const nearExpiryCount = items.length - expiredCount;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Link
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            to="/app/inventory"
          >
            Back to inventory
          </Link>
        }
        description="Review expiring and expired batches so your team can act before stock turns into a write-off."
        eyebrow="Inventory control"
        title="Expiry Report"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          hint="Matching batch records for this window"
          label="Batches"
          value={pagination?.total ?? 0}
        />
        <SummaryCard
          hint="Expired batches on this page"
          label="Expired visible"
          tone={expiredCount > 0 ? "danger" : "default"}
          value={expiredCount}
        />
        <SummaryCard
          hint="Near-expiry batches on this page"
          label="Near expiry visible"
          tone={nearExpiryCount > 0 ? "warning" : "default"}
          value={nearExpiryCount}
        />
      </div>

      <FilterBar
        description="Focus the report by expiry window and search without clutter."
        title="Expiry filters"
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
              placeholder="Search medicine, batch number, or barcode"
              value={search}
            />
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
              <option value="expired">Expired</option>
              <option value="30">Next 30 days</option>
              <option value="60">Next 60 days</option>
              <option value="90">Next 90 days</option>
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
            </select>
          </label>
        </div>
      </FilterBar>

      <SectionCard
        description="A practical expiry register for quick review and action."
        title="Expiry register"
      >
        {items.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 xl:hidden">
              {items.map((item) => {
                const badge = getExpiryBadge(item.expiryStatus);
                const daysLeft = getDaysUntil(item.expiryDate);

                return (
                  <article
                    className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                    key={item.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-950">
                            {item.medicine.medicineName}
                          </h3>
                          <StatusBadge label={badge.label} tone={badge.tone} />
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          Batch {item.batchNumber}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-950">
                        {daysLeft === null
                          ? "NA"
                          : daysLeft < 0
                            ? `${Math.abs(daysLeft)} days overdue`
                            : `${daysLeft} days left`}
                      </p>
                    </div>

                    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[
                        ["Expiry date", formatDate(item.expiryDate)],
                        ["Available quantity", formatNumber(item.quantityAvailable)],
                        ["Generic name", item.medicine.genericName],
                        ["Status", item.status],
                      ].map(([label, value]) => (
                        <div
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                          key={label}
                        >
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {label}
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-900">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-[1120px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Medicine</th>
                    <th className="px-4">Batch</th>
                    <th className="px-4">Expiry date</th>
                    <th className="px-4">Days left</th>
                    <th className="px-4">Available quantity</th>
                    <th className="px-4">Batch status</th>
                    <th className="px-4">Expiry status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const badge = getExpiryBadge(item.expiryStatus);
                    const daysLeft = getDaysUntil(item.expiryDate);

                    return (
                      <tr className="rounded-3xl bg-slate-50" key={item.id}>
                        <td className="rounded-l-3xl px-4 py-4">
                          <div>
                            <p className="font-semibold text-slate-950">
                              {item.medicine.medicineName}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {item.medicine.genericName}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{item.batchNumber}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {formatDate(item.expiryDate)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {daysLeft === null
                            ? "NA"
                            : daysLeft < 0
                              ? `${Math.abs(daysLeft)} overdue`
                              : `${daysLeft} left`}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-slate-950">
                          {formatNumber(item.quantityAvailable)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge label={item.status} />
                        </td>
                        <td className="rounded-r-3xl px-4 py-4">
                          <StatusBadge label={badge.label} tone={badge.tone} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pagination ? (
              <Pagination
                onPageChange={setPage}
                page={pagination.page}
                pageSize={pagination.pageSize}
                totalItems={pagination.total}
                totalPages={pagination.totalPages}
              />
            ) : null}
          </div>
        ) : (
          <EmptyState
            description="No expiry records match the current filters."
            title="No expiring batches found"
          />
        )}
      </SectionCard>
    </div>
  );
};
