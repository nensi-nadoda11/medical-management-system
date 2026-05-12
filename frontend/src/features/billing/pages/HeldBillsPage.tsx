import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
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

export const HeldBillsPage = () => {
  const sessionQuery = useSessionQuery();
  const canCreateBills = hasPermission(sessionQuery.data?.user, "billing.create");
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"" | "unpaid" | "partial" | "paid">("");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const listParams = {
    search: deferredSearch || undefined,
    status: "held" as const,
    paymentStatus: paymentStatus || undefined,
    page,
    pageSize: 10,
    sortBy: "createdAt" as const,
    sortOrder: "desc" as const,
  };

  const billsQuery = useQuery({
    queryKey: billingQueryKeys.list(listParams),
    queryFn: () => listBills(listParams),
  });

  if (billsQuery.isLoading) {
    return <LoadingState title="Loading held bills" />;
  }

  if (billsQuery.error) {
    return (
      <ErrorState
        description={billsQuery.error.message}
        onRetry={() => billsQuery.refetch()}
        title="Unable to load held bills"
      />
    );
  }

  const bills = billsQuery.data?.items ?? [];
  const pagination = billsQuery.data?.pagination;
  const heldValue = bills.reduce((sum: number, bill: BillListItem) => sum + Number(bill.grandTotal), 0);
  const dueValue = bills.reduce((sum: number, bill: BillListItem) => sum + Number(bill.dueAmount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<BillingModuleNav canCreateBills={canCreateBills} />}
        eyebrow="Billing / POS"
        title="Held bills"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Held bills"
          tone={pagination?.total ? "warning" : "default"}
          value={pagination?.total ?? 0}
        />
        <SummaryCard
          label="Visible total"
          value={formatCurrency(heldValue)}
        />
        <SummaryCard
          label="Visible due"
          value={formatCurrency(dueValue)}
        />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <input
          className={`${inputClassName} w-full md:w-[19rem] lg:w-[22rem]`}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search bill number, customer, or phone"
          value={search}
        />

        <select
          className={`${inputClassName} w-full md:w-56`}
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

        <button
          className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          onClick={() => {
            setSearch("");
            setPaymentStatus("");
            setPage(1);
          }}
          type="button"
        >
          Clear filters
        </button>
      </div>

      <SectionCard title="Held bill register">
        <BillsRegister
          bills={bills}
          canOpenInPos={canCreateBills}
          emptyDescription="No held bills match the current filters."
          emptyTitle="No held bills found"
          onPageChange={setPage}
          pagination={pagination}
        />
      </SectionCard>
    </div>
  );
};
