import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
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
} from "../../../lib/utils";
import { listSuppliers, suppliersQueryKeys } from "../../suppliers/api/suppliers";
import { inventoryQueryKeys } from "../../inventory/api/inventory";
import {
  cancelPurchase,
  finalizePurchase,
  listPurchases,
  purchasesQueryKeys,
} from "../api/purchases";
import type { PurchaseListItem } from "../../../types/purchase";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

export const PurchasesPage = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [search, setSearch] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState<"" | "draft" | "finalized" | "cancelled">("");
  const [paymentStatus, setPaymentStatus] = useState<"" | "unpaid" | "partial" | "paid">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<
    "purchaseDate" | "purchaseNumber" | "createdAt" | "grandTotal"
  >("purchaseDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [finalizeTarget, setFinalizeTarget] = useState<PurchaseListItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PurchaseListItem | null>(null);
  const [cancelNotes, setCancelNotes] = useState("");

  const deferredSearch = useDeferredValue(search);

  const listParams = {
    search: deferredSearch || undefined,
    supplierId: supplierId || undefined,
    status: status || undefined,
    paymentStatus: paymentStatus || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: 10,
    sortBy,
    sortOrder,
  };

  const purchasesQuery = useQuery({
    queryKey: purchasesQueryKeys.list(listParams),
    queryFn: () => listPurchases(listParams),
  });

  const suppliersQuery = useQuery({
    queryKey: suppliersQueryKeys.list({
      page: 1,
      pageSize: 100,
      sortBy: "supplierName",
      sortOrder: "asc",
    }),
    queryFn: () =>
      listSuppliers({
        page: 1,
        pageSize: 100,
        sortBy: "supplierName",
        sortOrder: "asc",
      }),
  });

  const finalizeMutation = useMutation({
    mutationFn: (purchaseId: string) => finalizePurchase(purchaseId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all }),
      ]);
      pushToast({
        title: "Purchase finalized",
        description: "Draft purchase has been finalized and stock is updated.",
        variant: "success",
      });
      setFinalizeTarget(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (purchaseId: string) =>
      cancelPurchase(purchaseId, {
        notes: cancelNotes.trim() || undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all });
      pushToast({
        title: "Purchase cancelled",
        description: "The draft purchase has been cancelled safely.",
        variant: "success",
      });
      setCancelTarget(null);
      setCancelNotes("");
    },
  });

  const activeError = purchasesQuery.error ?? suppliersQuery.error;

  if (purchasesQuery.isLoading || suppliersQuery.isLoading) {
    return <LoadingState title="Loading purchases" />;
  }

  if (activeError) {
    return (
      <ErrorState
        description={activeError.message}
        onRetry={() => {
          purchasesQuery.refetch();
          suppliersQuery.refetch();
        }}
        title="Unable to load purchases"
      />
    );
  }

  const purchases = purchasesQuery.data?.items ?? [];
  const pagination = purchasesQuery.data?.pagination;
  const visibleGrandTotal = purchases.reduce(
    (sum, item) => sum + Number(item.grandTotal),
    0,
  );
  const draftCount = purchases.filter((item) => item.status === "draft").length;
  const finalizedCount = purchases.filter((item) => item.status === "finalized").length;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Link
            className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            to="/app/purchases/new"
          >
            Create purchase
          </Link>
        }
        description="Manage draft, finalized, and cancelled purchase documents with strong visibility into supplier invoices, payment status, and totals."
        eyebrow="Purchase management"
        title="Purchases"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          hint="Total matching purchase records"
          label="Purchases"
          value={pagination?.total ?? 0}
        />
        <SummaryCard
          hint="Draft purchases on this screen"
          label="Drafts visible"
          tone={draftCount > 0 ? "warning" : "default"}
          value={draftCount}
        />
        <SummaryCard
          hint="Finalized purchases on this screen"
          label="Finalized visible"
          tone={finalizedCount > 0 ? "accent" : "default"}
          value={finalizedCount}
        />
        <SummaryCard
          hint="Visible grand total across this page"
          label="Visible value"
          value={formatCurrency(visibleGrandTotal)}
        />
      </div>

      <SectionCard
        description="Use purchases to move from bill entry to stock posting without losing control."
        title="How This Module Works"
      >
        <div className="grid gap-3 md:grid-cols-3">
          {[
            [
              "Draft first",
              "Create or edit a draft while the bill is being checked or stock is still under review.",
            ],
            [
              "Finalize later",
              "Finalize only after medicine rows, batch numbers, expiry dates, and rates are correct.",
            ],
            [
              "Track payment separately",
              "Grand total, paid amount, and due amount are visible here so the operator can review payment status quickly.",
            ],
          ].map(([title, description]) => (
            <article
              className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3.5"
              key={title}
            >
              <p className="text-sm font-semibold text-slate-950">{title}</p>
              <p className="mt-1.5 text-sm leading-5 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </SectionCard>

      <FilterBar
        actions={
          <button
            className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => {
              setSearch("");
              setSupplierId("");
              setStatus("");
              setPaymentStatus("");
              setDateFrom("");
              setDateTo("");
              setSortBy("purchaseDate");
              setSortOrder("desc");
              setPage(1);
            }}
            type="button"
          >
            Clear filters
          </button>
        }
        description="Keep high-use filters visible without crowding the main purchase table."
        title="Purchase filters"
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
              placeholder="Search purchase number or supplier invoice"
              value={search}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Supplier
            <select
              className={inputClassName}
              onChange={(event) => {
                setSupplierId(event.target.value);
                setPage(1);
              }}
              value={supplierId}
            >
              <option value="">All suppliers</option>
              {(suppliersQuery.data?.items ?? []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplierName}
                </option>
              ))}
            </select>
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
              <option value="finalized">Finalized</option>
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
              <option value="purchaseDate">Purchase date</option>
              <option value="purchaseNumber">Purchase number</option>
              <option value="createdAt">Created date</option>
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
        description="Compact purchase visibility for everyday procurement operations."
        title="Purchase register"
      >
        {purchases.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 xl:hidden">
              {purchases.map((purchase) => (
                <article
                  className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                  key={purchase.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-950">
                          {purchase.purchaseNumber}
                        </h3>
                        <StatusBadge label={purchase.status} />
                        <StatusBadge label={purchase.paymentStatus} />
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {purchase.supplier.supplierName}
                      </p>
                    </div>
                    <p className="text-base font-semibold text-slate-950">
                      {formatCurrency(purchase.grandTotal)}
                    </p>
                  </div>

                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      [
                        "Supplier invoice",
                        purchase.supplierInvoiceNumber || "Not provided",
                      ],
                      ["Invoice date", formatDate(purchase.supplierInvoiceDate)],
                      ["Purchase date", formatDate(purchase.purchaseDate)],
                      ["Created", formatDateTime(purchase.createdAt)],
                      [
                        "Finalized",
                        purchase.finalizedAt
                          ? formatDateTime(purchase.finalizedAt)
                          : "Not finalized",
                      ],
                      ["Due", formatCurrency(purchase.dueAmount)],
                    ].map(([label, value]) => (
                      <div
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                        key={label}
                      >
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {label}
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                      to={`/app/purchases/${purchase.id}`}
                    >
                      View
                    </Link>
                    {purchase.status === "draft" ? (
                      <Link
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                        to={`/app/purchases/${purchase.id}/edit`}
                      >
                        Edit
                      </Link>
                    ) : null}
                    {purchase.status === "draft" ? (
                      <button
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                        onClick={() => setFinalizeTarget(purchase)}
                        type="button"
                      >
                        Finalize
                      </button>
                    ) : null}
                    {purchase.status === "draft" ? (
                      <button
                        className="rounded-2xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                        onClick={() => setCancelTarget(purchase)}
                        type="button"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-[1360px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Purchase</th>
                    <th className="px-4">Supplier</th>
                    <th className="px-4">Supplier invoice</th>
                    <th className="px-4">Purchase date</th>
                    <th className="px-4">Status</th>
                    <th className="px-4">Payment</th>
                    <th className="px-4">Grand total</th>
                    <th className="px-4">Created / Finalized</th>
                    <th className="px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => (
                    <tr className="rounded-3xl bg-slate-50" key={purchase.id}>
                      <td className="rounded-l-3xl px-4 py-4">
                        <div>
                          <p className="font-semibold text-slate-950">
                            {purchase.purchaseNumber}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Due {formatCurrency(purchase.dueAmount)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        <div>
                          <p className="font-medium text-slate-900">
                            {purchase.supplier.supplierName}
                          </p>
                          <p className="mt-1 text-slate-600">
                            {purchase.supplier.companyName || purchase.supplier.mobileNumber}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        <div>
                          <p>{purchase.supplierInvoiceNumber || "Not provided"}</p>
                          <p className="mt-1 text-slate-500">
                            {formatDate(purchase.supplierInvoiceDate)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatDate(purchase.purchaseDate)}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={purchase.status} />
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={purchase.paymentStatus} />
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-950">
                        {formatCurrency(purchase.grandTotal)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        <div>
                          <p>{formatDateTime(purchase.createdAt)}</p>
                          <p className="mt-1">
                            {purchase.finalizedAt
                              ? `Finalized ${formatDateTime(purchase.finalizedAt)}`
                              : "Draft not finalized"}
                          </p>
                        </div>
                      </td>
                      <td className="rounded-r-3xl px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                            to={`/app/purchases/${purchase.id}`}
                          >
                            View
                          </Link>
                          {purchase.status === "draft" ? (
                            <Link
                              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                              to={`/app/purchases/${purchase.id}/edit`}
                            >
                              Edit
                            </Link>
                          ) : null}
                          {purchase.status === "draft" ? (
                            <button
                              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                              onClick={() => setFinalizeTarget(purchase)}
                              type="button"
                            >
                              Finalize
                            </button>
                          ) : null}
                          {purchase.status === "draft" ? (
                            <button
                              className="rounded-2xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                              onClick={() => setCancelTarget(purchase)}
                              type="button"
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
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
            action={
              <Link
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                to="/app/purchases/new"
              >
                Create purchase
              </Link>
            }
            description="No purchases match the current filters. Start a new draft purchase, or clear the filters to see more records."
            title="No purchases found"
          />
        )}
      </SectionCard>

      <ConfirmDialog
        confirmLabel="Finalize purchase"
        description="This will post the draft batches into inventory and lock the purchase from further editing."
        isLoading={finalizeMutation.isPending}
        onClose={() => setFinalizeTarget(null)}
        onConfirm={() => {
          if (finalizeTarget) {
            finalizeMutation.mutate(finalizeTarget.id);
          }
        }}
        open={Boolean(finalizeTarget)}
        title={`Finalize ${finalizeTarget?.purchaseNumber ?? "purchase"}?`}
      />

      <ConfirmDialog
        confirmLabel="Cancel purchase"
        description="Draft purchases can be cancelled safely before stock posting."
        extraContent={
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Cancellation notes
            <textarea
              className="min-h-28 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              onChange={(event) => setCancelNotes(event.target.value)}
              placeholder="Optional reason for cancelling this draft"
              value={cancelNotes}
            />
          </label>
        }
        isLoading={cancelMutation.isPending}
        onClose={() => {
          setCancelTarget(null);
          setCancelNotes("");
        }}
        onConfirm={() => {
          if (cancelTarget) {
            cancelMutation.mutate(cancelTarget.id);
          }
        }}
        open={Boolean(cancelTarget)}
        title={`Cancel ${cancelTarget?.purchaseNumber ?? "purchase"}?`}
        tone="danger"
      />
    </div>
  );
};
