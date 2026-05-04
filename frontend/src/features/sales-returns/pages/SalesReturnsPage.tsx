import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "../../../components/ui/ErrorState";
import { FilterBar } from "../../../components/ui/FilterBar";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { ResponsiveDataList } from "../../../components/ui/ResponsiveDataList";
import { formatCurrency, formatDateTime, humanizeLabel } from "../../../lib/utils";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { BillingModuleNav } from "../../billing/components/BillingModuleNav";
import { listSalesReturns, salesReturnsQueryKeys } from "../api/salesReturns";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

export const SalesReturnsPage = () => {
  const sessionQuery = useSessionQuery();
  const canCreateReturns = sessionQuery.data?.user.role !== "accountant";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "draft" | "completed" | "cancelled">("");
  const [refundStatus, setRefundStatus] = useState<
    "" | "pending" | "processed" | "not_required"
  >("");
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
    refundStatus: refundStatus || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: 10,
    sortBy,
    sortOrder,
  };

  const salesReturnsQuery = useQuery({
    queryKey: salesReturnsQueryKeys.list(listParams),
    queryFn: () => listSalesReturns(listParams),
  });

  if (salesReturnsQuery.error) {
    return (
      <ErrorState
        description={salesReturnsQuery.error.message}
        onRetry={() => salesReturnsQuery.refetch()}
        title="Unable to load sales returns"
      />
    );
  }

  const returns = salesReturnsQuery.data?.items ?? [];
  const pagination = salesReturnsQuery.data?.pagination;
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
          <>
            <BillingModuleNav canCreateBills={canCreateReturns} />
            {canCreateReturns ? (
              <Link
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold !text-white transition hover:bg-slate-800"
                to="/app/billing/returns/new"
              >
                Create return
              </Link>
            ) : null}
          </>
        }
        description="Track draft, completed, and cancelled sales returns with clear refund visibility and fast bill-level lookup."
        eyebrow="Billing / Sales Returns"
        title="Sales returns"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard hint="Total matching returns" label="Returns" value={pagination?.total ?? 0} />
        <SummaryCard hint="Completed returns on this page" label="Completed visible" tone={completedCount ? "accent" : "default"} value={completedCount} />
        <SummaryCard hint="Draft returns on this page" label="Draft visible" tone={draftCount ? "warning" : "default"} value={draftCount} />
        <SummaryCard hint="Visible refund value" label="Visible total" value={formatCurrency(visibleValue)} />
      </div>

      <FilterBar
        actions={
          <button
            className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => {
              setSearch("");
              setStatus("");
              setRefundStatus("");
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
        description="Keep the returns register compact for counter operators and finance review."
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
              placeholder="Search return number, bill number, customer, or phone"
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
            Refund status
            <select
              className={inputClassName}
              onChange={(event) => {
                setRefundStatus(event.target.value as typeof refundStatus);
                setPage(1);
              }}
              value={refundStatus}
            >
              <option value="">All refund states</option>
              <option value="pending">Pending</option>
              <option value="processed">Processed</option>
              <option value="not_required">Not required</option>
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
        description="A compact return register with bill linkage, refund state, and quick detail access."
        title="Returns register"
      >
        <ResponsiveDataList
          data={returns}
          isLoading={salesReturnsQuery.isLoading}
          keyExtractor={(item) => item.id}
          emptyState={{
            title: "No returns found",
            description: "No sales returns match the current filters. Try clearing filters or creating a return.",
          }}
          pagination={
            pagination ? (
              <Pagination
                onPageChange={setPage}
                page={pagination.page}
                pageSize={pagination.pageSize}
                totalItems={pagination.total}
                totalPages={pagination.totalPages}
              />
            ) : null
          }
          columns={[
            {
              header: "Return",
              accessor: (item) => (
                <div>
                  <p className="font-semibold text-slate-950">{item.returnNumber}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.createdBy.fullName}</p>
                </div>
              ),
              className: "rounded-l-3xl px-4 py-4",
            },
            { header: "Bill", accessor: (item) => item.billNumber },
            { header: "Customer", accessor: (item) => item.customerLabel },
            { header: "Status", accessor: (item) => <StatusBadge label={item.status} /> },
            {
              header: "Refund",
              accessor: (item) => (
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={item.refundStatus} />
                  {item.refundMethod ? (
                    <StatusBadge label={humanizeLabel(item.refundMethod)} />
                  ) : null}
                </div>
              ),
            },
            {
              header: "Amount",
              accessor: (item) => formatCurrency(item.totalReturnAmount),
              className: "px-4 py-4 font-semibold text-slate-950",
            },
            {
              header: "Created",
              accessor: (item) => formatDateTime(item.createdAt),
              className: "px-4 py-4 text-sm text-slate-700",
            },
            {
              header: "Action",
              accessor: (item) => (
                <Link
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  to={`/app/billing/returns/${item.id}`}
                >
                  View detail
                </Link>
              ),
              className: "rounded-r-3xl px-4 py-4 text-right",
              headerClassName: "px-4 text-right",
            },
          ]}
          renderCard={(item) => (
            <article
              className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
              key={item.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    className="text-sm font-semibold text-slate-950 hover:text-teal-700"
                    to={`/app/billing/returns/${item.id}`}
                  >
                    {item.returnNumber}
                  </Link>
                  <p className="mt-1 text-sm text-slate-600">
                    Bill {item.billNumber} · {item.customerLabel}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-950">
                  {formatCurrency(item.totalReturnAmount)}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge label={item.status} />
                <StatusBadge label={item.refundStatus} />
                {item.refundMethod ? (
                  <StatusBadge label={humanizeLabel(item.refundMethod)} tone="info" />
                ) : null}
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["Refund amount", formatCurrency(item.refundAmount)],
                  ["Created", formatDateTime(item.createdAt)],
                  ["Created by", item.createdBy.fullName],
                  ["Updated", formatDateTime(item.updatedAt)],
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
          )}
        />
      </SectionCard>
    </div>
  );
};
