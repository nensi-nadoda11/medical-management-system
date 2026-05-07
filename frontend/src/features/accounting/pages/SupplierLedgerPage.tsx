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
  cn,
  formatCurrency,
  formatDate,
  formatDateTime,
  humanizeLabel,
} from "../../../lib/utils";
import { hasPermission } from "../../../types/auth";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { buildDocumentPreviewPath } from "../../documents/api/documents";
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

const secondaryButtonClassName =
  "rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white";

const getSupplierBalancePresentation = (amount: string) => {
  const numericAmount = Number(amount);

  if (numericAmount < 0) {
    return {
      className: "text-emerald-700",
      label: `Advance ${formatCurrency(Math.abs(numericAmount))}`,
    };
  }

  if (numericAmount > 0) {
    return {
      className: "text-amber-700",
      label: `Payable ${formatCurrency(numericAmount)}`,
    };
  }

  return {
    className: "text-slate-950",
    label: `Settled ${formatCurrency(0)}`,
  };
};

export const SupplierLedgerPage = () => {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const user = sessionQuery.data?.user;
  const canRecordPayments = hasPermission(user, "payments.create");

  const [ledgerPage, setLedgerPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentPreset, setPaymentPreset] = useState<{
    purchaseId?: string;
    purchaseLabel?: string;
    lockPurchase?: boolean;
  } | null>(null);

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
        description: "Supplier ledger, payable amount, and advance balance were refreshed successfully.",
        variant: "success",
      });
      setIsPaymentOpen(false);
      setPaymentPreset(null);
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
  const supplierLabel = `${supplier.supplierName} / ${supplier.companyName || "Independent"} / ${supplier.mobileNumber}`;

  const openPaymentModal = (preset?: typeof paymentPreset) => {
    setPaymentPreset(preset ?? null);
    setIsPaymentOpen(true);
  };

  const renderReference = (referenceType: string, referenceId: string, notes: string | null) => {
    if (referenceType === "purchase") {
      return (
        <Link
          className="font-semibold text-slate-950 hover:text-teal-700"
          to={`/app/purchases/${referenceId}`}
        >
          {notes || "Open purchase"}
        </Link>
      );
    }

    if (referenceType === "purchase_return") {
      return (
        <Link
          className="font-semibold text-slate-950 hover:text-teal-700"
          to={`/app/purchase-returns/${referenceId}`}
        >
          {notes || "Open return"}
        </Link>
      );
    }

    if (referenceType === "supplier_payment") {
      return (
        <a
          className="font-semibold text-slate-950 hover:text-teal-700"
          href={buildDocumentPreviewPath("supplier-receipt", referenceId)}
          rel="noreferrer"
          target="_blank"
        >
          {notes || "Open receipt"}
        </a>
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
              to="/app/accounting/suppliers"
            >
              Back to supplier accounting
            </Link>
            {canRecordPayments ? (
              <button
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={() => openPaymentModal()}
                type="button"
              >
                Record payment
              </button>
            ) : null}
          </>
        }
        description="Single-supplier ledger statement with open purchases, running payable movement, and chronological transaction history for reconciliation."
        eyebrow="Accounting / Supplier Ledger"
        title={supplier.supplierName}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard hint={supplier.companyName || "Independent supplier"} label="Supplier" value={supplier.supplierName} />
        <SummaryCard
          hint="Total purchased from this supplier."
          label="Total purchased"
          value={formatCurrency(summary.totalPurchases)}
        />
        <SummaryCard
          hint="Current supplier payable still pending."
          label="Current payable"
          tone={Number(summary.outstandingAmount) > 0 ? "warning" : "default"}
          value={formatCurrency(summary.outstandingAmount)}
        />
        <SummaryCard
          hint="Extra money currently lying with this supplier as advance."
          label="Advance balance"
          tone={Number(summary.advanceAmount) > 0 ? "accent" : "default"}
          value={formatCurrency(summary.advanceAmount)}
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
        description="Review the statement by date range and switch between newest-first or oldest-first transaction order."
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

      <div id="open-purchases">
        <SectionCard
          description="Open purchase payables stay visible here so settlement can be done against the exact purchase whenever needed."
          title="Open purchases"
        >
          {openPurchases.length ? (
            <div className="space-y-4">
              <div className="grid gap-3 xl:hidden">
                {openPurchases.map((purchase) => (
                  <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-4" key={purchase.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link className="text-sm font-semibold text-slate-950 hover:text-teal-700" to={`/app/purchases/${purchase.id}`}>
                          {purchase.purchaseNumber}
                        </Link>
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
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link className={secondaryButtonClassName} to={`/app/purchases/${purchase.id}`}>
                        Open purchase
                      </Link>
                      {canRecordPayments ? (
                        <button
                          className={secondaryButtonClassName}
                          onClick={() =>
                            openPaymentModal({
                              purchaseId: purchase.id,
                              purchaseLabel: `${purchase.purchaseNumber} / Due ${formatCurrency(purchase.dueAmount)} / ${formatDate(purchase.purchaseDate)}`,
                              lockPurchase: true,
                            })
                          }
                          type="button"
                        >
                          Record payment
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto xl:block">
                <table className="min-w-[1260px] w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <th className="px-4">Purchase</th>
                      <th className="px-4">Date</th>
                      <th className="px-4">Amount</th>
                      <th className="px-4">Initial paid</th>
                      <th className="px-4">Allocated</th>
                      <th className="px-4">Due</th>
                      <th className="px-4">Status</th>
                      <th className="px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openPurchases.map((purchase) => (
                      <tr className="rounded-3xl bg-slate-50" key={purchase.id}>
                        <td className="rounded-l-3xl px-4 py-4">
                          <Link className="font-semibold text-slate-950 hover:text-teal-700" to={`/app/purchases/${purchase.id}`}>
                            {purchase.purchaseNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatDate(purchase.purchaseDate)}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(purchase.grandTotal)}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(purchase.initialPaidAmount)}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(purchase.allocatedAmount)}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-amber-700">{formatCurrency(purchase.dueAmount)}</td>
                        <td className="px-4 py-4"><StatusBadge label={purchase.paymentStatus} /></td>
                        <td className="rounded-r-3xl px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Link className={secondaryButtonClassName} to={`/app/purchases/${purchase.id}`}>
                              Open purchase
                            </Link>
                            {canRecordPayments ? (
                              <button
                                className={secondaryButtonClassName}
                                onClick={() =>
                                  openPaymentModal({
                                    purchaseId: purchase.id,
                                    purchaseLabel: `${purchase.purchaseNumber} / Due ${formatCurrency(purchase.dueAmount)} / ${formatDate(purchase.purchaseDate)}`,
                                    lockPurchase: true,
                                  })
                                }
                                type="button"
                              >
                                Record payment
                              </button>
                            ) : null}
                          </div>
                        </td>
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
      </div>

      <SectionCard
        description="Chronological ledger statement showing purchase, return, payment, payable movement, and running status for audit and reconciliation."
        title="Ledger activity"
      >
        {ledger.items.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 xl:hidden">
              {ledger.items.map((entry) => {
                const balance = getSupplierBalancePresentation(entry.balanceAfter);

                return (
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
                        ["Payable down", formatCurrency(entry.debit), "text-slate-900"],
                        ["Payable up", formatCurrency(entry.credit), "text-slate-900"],
                        ["Running status", balance.label, balance.className],
                        ["Created by", entry.createdBy?.fullName || "System", "text-slate-900"],
                      ].map(([label, value, className]) => (
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5" key={label}>
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</dt>
                          <dd className={cn("mt-1 text-sm font-medium", className)}>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-[1280px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Date</th>
                    <th className="px-4">Transaction</th>
                    <th className="px-4">Reference</th>
                    <th className="px-4">Payable down</th>
                    <th className="px-4">Payable up</th>
                    <th className="px-4">Running status</th>
                    <th className="px-4">Created by</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.items.map((entry) => {
                    const balance = getSupplierBalancePresentation(entry.balanceAfter);

                    return (
                      <tr className="rounded-3xl bg-slate-50" key={entry.id}>
                        <td className="rounded-l-3xl px-4 py-4 text-sm text-slate-700">{formatDateTime(entry.entryDate)}</td>
                        <td className="px-4 py-4"><StatusBadge label={entry.transactionType} /></td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {renderReference(entry.referenceType, entry.referenceId, entry.notes)}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-slate-700">{formatCurrency(entry.debit)}</td>
                        <td className="px-4 py-4 text-sm font-medium text-slate-700">{formatCurrency(entry.credit)}</td>
                        <td className={cn("px-4 py-4 text-sm font-semibold", balance.className)}>{balance.label}</td>
                        <td className="rounded-r-3xl px-4 py-4 text-sm text-slate-700">{entry.createdBy?.fullName || "System"}</td>
                      </tr>
                    );
                  })}
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
        onClose={() => {
          setIsPaymentOpen(false);
          setPaymentPreset(null);
        }}
        onSubmit={async (payload) => {
          await paymentMutation.mutateAsync(payload);
        }}
        open={isPaymentOpen}
        preset={{
          supplierId: supplier.id,
          supplierLabel,
          lockSupplier: true,
          ...paymentPreset,
        }}
      />
    </div>
  );
};
