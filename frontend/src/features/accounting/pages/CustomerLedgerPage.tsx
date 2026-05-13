import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useToast } from "../../../hooks/use-toast";
import { formatCurrency, formatDate } from "../../../lib/utils";
import { hasPermission } from "../../../types/auth";
import { billingQueryKeys } from "../../billing/api/billing";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { customersQueryKeys } from "../../customers/api/customers";
import {
  accountingQueryKeys,
  createAccountingCustomerPayment,
  getCustomerDueSummary,
} from "../api/accounting";
import { AccountingModuleNav } from "../components/AccountingModuleNav";
import { CustomerPaymentEntryModal } from "../components/CustomerPaymentEntryModal";

const inputClassName =
  "min-w-0 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

const secondaryButtonClassName =
  "rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white";

const getDateValue = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

export const CustomerLedgerPage = () => {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const user = sessionQuery.data?.user;
  const canRecordPayments = hasPermission(user, "payments.create");

  const [draftSearch, setDraftSearch] = useState("");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");
  const [draftSortOrder, setDraftSortOrder] = useState<"asc" | "desc">("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentPreset, setPaymentPreset] = useState<{
    saleId?: string;
    saleLabel?: string;
    lockSale?: boolean;
  } | null>(null);

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
        description: "Customer ledger, due amount, and advance balance were refreshed successfully.",
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

  if (dueSummaryQuery.isLoading) {
    return <LoadingState title="Loading customer ledger" />;
  }

  if (dueSummaryQuery.error || !dueSummaryQuery.data) {
    return (
      <ErrorState
        description={dueSummaryQuery.error?.message ?? "Unable to load customer ledger."}
        onRetry={() => {
          dueSummaryQuery.refetch();
        }}
        title="Unable to load customer ledger"
      />
    );
  }

  const { customer, summary, openSales } = dueSummaryQuery.data;
  const customerLabel = `${customer.fullName} / ${customer.customerCode} / ${customer.mobileNumber}`;
  const hasActiveFilters = Boolean(searchTerm || dateFrom || dateTo || sortOrder !== "desc");

  const filteredOpenSales = [...openSales]
    .filter((sale) => {
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const matchesSearch = normalizedSearch
        ? sale.billNumber.toLowerCase().includes(normalizedSearch)
        : true;
      const saleDateValue = getDateValue(sale.billDate);
      const fromDateValue = dateFrom ? getDateValue(dateFrom) : null;
      const toDateValue = dateTo ? getDateValue(dateTo) : null;
      const matchesFrom =
        fromDateValue !== null && saleDateValue !== null ? saleDateValue >= fromDateValue : true;
      const matchesTo =
        toDateValue !== null && saleDateValue !== null ? saleDateValue <= toDateValue : true;

      return matchesSearch && matchesFrom && matchesTo;
    })
    .sort((leftSale, rightSale) => {
      const leftDateValue = getDateValue(leftSale.billDate) ?? 0;
      const rightDateValue = getDateValue(rightSale.billDate) ?? 0;

      return sortOrder === "asc"
        ? leftDateValue - rightDateValue
        : rightDateValue - leftDateValue;
    });

  const openPaymentModal = (preset?: typeof paymentPreset) => {
    setPaymentPreset(preset ?? null);
    setIsPaymentOpen(true);
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
                onClick={() => openPaymentModal()}
                type="button"
              >
                Record payment
              </button>
            ) : null}
          </>
        }
        className="px-5 py-4 md:px-6 md:py-4"
        title={customer.fullName}
        titleClassName="text-[1.9rem] md:text-[2.1rem]"
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Code",
            value: customer.customerCode,
            valueClassName: "text-slate-950",
          },
          {
            label: "Total billed",
            value: formatCurrency(summary.totalSales),
            valueClassName: "text-slate-950",
          },
          {
            label: "Current due",
            value: formatCurrency(summary.outstandingAmount),
            valueClassName:
              Number(summary.outstandingAmount) > 0 ? "text-amber-700" : "text-slate-950",
          },
          {
            label: "Advance balance",
            value: formatCurrency(summary.advanceAmount),
            valueClassName:
              Number(summary.advanceAmount) > 0 ? "text-emerald-700" : "text-slate-950",
          },
        ].map((item) => (
          <article
            className="rounded-[22px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,255,0.94))] px-5 py-4 shadow-[0_18px_42px_-38px_rgba(15,23,42,0.22)]"
            key={item.label}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {item.label}
            </p>
            <p className={`mt-2 text-[1.6rem] font-semibold tracking-tight ${item.valueClassName}`}>
              {item.value}
            </p>
          </article>
        ))}
      </div>

      <div className="rounded-[24px] border border-white/75 bg-[linear-gradient(180deg,rgba(248,250,255,0.94),rgba(255,255,255,0.98))] p-4 shadow-[0_20px_48px_-40px_rgba(15,23,42,0.2)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
          <input
            className={`${inputClassName} xl:w-[15rem]`}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Search bill"
            type="search"
            value={draftSearch}
          />
          <input
            className={`${inputClassName} xl:w-[11.5rem]`}
            onChange={(event) => setDraftDateFrom(event.target.value)}
            type="date"
            value={draftDateFrom}
          />
          <input
            className={`${inputClassName} xl:w-[11.5rem]`}
            onChange={(event) => setDraftDateTo(event.target.value)}
            type="date"
            value={draftDateTo}
          />
          <select
            className={`${inputClassName} xl:w-[12rem]`}
            onChange={(event) => setDraftSortOrder(event.target.value as "asc" | "desc")}
            value={draftSortOrder}
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => {
                setSearchTerm(draftSearch);
                setDateFrom(draftDateFrom);
                setDateTo(draftDateTo);
                setSortOrder(draftSortOrder);
              }}
              type="button"
            >
              Search
            </button>
            <button
              className="rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => {
                setDraftSearch("");
                setDraftDateFrom("");
                setDraftDateTo("");
                setDraftSortOrder("desc");
                setSearchTerm("");
                setDateFrom("");
                setDateTo("");
                setSortOrder("desc");
              }}
              type="button"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      <div id="open-bills">
        <SectionCard title="Open bills">
          {filteredOpenSales.length ? (
            <div className="space-y-4">
              <div className="grid gap-3 xl:hidden">
                {filteredOpenSales.map((sale) => (
                  <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-4" key={sale.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          className="text-sm font-semibold text-slate-950 hover:text-teal-700"
                          to={`/app/billing/${sale.id}`}
                        >
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
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {label}
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link className={secondaryButtonClassName} to={`/app/billing/${sale.id}`}>
                        Open bill
                      </Link>
                      {canRecordPayments ? (
                        <button
                          className={secondaryButtonClassName}
                          onClick={() =>
                            openPaymentModal({
                              saleId: sale.id,
                              saleLabel: `${sale.billNumber} / Due ${formatCurrency(sale.dueAmount)} / ${formatDate(sale.billDate)}`,
                              lockSale: true,
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

              <div className="ui-subtle-scrollbar hidden overflow-x-auto xl:block">
                <table className="min-w-[1240px] w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <th className="px-4">Bill</th>
                      <th className="px-4">Date</th>
                      <th className="px-4">Net amount</th>
                      <th className="px-4">Returned</th>
                      <th className="px-4">Allocated</th>
                      <th className="px-4">Due</th>
                      <th className="px-4">Status</th>
                      <th className="px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOpenSales.map((sale) => (
                      <tr className="rounded-3xl bg-slate-50" key={sale.id}>
                        <td className="rounded-l-3xl px-4 py-4">
                          <Link
                            className="font-semibold text-slate-950 hover:text-teal-700"
                            to={`/app/billing/${sale.id}`}
                          >
                            {sale.billNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatDate(sale.billDate)}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(sale.netTotal)}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(sale.returnedAmount)}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(sale.allocatedAmount)}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-amber-700">
                          {formatCurrency(sale.dueAmount)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge label={sale.paymentStatus} />
                        </td>
                        <td className="rounded-r-3xl px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Link className={secondaryButtonClassName} to={`/app/billing/${sale.id}`}>
                              Open bill
                            </Link>
                            {canRecordPayments ? (
                              <button
                                className={secondaryButtonClassName}
                                onClick={() =>
                                  openPaymentModal({
                                    saleId: sale.id,
                                    saleLabel: `${sale.billNumber} / Due ${formatCurrency(sale.dueAmount)} / ${formatDate(sale.billDate)}`,
                                    lockSale: true,
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
            <EmptyState
              description={
                hasActiveFilters
                  ? "No open bills match the selected filters."
                  : "This customer has no open receivable bills right now."
              }
              title={hasActiveFilters ? "No matching bills" : "No open bills"}
            />
          )}
        </SectionCard>
      </div>

      <CustomerPaymentEntryModal
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
          customerId: customer.id,
          customerLabel,
          lockCustomer: true,
          ...paymentPreset,
        }}
      />
    </div>
  );
};
