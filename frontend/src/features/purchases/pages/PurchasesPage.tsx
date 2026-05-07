import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Pencil, Trash2, Eye } from "lucide-react";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { ErrorState } from "../../../components/ui/ErrorState";
import { FilterBar } from "../../../components/ui/FilterBar";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { ResponsiveDataList } from "../../../components/ui/ResponsiveDataList";
import { useToast } from "../../../hooks/use-toast";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from "../../../lib/utils";
import { hasPermission } from "../../../types/auth";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { listSuppliers, suppliersQueryKeys } from "../../suppliers/api/suppliers";
import { inventoryQueryKeys } from "../../inventory/api/inventory";
import {
  approvePurchaseOrder,
  cancelPurchase,
  deletePurchase,
  finalizePurchase,
  listPurchases,
  purchasesQueryKeys,
} from "../api/purchases";
import type { PurchaseListItem } from "../../../types/purchase";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

const getPurchaseStatusLabel = (status: PurchaseListItem["status"]) =>
  status === "draft" ? "open" : status === "finalized" ? "received" : "cancelled";

const getPurchaseWorkflowLabel = (workflowStage: PurchaseListItem["workflowStage"]) => {
  switch (workflowStage) {
    case "approved":
      return "approved";
    case "supplier_notified":
      return "supplier notified";
    case "received":
      return "received";
    case "cancelled":
      return "cancelled";
    default:
      return "draft purchase order";
  }
};

const canDeletePurchase = (
  purchase: Pick<PurchaseListItem, "workflowStage">,
  permissions: string[],
) => {
  const canCreatePurchases = permissions.includes("purchases.create");
  const canFinalizePurchases = permissions.includes("purchases.finalize");

  if (purchase.workflowStage === "draft") {
    return canCreatePurchases || canFinalizePurchases;
  }

  return canFinalizePurchases;
};

