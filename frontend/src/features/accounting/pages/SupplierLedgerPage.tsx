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
import { useSessionQuery } from "../../auth/hooks/use-session";
import { purchasesQueryKeys } from "../../purchases/api/purchases";
import { suppliersQueryKeys } from "../../suppliers/api/suppliers";
import {
  accountingQueryKeys,
  createAccountingSupplierPayment,
  getSupplierDueSummary,
  getSupplierLedger,
} from "../api/accounting";
import { AccountingModuleNav } from "../components/AccountingModuleNav";
import { SupplierPaymentEntryModal } from "../components/SupplierPaymentEntryModal";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

export const SupplierLedgerPage = () => {
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
    queryKey: accountingQueryKeys.supplierLedger(id, ledgerParams),
    queryFn: () => getSupplierLedger(id, ledgerParams),
    enabled: Boolean(id),
  });

  const dueSummaryQuery = useQuery({
    queryKey: accountingQueryKeys.supplierSummary(id),
    queryFn: () => getSupplierDueSummary(id),
    enabled: Boolean(id),
  });

  const paymentMutation = useMutation({
    mutationFn: createAccountingSupplierPayment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accountingQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all }),
      ]);
      pushToast({
        title: "Supplier payment recorded",
        description: "Ledger and payable balances were refreshed successfully.",
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
    return <LoadingState title="Loading supplier ledger" />;
  }

  if (ledgerQuery.error || dueSummaryQuery.error || !ledgerQuery.data || !dueSummaryQuery.data) {
    return (
      <ErrorState
        description={
          ledgerQuery.error?.message ??
          dueSummaryQuery.error?.message ??
          "Unable to load supplier ledger."
        }
        onRetry={() => {
          ledgerQuery.refetch();
          dueSummaryQuery.refetch();
        }}
        title="Unable to load supplier ledger"
      />
    );
  }

  const { supplier, ledger } = ledgerQuery.data;
  const summary = dueSummaryQuery.data.summary;
  const openPurchases = dueSummaryQuery.data.openPurchases;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <AccountingModuleNav />
            <Link
              className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              to="/app/accounting/suppliers"
            >
              Back to supplier accounting
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
        description="Payable-ready visibility with open purchases, running balance movement, and supplier payment history that stays compact."
        eyebrow="Accounting / Supplier Ledger"
        title={supplier.supplierName}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard hint={supplier.companyName || "Independent supplier"} label="Supplier" value={supplier.supplierName} />
        <SummaryCard
          hint="Current payable"
          label="Outstanding"
          tone={Number(summary.outstandingAmount) > 0 ? "warning" : "default"}
          value={formatCurrency(summary.outstandingAmount)}
        />
        <SummaryCard
          hint="Unused supplier advance"
          label="Advance"
          tone={Number(summary.advanceAmount) > 0 ? "accent" : "default"}
          value={formatCurrency(summary.advanceAmount)}
        />
        <SummaryCard
          hint="Open purchases pending settlement"
          label="Open purchases"
          value={summary.openPurchaseCount}
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
        description="Keep supplier payable review compact for accountant visibility and purchase follow-up."
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
        description="Open purchase payables remain visible here so settlement can be recorded against the exact purchase when needed."
        title="Open purchases"
      >
        {openPurchases.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 xl:hidden">
              {openPurchases.map((purchase) => (
                <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-4" key={purchase.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{purchase.purchaseNumber}</p>
                      <p className="mt-1 text-sm text-slate-600">{formatDate(purchase.purchaseDate)}</p>
                    </div>
                    <StatusBadge label={purchase.paymentStatus} />
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Amount", formatCurrency(purchase.grandTotal)],
                      ["Initial paid", formatCurrency(purchase.initialPaidAmount)],
                      ["Allocated", formatCurrency(purchase.allocatedAmount)],
                      ["Due", formatCurrency(purchase.dueAmount)],
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
                    <th className="px-4">Purchase</th>
                    <th className="px-4">Date</th>
                    <th className="px-4">Amount</th>
                    <th className="px-4">Initial paid</th>
                    <th className="px-4">Allocated</th>
                    <th className="px-4">Due</th>
                    <th className="px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {openPurchases.map((purchase) => (
                    <tr className="rounded-3xl bg-slate-50" key={purchase.id}>
                      <td className="rounded-l-3xl px-4 py-4 font-semibold text-slate-950">{purchase.purchaseNumber}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatDate(purchase.purchaseDate)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(purchase.grandTotal)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(purchase.initialPaidAmount)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(purchase.allocatedAmount)}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-amber-700">{formatCurrency(purchase.dueAmount)}</td>
                      <td className="rounded-r-3xl px-4 py-4"><StatusBadge label={purchase.paymentStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState description="This supplier has no open payable purchases right now." title="No open purchases" />
        )}
      </SectionCard>

      <SectionCard
        description="Every ledger movement shows debit, credit, running balance, and source reference for clean payable traceability."
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
                      <p className="mt-1 text-sm text-slate-600">{entry.notes || humanizeLabel(entry.referenceType)}</p>
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
              <table className="min-w-[1220px] w-full border-separate border-spacing-y-3">
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
                      <td className="px-4 py-4 text-sm text-slate-700">{entry.notes || humanizeLabel(entry.referenceType)}</td>
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
          <EmptyState description="Ledger entries will appear here once this supplier has financial activity." title="No ledger entries" />
        )}
      </SectionCard>

      <SupplierPaymentEntryModal
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
