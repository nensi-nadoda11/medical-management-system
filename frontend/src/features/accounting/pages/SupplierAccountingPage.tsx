import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useToast } from "../../../hooks/use-toast";
import { formatCurrency, formatDate, formatDateTime } from "../../../lib/utils";
import { DocumentActionGroup } from "../../documents/components/DocumentActionGroup";
import { purchasesQueryKeys } from "../../purchases/api/purchases";
import { suppliersQueryKeys } from "../../suppliers/api/suppliers";
import { AccountingModuleNav } from "../components/AccountingModuleNav";
import { SupplierPaymentEntryModal } from "../components/SupplierPaymentEntryModal";
import {
  accountingQueryKeys,
  createAccountingSupplierPayment,
  listAccountingSupplierPayments,
  listOutstandingSuppliers,
} from "../api/accounting";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

export const SupplierAccountingPage = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"" | "cash" | "upi" | "card" | "bank_transfer" | "cheque">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentPage, setPaymentPage] = useState(1);
  const [duePage, setDuePage] = useState(1);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const paymentParams = {
    search: deferredSearch || undefined,
    paymentMethod: paymentMethod || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page: paymentPage,
    pageSize: 10,
    sortBy: "paymentDate" as const,
    sortOrder: "desc" as const,
  };
  const dueParams = {
    search: deferredSearch || undefined,
    page: duePage,
    pageSize: 8,
    sortBy: "outstandingAmount" as const,
    sortOrder: "desc" as const,
  };

  const paymentsQuery = useQuery({
    queryKey: accountingQueryKeys.supplierPayments(paymentParams),
    queryFn: () => listAccountingSupplierPayments(paymentParams),
  });
  const dueQuery = useQuery({
    queryKey: accountingQueryKeys.outstandingSuppliers(dueParams),
    queryFn: () => listOutstandingSuppliers(dueParams),
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
        description: "Payables and supplier ledger balances were updated successfully.",
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

  if (paymentsQuery.isLoading || dueQuery.isLoading) {
    return <LoadingState title="Loading supplier accounting" />;
  }

  if (paymentsQuery.error || dueQuery.error) {
    return (
      <ErrorState
        description={paymentsQuery.error?.message ?? dueQuery.error?.message ?? "Unable to load supplier accounting."}
        onRetry={() => {
          paymentsQuery.refetch();
          dueQuery.refetch();
        }}
        title="Unable to load supplier accounting"
      />
    );
  }

  const payments = paymentsQuery.data?.items ?? [];
  const dueSuppliers = dueQuery.data?.items ?? [];
  const visibleOutstanding = dueSuppliers.reduce(
    (sum, item) => sum + Number(item.summary.outstandingAmount),
    0,
  );
  const visibleAdvance = dueSuppliers.reduce(
    (sum, item) => sum + Number(item.summary.advanceAmount),
    0,
  );
  const visiblePayments = payments.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <AccountingModuleNav />
            <button
              className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => setIsPaymentOpen(true)}
              type="button"
            >
              Record supplier payment
            </button>
          </>
        }
        description="Track supplier payables, purchase-wise settlements, and advance balances with compact ledger-ready visibility."
        eyebrow="Accounting / Suppliers"
        title="Supplier payments"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard hint="Suppliers with current payables" label="Suppliers payable" value={dueQuery.data?.pagination.total ?? 0} />
        <SummaryCard hint="Visible payable amount" label="Visible payable" value={formatCurrency(visibleOutstanding)} />
        <SummaryCard hint="Visible supplier advances" label="Visible advance" value={formatCurrency(visibleAdvance)} />
        <SummaryCard hint="Visible payments on this page" label="Visible paid" value={formatCurrency(visiblePayments)} />
      </div>

      <FilterBar
        actions={
          <button
            className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => {
              setSearch("");
              setPaymentMethod("");
              setDateFrom("");
              setDateTo("");
              setPaymentPage(1);
              setDuePage(1);
            }}
            type="button"
          >
            Clear filters
          </button>
        }
        description="Keep supplier accounting compact enough for daily purchase follow-up and accountant review."
        title="Supplier accounting filters"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700 xl:col-span-2">
            Search
            <input
              className={inputClassName}
              onChange={(event) => {
                setSearch(event.target.value);
                setPaymentPage(1);
                setDuePage(1);
              }}
              placeholder="Search supplier, purchase number, reference, or mobile"
              value={search}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Payment method
            <select
              className={inputClassName}
              onChange={(event) => {
                setPaymentMethod(event.target.value as typeof paymentMethod);
                setPaymentPage(1);
              }}
              value={paymentMethod}
            >
              <option value="">All methods</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Date from
            <input
              className={inputClassName}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPaymentPage(1);
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
                setPaymentPage(1);
              }}
              type="date"
              value={dateTo}
            />
          </label>
        </div>
      </FilterBar>

      <SectionCard
        description="Open supplier balances stay visible with direct ledger access for every payable partner."
        title="Outstanding suppliers"
      >
        {dueSuppliers.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 xl:hidden">
              {dueSuppliers.map((item) => (
                <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-4" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link className="text-sm font-semibold text-slate-950 hover:text-teal-700" to={`/app/accounting/suppliers/${item.id}`}>
                        {item.supplierName}
                      </Link>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.companyName || "Independent"} · {item.mobileNumber}
                      </p>
                    </div>
                    <StatusBadge label={item.status} />
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Outstanding", formatCurrency(item.summary.outstandingAmount)],
                      ["Advance", formatCurrency(item.summary.advanceAmount)],
                      ["Open purchases", item.summary.openPurchaseCount.toString()],
                      ["Last purchase", formatDate(item.summary.lastPurchaseDate)],
                    ].map(([label, value]) => (
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5" key={label}>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-3">
                    <DocumentActionGroup
                      compact
                      id={item.id}
                      kind="supplier-receipt"
                      showPreview={false}
                    />
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-[1120px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Supplier</th>
                    <th className="px-4">Mobile</th>
                    <th className="px-4">Open purchases</th>
                    <th className="px-4">Payable</th>
                    <th className="px-4">Advance</th>
                    <th className="px-4">Last purchase</th>
                    <th className="px-4">Status</th>
                    <th className="px-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dueSuppliers.map((item) => (
                    <tr className="rounded-3xl bg-slate-50" key={item.id}>
                      <td className="rounded-l-3xl px-4 py-4">
                        <div>
                          <p className="font-semibold text-slate-950">{item.supplierName}</p>
                          <p className="mt-1 text-sm text-slate-600">{item.companyName || "Independent"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.mobileNumber}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.summary.openPurchaseCount}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-amber-700">{formatCurrency(item.summary.outstandingAmount)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(item.summary.advanceAmount)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatDate(item.summary.lastPurchaseDate)}</td>
                      <td className="px-4 py-4"><StatusBadge label={item.status} /></td>
                      <td className="rounded-r-3xl px-4 py-4">
                        <Link className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white" to={`/app/accounting/suppliers/${item.id}`}>
                          View ledger
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {dueQuery.data?.pagination ? (
              <Pagination
                onPageChange={setDuePage}
                page={dueQuery.data.pagination.page}
                pageSize={dueQuery.data.pagination.pageSize}
                totalItems={dueQuery.data.pagination.total}
                totalPages={dueQuery.data.pagination.totalPages}
              />
            ) : null}
          </div>
        ) : (
          <EmptyState description="No outstanding supplier payables match the current filters." title="No supplier payables found" />
        )}
      </SectionCard>

      <SectionCard
        description="A compact supplier payment register with purchase references and operator visibility."
        title="Supplier payment register"
      >
        {payments.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 xl:hidden">
              {payments.map((item) => (
                <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-4" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{item.supplier.supplierName}</p>
                      <p className="mt-1 text-sm text-slate-600">{formatDateTime(item.paymentDate)}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-950">{formatCurrency(item.amount)}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusBadge label={item.paymentMethod} />
                    <StatusBadge label={item.status} />
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Reference", item.referenceNumber || "Not added"],
                      ["Linked purchase", item.linkedPurchase?.purchaseNumber || (item.allocations.length ? `${item.allocations.length} purchases` : "Advance / general")],
                      ["Paid by", item.paidBy.fullName],
                      ["Notes", item.notes || "Not added"],
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
              <table className="min-w-[1240px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Payment date</th>
                    <th className="px-4">Supplier</th>
                    <th className="px-4">Amount</th>
                    <th className="px-4">Method</th>
                    <th className="px-4">Reference</th>
                    <th className="px-4">Linked purchase</th>
                    <th className="px-4">Status</th>
                    <th className="px-4">Operator</th>
                    <th className="px-4">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((item) => (
                    <tr className="rounded-3xl bg-slate-50" key={item.id}>
                      <td className="rounded-l-3xl px-4 py-4 text-sm text-slate-700">{formatDateTime(item.paymentDate)}</td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-semibold text-slate-950">{item.supplier.supplierName}</p>
                          <p className="mt-1 text-sm text-slate-600">{item.supplier.companyName || "Independent"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-950">{formatCurrency(item.amount)}</td>
                      <td className="px-4 py-4"><StatusBadge label={item.paymentMethod} /></td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.referenceNumber || "Not added"}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {item.linkedPurchase?.purchaseNumber || (item.allocations.length ? `${item.allocations.length} purchases` : "Advance / general")}
                      </td>
                      <td className="px-4 py-4"><StatusBadge label={item.status} /></td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {item.paidBy.fullName}
                      </td>
                      <td className="rounded-r-3xl px-4 py-4">
                        <DocumentActionGroup
                          compact
                          id={item.id}
                          kind="supplier-receipt"
                          showPreview={false}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {paymentsQuery.data?.pagination ? (
              <Pagination
                onPageChange={setPaymentPage}
                page={paymentsQuery.data.pagination.page}
                pageSize={paymentsQuery.data.pagination.pageSize}
                totalItems={paymentsQuery.data.pagination.total}
                totalPages={paymentsQuery.data.pagination.totalPages}
              />
            ) : null}
          </div>
        ) : (
          <EmptyState description="No supplier payments match the current filters." title="No payments found" />
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
