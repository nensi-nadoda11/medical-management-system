import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { FilterBar } from "../../../components/ui/FilterBar";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { useToast } from "../../../hooks/use-toast";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  humanizeLabel,
} from "../../../lib/utils";
import { billingQueryKeys } from "../../billing/api/billing";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { customersQueryKeys } from "../../customers/api/customers";
import {
  accountingQueryKeys,
  createAccountingCustomerPayment,
  getCustomerDueSummary,
  getCustomerLedger,
} from "../api/accounting";
import { AccountingModuleNav } from "../components/AccountingModuleNav";
import { CustomerPaymentEntryModal } from "../components/CustomerPaymentEntryModal";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

export const CustomerLedgerPage = () => {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const role = sessionQuery.data?.user.role;
  const canRecordPayments = role === "admin" || role === "accountant";

  const [ledgerPage, setLedgerPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const ledgerParams = {
    page: ledgerPage,
    pageSize: 12,
    sortOrder,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const ledgerQuery = useQuery({
    queryKey: accountingQueryKeys.customerLedger(id, ledgerParams),
    queryFn: () => getCustomerLedger(id, ledgerParams),
    enabled: Boolean(id),
  });

  const dueSummaryQuery = useQuery({
    queryKey: accountingQueryKeys.customerSummary(id),
    queryFn: () => getCustomerDueSummary(id),
    enabled: Boolean(id),
  });

  const paymentMutation = useMutation({
    mutationFn: createAccountingCustomerPayment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accountingQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: customersQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: billingQueryKeys.all }),
      ]);
      pushToast({
        title: "Customer payment recorded",
        description: "Ledger and receivable balances were refreshed successfully.",
        variant: "success",
      });
      setIsPaymentOpen(false);
    },
    onError: (error: Error) => {
      pushToast({
        title: "Unable to record payment",
        description: error.message,
        variant: "error",
      });
    },
  });

  if (ledgerQuery.isLoading || dueSummaryQuery.isLoading) {
    return <LoadingState title="Loading customer ledger" />;
  }

  if (ledgerQuery.error || dueSummaryQuery.error || !ledgerQuery.data || !dueSummaryQuery.data) {
    return (
      <ErrorState
        description={
          ledgerQuery.error?.message ??
          dueSummaryQuery.error?.message ??
          "Unable to load customer ledger."
        }
        onRetry={() => {
          ledgerQuery.refetch();
          dueSummaryQuery.refetch();
        }}
        title="Unable to load customer ledger"
      />
    );
  }

  const { customer, ledger } = ledgerQuery.data;
  const summary = dueSummaryQuery.data.summary;
  const openSales = dueSummaryQuery.data.openSales;

  const renderReference = (referenceType: string, referenceId: string, notes: string | null) => {
    if (referenceType === "sale") {
      return (
        <Link
          className="font-semibold text-slate-950 hover:text-teal-700"
          to={`/app/billing/${referenceId}`}
        >
          {notes || "View bill"}
        </Link>
      );
    }

    if (referenceType === "sale_return") {
      return (
        <Link
          className="font-semibold text-slate-950 hover:text-teal-700"
          to={`/app/billing/returns/${referenceId}`}
        >
          {notes || "View return"}
        </Link>
      );
    }

    return <span className="font-medium text-slate-900">{notes || humanizeLabel(referenceType)}</span>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <AccountingModuleNav />
            <Link
              className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              to="/app/accounting/customers"
            >
              Back to customer accounting
            </Link>
            {canRecordPayments ? (
              <button
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={() => setIsPaymentOpen(true)}
                type="button"
              >
                Record payment
              </button>
            ) : null}
          </>
        }
        description="Ledger-ready receivable visibility with open bills, running balance movement, and payment history that stays easy to scan."
        eyebrow="Accounting / Customer Ledger"
        title={customer.fullName}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard hint={customer.customerCode} label="Customer code" value={customer.customerCode} />
        <SummaryCard
          hint="Current receivable"
          label="Outstanding"
          tone={Number(summary.outstandingAmount) > 0 ? "warning" : "default"}
          value={formatCurrency(summary.outstandingAmount)}
        />
        <SummaryCard
          hint="Unused customer credit"
          label="Advance"
          tone={Number(summary.advanceAmount) > 0 ? "accent" : "default"}
          value={formatCurrency(summary.advanceAmount)}
        />
        <SummaryCard
          hint="Open bills pending collection"
          label="Open bills"
          value={summary.openBillCount}
        />
      </div>

      <FilterBar
        actions={
          <button
            className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              setSortOrder("desc");
              setLedgerPage(1);
            }}
            type="button"
          >
            Clear filters
          </button>
        }
        description="Keep date-range review and running-balance inspection compact for collection follow-up."
        title="Ledger filters"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Date from
            <input
              className={inputClassName}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setLedgerPage(1);
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
                setLedgerPage(1);
              }}
              type="date"
              value={dateTo}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Order
            <select
              className={inputClassName}
              onChange={(event) => {
                setSortOrder(event.target.value as "asc" | "desc");
                setLedgerPage(1);
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
        description="Open customer bills remain visible here so collections can be recorded against the exact receivable when needed."
        title="Open bills"
      >
        {openSales.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 xl:hidden">
              {openSales.map((sale) => (
                <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-4" key={sale.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link className="text-sm font-semibold text-slate-950 hover:text-teal-700" to={`/app/billing/${sale.id}`}>
                        {sale.billNumber}
                      </Link>
                      <p className="mt-1 text-sm text-slate-600">{formatDate(sale.billDate)}</p>
                    </div>
                    <StatusBadge label={sale.paymentStatus} />
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Net amount", formatCurrency(sale.netTotal)],
                      ["Returned", formatCurrency(sale.returnedAmount)],
                      ["Allocated", formatCurrency(sale.allocatedAmount)],
                      ["Due", formatCurrency(sale.dueAmount)],
                    ].map(([label, value]) => (
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5" key={label}>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</dt>
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
                    <th className="px-4">Bill</th>
                    <th className="px-4">Date</th>
                    <th className="px-4">Net amount</th>
                    <th className="px-4">Returned</th>
                    <th className="px-4">Allocated</th>
                    <th className="px-4">Due</th>
                    <th className="px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {openSales.map((sale) => (
                    <tr className="rounded-3xl bg-slate-50" key={sale.id}>
                      <td className="rounded-l-3xl px-4 py-4">
                        <Link className="font-semibold text-slate-950 hover:text-teal-700" to={`/app/billing/${sale.id}`}>
                          {sale.billNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatDate(sale.billDate)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(sale.netTotal)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(sale.returnedAmount)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(sale.allocatedAmount)}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-amber-700">{formatCurrency(sale.dueAmount)}</td>
                      <td className="rounded-r-3xl px-4 py-4"><StatusBadge label={sale.paymentStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState description="This customer has no open receivable bills right now." title="No open bills" />
        )}
      </SectionCard>

      <SectionCard
        description="Every ledger movement shows debit, credit, running balance, and source reference for clean financial traceability."
        title="Ledger activity"
      >
        {ledger.items.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 xl:hidden">
              {ledger.items.map((entry) => (
                <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-4" key={entry.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{formatDateTime(entry.entryDate)}</p>
                      <p className="mt-1 text-sm text-slate-600">{renderReference(entry.referenceType, entry.referenceId, entry.notes)}</p>
                    </div>
                    <StatusBadge label={entry.transactionType} />
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Debit", formatCurrency(entry.debit)],
                      ["Credit", formatCurrency(entry.credit)],
                      ["Balance", formatCurrency(entry.balanceAfter)],
                      ["Created by", entry.createdBy?.fullName || "System"],
                    ].map(([label, value]) => (
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5" key={label}>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-[1260px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Date</th>
                    <th className="px-4">Transaction</th>
                    <th className="px-4">Reference</th>
                    <th className="px-4">Debit</th>
                    <th className="px-4">Credit</th>
                    <th className="px-4">Balance</th>
                    <th className="px-4">Created by</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.items.map((entry) => (
                    <tr className="rounded-3xl bg-slate-50" key={entry.id}>
                      <td className="rounded-l-3xl px-4 py-4 text-sm text-slate-700">{formatDateTime(entry.entryDate)}</td>
                      <td className="px-4 py-4"><StatusBadge label={entry.transactionType} /></td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {renderReference(entry.referenceType, entry.referenceId, entry.notes)}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-slate-700">{formatCurrency(entry.debit)}</td>
                      <td className="px-4 py-4 text-sm font-medium text-emerald-700">{formatCurrency(entry.credit)}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-950">{formatCurrency(entry.balanceAfter)}</td>
                      <td className="rounded-r-3xl px-4 py-4 text-sm text-slate-700">{entry.createdBy?.fullName || "System"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              onPageChange={setLedgerPage}
              page={ledger.pagination.page}
              pageSize={ledger.pagination.pageSize}
              totalItems={ledger.pagination.total}
              totalPages={ledger.pagination.totalPages}
            />
          </div>
        ) : (
          <EmptyState description="Ledger entries will appear here once this customer has financial activity." title="No ledger entries" />
        )}
      </SectionCard>

      <CustomerPaymentEntryModal
        errorMessage={paymentMutation.error?.message}
        isSubmitting={paymentMutation.isPending}
        onClose={() => setIsPaymentOpen(false)}
        onSubmit={async (payload) => {
          await paymentMutation.mutateAsync(payload);
        }}
        open={isPaymentOpen}
      />
    </div>
  );
};
