import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { FilterBar } from "../../../components/ui/FilterBar";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { formatCurrency, formatDateTime } from "../../../lib/utils";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { hasPermission } from "../../../types/auth";
import {
  listPurchaseReturns,
  purchaseReturnsQueryKeys,
} from "../api/purchaseReturns";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

export const PurchaseReturnsPage = () => {
  const sessionQuery = useSessionQuery();
  const canCreateReturns = hasPermission(
    sessionQuery.data?.user,
    "purchaseReturns.create",
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "draft" | "completed" | "cancelled">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<
    "createdAt" | "completedAt" | "returnNumber" | "totalReturnAmount"
  >("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const listParams = {
    search: deferredSearch || undefined,
    status: status || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: 10,
    sortBy,
    sortOrder,
  };

  const purchaseReturnsQuery = useQuery({
    queryKey: purchaseReturnsQueryKeys.list(listParams),
    queryFn: () => listPurchaseReturns(listParams),
  });

  if (purchaseReturnsQuery.isLoading) {
    return <LoadingState title="Loading purchase returns" />;
  }

  if (purchaseReturnsQuery.error) {
    return (
      <ErrorState
        description={purchaseReturnsQuery.error.message}
        onRetry={() => purchaseReturnsQuery.refetch()}
        title="Unable to load purchase returns"
      />
    );
  }

  const returns = purchaseReturnsQuery.data?.items ?? [];
  const pagination = purchaseReturnsQuery.data?.pagination;
  const completedCount = returns.filter((item) => item.status === "completed").length;
  const draftCount = returns.filter((item) => item.status === "draft").length;
  const visibleValue = returns.reduce(
    (sum, item) => sum + Number(item.totalReturnAmount),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          canCreateReturns ? (
            <Link
              className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              to="/app/purchase-returns/new"
            >
              Create return
            </Link>
          ) : null
        }
        description="Track draft, completed, and cancelled purchase returns with clean supplier and purchase linkage."
        eyebrow="Purchase management"
        title="Purchase returns"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard hint="Total matching returns" label="Returns" value={pagination?.total ?? 0} />
        <SummaryCard hint="Completed returns on this page" label="Completed visible" value={completedCount} />
        <SummaryCard hint="Draft returns on this page" label="Draft visible" value={draftCount} />
        <SummaryCard hint="Visible return value" label="Visible total" value={formatCurrency(visibleValue)} />
      </div>

      <FilterBar
        actions={
          <button
            className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => {
              setSearch("");
              setStatus("");
              setDateFrom("");
              setDateTo("");
              setSortBy("createdAt");
              setSortOrder("desc");
              setPage(1);
            }}
            type="button"
          >
            Clear filters
          </button>
        }
        description="Keep the return register compact for procurement and finance review."
        title="Return filters"
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
              placeholder="Search return number, purchase number, or supplier"
              value={search}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Status
            <select
              className={inputClassName}
              onChange={(event) => {
                setStatus(event.target.value as typeof status);
                setPage(1);
              }}
              value={status}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
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
            Sort by
            <select
              className={inputClassName}
              onChange={(event) => {
                setSortBy(event.target.value as typeof sortBy);
                setPage(1);
              }}
              value={sortBy}
            >
              <option value="createdAt">Created date</option>
              <option value="completedAt">Completed date</option>
              <option value="returnNumber">Return number</option>
              <option value="totalReturnAmount">Return amount</option>
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

      <SectionCard
        description="A compact register for supplier-facing return activity and stock/payable corrections."
        title="Returns register"
      >
        {returns.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 xl:hidden">
              {returns.map((item) => (
                <article
                  className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        className="text-sm font-semibold text-slate-950 hover:text-teal-700"
                        to={`/app/purchase-returns/${item.id}`}
                      >
                        {item.returnNumber}
                      </Link>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.purchaseNumber} · {item.supplierName}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-950">
                      {formatCurrency(item.totalReturnAmount)}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusBadge label={item.status} />
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Created", formatDateTime(item.createdAt)],
                      ["Created by", item.createdBy.fullName],
                      ["Updated", formatDateTime(item.updatedAt)],
                      [
                        "Completed",
                        item.completedAt ? formatDateTime(item.completedAt) : "Not completed",
                      ],
                    ].map(([label, value]) => (
                      <div
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                        key={label}
                      >
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {label}
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-[1080px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Return</th>
                    <th className="px-4">Purchase</th>
                    <th className="px-4">Supplier</th>
                    <th className="px-4">Status</th>
                    <th className="px-4">Amount</th>
                    <th className="px-4">Created</th>
                    <th className="px-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((item) => (
                    <tr className="rounded-3xl bg-slate-50" key={item.id}>
                      <td className="rounded-l-3xl px-4 py-4">
                        <div>
                          <p className="font-semibold text-slate-950">{item.returnNumber}</p>
                          <p className="mt-1 text-sm text-slate-600">{item.createdBy.fullName}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {item.purchaseNumber}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {item.supplierName}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={item.status} />
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-950">
                        {formatCurrency(item.totalReturnAmount)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td className="rounded-r-3xl px-4 py-4">
                        <Link
                          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                          to={`/app/purchase-returns/${item.id}`}
                        >
                          View detail
                        </Link>
                      </td>
                    </tr>
                  ))}
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
            description="No purchase returns match the current filters."
            title="No returns found"
          />
        )}
      </SectionCard>
    </div>
  );
};
