import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeIndianRupee,
  FileCheck2,
  FileClock,
  RotateCcw,
} from "lucide-react";

import { ErrorState } from "../../../components/ui/ErrorState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { ResponsiveDataList } from "../../../components/ui/ResponsiveDataList";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { formatCurrency, formatDateTime, humanizeLabel } from "../../../lib/utils";
import { hasPermission } from "../../../types/auth";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { BillingModuleNav } from "../../billing/components/BillingModuleNav";
import { listSalesReturns, salesReturnsQueryKeys } from "../api/salesReturns";

const searchInputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100";
const filterControlClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";
const desktopCellClass =
  "px-4 py-3 !border-y !border-slate-200/80 !bg-white text-sm text-slate-700";
const desktopHeaderClass = "px-4 text-[11px] tracking-[0.16em] text-slate-500";

export const SalesReturnsPage = () => {
  const sessionQuery = useSessionQuery();
  const user = sessionQuery.data?.user;
  const canCreateReturns = hasPermission(user, "billing.return");
  const canCreateBills = hasPermission(user, "billing.create");
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
    <div className="space-y-4">
      <PageHeader
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:justify-end xl:w-auto xl:flex-nowrap">
            <BillingModuleNav canCreateBills={canCreateBills} />
            {canCreateReturns ? (
              <Link
                className="ui-btn ui-btn--primary !rounded-[6px]"
                to="/app/billing/returns/new"
              >
                Create return
              </Link>
            ) : null}
          </div>
        }
        className="!py-4 md:!py-4"
        eyebrow="Billing / Sales Returns"
        title="Sales returns"
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] shadow-[0_18px_38px_-28px_rgba(15,23,42,0.24),0_14px_28px_-24px_rgba(148,163,184,0.45)]">
          <SummaryCard icon={<RotateCcw className="h-5 w-5" />} label="Returns" value={pagination?.total ?? 0} />
        </div>
        <div className="rounded-[24px] shadow-[0_18px_38px_-28px_rgba(15,23,42,0.24),0_14px_28px_-24px_rgba(148,163,184,0.45)]">
          <SummaryCard
            icon={<FileCheck2 className="h-5 w-5" />}
            label="Completed returns"
            tone={completedCount ? "accent" : "default"}
            value={completedCount}
          />
        </div>
        <div className="rounded-[24px] shadow-[0_18px_38px_-28px_rgba(15,23,42,0.24),0_14px_28px_-24px_rgba(148,163,184,0.45)]">
          <SummaryCard
            icon={<FileClock className="h-5 w-5" />}
            label="Draft returns"
            tone={draftCount ? "warning" : "default"}
            value={draftCount}
          />
        </div>
        <div className="rounded-[24px] shadow-[0_18px_38px_-28px_rgba(15,23,42,0.24),0_14px_28px_-24px_rgba(148,163,184,0.45)]">
          <SummaryCard
            icon={<BadgeIndianRupee className="h-5 w-5" />}
            label="Visible total"
            value={formatCurrency(visibleValue)}
          />
        </div>
      </div>

      <section className="rounded-[26px] border border-white/75 bg-[linear-gradient(180deg,rgba(248,250,255,0.96),rgba(255,255,255,0.98))] p-4 shadow-[0_22px_52px_-42px_rgba(15,23,42,0.22)]">
        <div className="flex flex-wrap items-center gap-3">
          <label className="block w-full sm:w-[14rem] lg:w-[14.5rem] xl:w-[15rem]">
            <span className="sr-only">Search returns</span>
            <input
              className={searchInputClassName}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search return number, bill number, customer, or phone"
              value={search}
            />
          </label>

          <label className="block w-full sm:w-[8.25rem]">
            <span className="sr-only">Status</span>
            <select
              className={filterControlClassName}
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

          <label className="block w-full sm:w-[8.75rem]">
            <span className="sr-only">Refund status</span>
            <select
              className={filterControlClassName}
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

          <label className="block w-full sm:w-[8rem]">
            <span className="sr-only">Date from</span>
            <input
              className={filterControlClassName}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
              type="date"
              value={dateFrom}
            />
          </label>

          <label className="block w-full sm:w-[8rem]">
            <span className="sr-only">Date to</span>
            <input
              className={filterControlClassName}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
              type="date"
              value={dateTo}
            />
          </label>

          <label className="block w-full sm:w-[8.5rem]">
            <span className="sr-only">Order</span>
            <select
              className={filterControlClassName}
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

          <button
            className="w-full shrink-0 rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
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
        </div>
      </section>

      <SectionCard title="Returns register">
        {!salesReturnsQuery.isLoading && returns.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,251,0.96))] px-6 py-10 text-center shadow-[0_20px_44px_-36px_rgba(15,23,42,0.22)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm shadow-slate-200/80">
              <span className="text-base font-semibold text-slate-500">i</span>
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">No returns found</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              No sales returns match the current filters.
            </p>
          </div>
        ) : (
          <ResponsiveDataList
            data={returns}
            isLoading={salesReturnsQuery.isLoading}
            keyExtractor={(item) => item.id}
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
            rowClassName="rounded-[20px] bg-transparent"
            tableClassName="min-w-[1080px] w-full border-separate border-spacing-y-2"
            columns={[
              {
                header: "Return",
                accessor: (item) => (
                  <div>
                    <p className="font-semibold text-slate-950">{item.returnNumber}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.createdBy.fullName}</p>
                  </div>
                ),
                className: `rounded-l-[20px] ${desktopCellClass}`,
                headerClassName: desktopHeaderClass,
              },
              {
                header: "Bill",
                accessor: (item) => (
                  <span className="text-slate-700">{item.billNumber}</span>
                ),
                className: desktopCellClass,
                headerClassName: desktopHeaderClass,
              },
              {
                header: "Customer",
                accessor: (item) => (
                  <span className="text-slate-700">{item.customerLabel}</span>
                ),
                className: desktopCellClass,
                headerClassName: desktopHeaderClass,
              },
              {
                header: "Status",
                accessor: (item) => <StatusBadge label={item.status} />,
                className: desktopCellClass,
                headerClassName: desktopHeaderClass,
              },
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
                className: desktopCellClass,
                headerClassName: desktopHeaderClass,
              },
              {
                header: "Amount",
                accessor: (item) => formatCurrency(item.totalReturnAmount),
                className: `${desktopCellClass} font-semibold text-slate-950`,
                headerClassName: desktopHeaderClass,
              },
              {
                header: "Created",
                accessor: (item) => formatDateTime(item.createdAt),
                className: `${desktopCellClass} text-slate-600`,
                headerClassName: desktopHeaderClass,
              },
              {
                header: "Action",
                accessor: (item) => (
                  <Link
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    to={`/app/billing/returns/${item.id}`}
                  >
                    View detail
                  </Link>
                ),
                className: `rounded-r-[20px] ${desktopCellClass} text-right`,
                headerClassName: `${desktopHeaderClass} text-right`,
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
                      Bill {item.billNumber} &middot; {item.customerLabel}
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
        )}
      </SectionCard>
    </div>
  );
};
