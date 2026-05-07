import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "../../../components/ui/ErrorState";
import { FilterBar } from "../../../components/ui/FilterBar";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { formatCurrency } from "../../../lib/utils";
import { hasPermission } from "../../../types/auth";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { billingQueryKeys, listBills, type BillListItem } from "../api/billing";
import { BillsRegister } from "../components/BillsRegister";
import { BillingModuleNav } from "../components/BillingModuleNav";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

export const BillingHistoryPage = () => {
  const sessionQuery = useSessionQuery();
  const canCreateBills = hasPermission(sessionQuery.data?.user, "billing.create");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "held" | "completed" | "cancelled">("");
  const [paymentStatus, setPaymentStatus] = useState<"" | "unpaid" | "partial" | "paid">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<
    "createdAt" | "completedAt" | "billNumber" | "grandTotal"
  >("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const deferredSearch = useDeferredValue(search);

  const listParams = {
    search: deferredSearch || undefined,
    status: status || undefined,
    paymentStatus: paymentStatus || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: 10,
    sortBy,
    sortOrder,
  };

  const billsQuery = useQuery({
    queryKey: billingQueryKeys.list(listParams),
    queryFn: () => listBills(listParams),
  });

  const bills = billsQuery.data?.items ?? [];
  const pagination = billsQuery.data?.pagination;
  const completedCount = bills.filter((bill: BillListItem) => bill.status === "completed").length;
  const heldCount = bills.filter((bill: BillListItem) => bill.status === "held").length;
  const visibleValue = bills.reduce((sum: number, bill: BillListItem) => sum + Number(bill.grandTotal), 0);

  if (billsQuery.error) {
    return (
      <ErrorState
        description={billsQuery.error.message}
        onRetry={() => billsQuery.refetch()}
        title="Unable to load billing history"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<BillingModuleNav canCreateBills={canCreateBills} />}
        description="Browse completed and held bills with payment, operator, and customer visibility in one clean register."
        eyebrow="Billing / POS"
        title="Billing history"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          hint="Total matching bills"
          label="Bills"
          value={pagination?.total ?? 0}
        />
        <SummaryCard
          hint="Completed bills on this page"
          label="Completed visible"
          tone={completedCount ? "accent" : "default"}
          value={completedCount}
        />
        <SummaryCard
          hint="Held bills on this page"
          label="Held visible"
          tone={heldCount ? "warning" : "default"}
          value={heldCount}
        />
        <SummaryCard
          hint="Visible bill value on this page"
          label="Visible total"
          value={formatCurrency(visibleValue)}
        />
      </div>

      <FilterBar
        actions={
          <button
            className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => {
              setSearch("");
              setStatus("");
              setPaymentStatus("");
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
        description="Keep billing history practical for daily counter reviews and accountant visibility."
        title="Billing filters"
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
              placeholder="Search bill number, customer, or phone"
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
              <option value="held">Held</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Payment status
            <select
              className={inputClassName}
              onChange={(event) => {
                setPaymentStatus(event.target.value as typeof paymentStatus);
                setPage(1);
              }}
              value={paymentStatus}
            >
              <option value="">All payments</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
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
              <option value="completedAt">Bill date</option>
              <option value="billNumber">Bill number</option>
              <option value="grandTotal">Grand total</option>
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
        description="A compact billing register for sales activity, payment follow-up, and daily shop review."
        title="Billing register"
      >
        <BillsRegister
          bills={bills}
          canOpenInPos={canCreateBills}
          emptyDescription="No bills match the current filters."
          emptyTitle="No bills found"
          onPageChange={setPage}
          pagination={pagination}
          isLoading={billsQuery.isLoading}
        />
      </SectionCard>
    </div>
  );
};