export const PurchasesPage = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();

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
  const [deleteTarget, setDeleteTarget] = useState<PurchaseListItem | null>(null);
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
        title: "Purchase order received",
        description: "Draft purchase order has been finalized and stock is updated.",
        variant: "success",
      });
      setFinalizeTarget(null);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (purchaseId: string) => approvePurchaseOrder(purchaseId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all });
      pushToast({
        title: "Purchase order approved",
        description: "The purchase order is now ready to share with the supplier.",
        variant: "success",
      });
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
        title: "Purchase order cancelled",
        description: "The draft purchase order has been cancelled safely.",
        variant: "success",
      });
      setCancelTarget(null);
      setCancelNotes("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (purchaseId: string) => deletePurchase(purchaseId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all }),
      ]);
      pushToast({
        title: "Purchase deleted",
        description: "The purchase record and associated stock have been removed.",
        variant: "success",
      });
      setDeleteTarget(null);
    },
  });

  const activeError = purchasesQuery.error ?? suppliersQuery.error;

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
  const user = sessionQuery.data?.user;
  const permissions = user?.permissions ?? [];
  const canCreatePurchases = hasPermission(user, "purchases.create");
  const canFinalizePurchases = hasPermission(user, "purchases.finalize");
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
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold !text-white transition hover:bg-slate-800"
            to="/app/purchases/new"
          >
            Create purchase order
          </Link>
        }
        description="Manage draft purchase orders, received stock postings, and cancelled supplier documents with clear visibility into invoices, payment status, and totals."
        eyebrow="Purchase management"
        title="Purchase Orders & Receipts"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          hint="Total matching purchase records"
          label="Documents"
          value={pagination?.total ?? 0}
        />
        <SummaryCard
          hint="Draft purchase orders on this screen"
          label="Open POs visible"
          tone={draftCount > 0 ? "warning" : "default"}
          value={draftCount}
        />
        <SummaryCard
          hint="Received purchases on this screen"
          label="Received visible"
          tone={finalizedCount > 0 ? "accent" : "default"}
          value={finalizedCount}
        />
        <SummaryCard
          hint="Visible grand total across this page"
          label="Visible value"
          value={formatCurrency(visibleGrandTotal)}
        />
      </div>

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
        title="Purchase order filters"
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
              <option value="draft">Draft purchase order</option>
              <option value="finalized">Received</option>
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
        title="Purchase order register"
      >
        <ResponsiveDataList
          data={purchases}
          isLoading={purchasesQuery.isLoading}
          keyExtractor={(item) => item.id}
          emptyState={{
            title: "No purchase orders found",
            description: "No purchase documents match the current filters. Start a new draft purchase order or clear filters.",
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
              header: "Purchase",
              accessor: (purchase) => (
                <div>
                  <p className="font-semibold text-slate-950">{purchase.purchaseNumber}</p>
                  <p className="mt-1 text-sm text-slate-600">Due {formatCurrency(purchase.dueAmount)}</p>
                </div>
              ),
              className: "rounded-l-3xl px-4 py-4",
            },
            {
              header: "Supplier",
              accessor: (purchase) => (
                <div>
                  <p className="font-medium text-slate-900">{purchase.supplier.supplierName}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {purchase.supplier.companyName || purchase.supplier.mobileNumber}
                  </p>
                </div>
              ),
            },
            {
              header: "Invoice",
              accessor: (purchase) => (
                <div>
                  <p>{purchase.supplierInvoiceNumber || "Not provided"}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(purchase.supplierInvoiceDate)}</p>
                </div>
              ),
            },
            { header: "Date", accessor: (purchase) => formatDate(purchase.purchaseDate) },
            {
              header: "Workflow",
              accessor: (purchase) => (
                <StatusBadge
                  label={getPurchaseWorkflowLabel(purchase.workflowStage)}
                  tone={purchase.workflowStage}
                />
              ),
            },
            {
              header: "Status",
              accessor: (purchase) => (
                <StatusBadge
                  label={getPurchaseStatusLabel(purchase.status)}
                  tone={purchase.status}
                />
              ),
            },
            { header: "Payment", accessor: (purchase) => <StatusBadge label={purchase.paymentStatus} /> },
            {
              header: "Total",
              accessor: (purchase) => formatCurrency(purchase.grandTotal),
              className: "px-4 py-4 font-semibold text-slate-950",
            },
            {
              header: "Timeline",
              accessor: (purchase) => (
                <div className="text-xs text-slate-500">
                  <p>Created: {formatDateTime(purchase.createdAt)}</p>
                  {purchase.finalizedAt && <p className="mt-1">Received: {formatDateTime(purchase.finalizedAt)}</p>}
                </div>
              ),
            },
            {
              header: "Actions",
              accessor: (purchase) => (
                <div className="flex justify-end items-center gap-2">
                  <Link
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-white"
                    title="View Detail"
                    to={`/app/purchases/${purchase.id}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  
                  {purchase.workflowStage === "draft" && canFinalizePurchases && (
                    <button
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate(purchase.id)}
                      type="button"
                    >
                      Approve
                    </button>
                  )}

                  {purchase.workflowStage === "draft" && canCreatePurchases && (
                    <Link
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-teal-600"
                      title="Edit Purchase"
                      to={`/app/purchases/${purchase.id}/edit`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                  )}

                  {canDeletePurchase(purchase, permissions) ? (
                    <button
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 text-rose-600 transition hover:border-rose-200 hover:bg-rose-50"
                      onClick={() => setDeleteTarget(purchase)}
                      title="Delete Purchase"
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}

                  {purchase.status === "draft" && canFinalizePurchases && (
                    <button
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                      onClick={() => setFinalizeTarget(purchase)}
                      type="button"
                    >
                      Receive
                    </button>
                  )}
                </div>
              ),
              className: "rounded-r-3xl px-4 py-4 text-right",
              headerClassName: "px-4 text-right",
            },
          ]}
          renderCard={(purchase) => (
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
                    <StatusBadge
                      label={getPurchaseWorkflowLabel(purchase.workflowStage)}
                      tone={purchase.workflowStage}
                    />
                    <StatusBadge
                      label={getPurchaseStatusLabel(purchase.status)}
                      tone={purchase.status}
                    />
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

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  to={`/app/purchases/${purchase.id}`}
                >
                  View
                </Link>
                
                {purchase.workflowStage === "draft" && canFinalizePurchases && (
                  <button
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(purchase.id)}
                    type="button"
                  >
                    Approve
                  </button>
                )}

                {purchase.workflowStage === "draft" && canCreatePurchases && (
                  <Link
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-teal-600"
                    title="Edit Purchase"
                    to={`/app/purchases/${purchase.id}/edit`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                )}

                {canDeletePurchase(purchase, permissions) ? (
                  <button
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 text-rose-600 transition hover:border-rose-200 hover:bg-rose-50"
                    onClick={() => setDeleteTarget(purchase)}
                    title="Delete Purchase"
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}

                {purchase.status === "draft" && canFinalizePurchases ? (
                  <>
                    <button
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                      onClick={() => setFinalizeTarget(purchase)}
                      type="button"
                    >
                      Receive
                    </button>
                    <button
                      className="rounded-2xl border border-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                      onClick={() => setCancelTarget(purchase)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          )}
        />
      </SectionCard>

      <ConfirmDialog
        confirmLabel="Receive purchase"
        description="This will post the purchase-order batches into inventory and lock the document from further editing."
        isLoading={finalizeMutation.isPending}
        onClose={() => setFinalizeTarget(null)}
        onConfirm={() => {
          if (finalizeTarget) {
            finalizeMutation.mutate(finalizeTarget.id);
          }
        }}
        open={Boolean(finalizeTarget)}
        title={`Receive ${finalizeTarget?.purchaseNumber ?? "purchase"}?`}
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

      <ConfirmDialog
        confirmLabel="Delete purchase"
        description="This will permanently remove the purchase record. If this was a finalized purchase, it will also reverse the stock postings and financial ledger entries. This action cannot be undone."
        isLoading={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id);
          }
        }}
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.purchaseNumber ?? "purchase"}?`}
        tone="danger"
      />
    </div>
  );
};
