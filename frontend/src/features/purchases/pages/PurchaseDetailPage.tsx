import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { useToast } from "../../../hooks/use-toast";
import { DocumentActionGroup } from "../../documents/components/DocumentActionGroup";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
} from "../../../lib/utils";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { inventoryQueryKeys } from "../../inventory/api/inventory";
import { hasPermission } from "../../../types/auth";
import {
  approvePurchaseOrder,
  cancelPurchase,
  finalizePurchase,
  getPurchase,
  markPurchaseOrderSupplierNotified,
  purchasesQueryKeys,
} from "../api/purchases";

const getPurchaseStatusLabel = (status: "draft" | "finalized" | "cancelled") =>
  status === "draft" ? "open" : status === "finalized" ? "received" : "cancelled";

const getPurchaseWorkflowLabel = (
  workflowStage:
    | "draft"
    | "approved"
    | "supplier_notified"
    | "received"
    | "cancelled",
) => {
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

export const PurchaseDetailPage = () => {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const user = sessionQuery.data?.user;
  const canCreatePurchases = hasPermission(user, "purchases.create");
  const canFinalizePurchases = hasPermission(user, "purchases.finalize");
  const canCreatePurchaseReturn = hasPermission(
    user,
    "purchaseReturns.create",
  );
  const [isFinalizeOpen, setIsFinalizeOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelNotes, setCancelNotes] = useState("");

  const purchaseQuery = useQuery({
    queryKey: purchasesQueryKeys.detail(id),
    queryFn: () => getPurchase(id),
    enabled: Boolean(id),
  });

  const finalizeMutation = useMutation({
    mutationFn: (purchaseId: string) => finalizePurchase(purchaseId),
    onSuccess: async (purchase) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: purchasesQueryKeys.detail(purchase.id),
        }),
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all }),
      ]);
      pushToast({
        title: "Purchase finalized",
        description: "Inventory has been updated with the received batch stock.",
        variant: "success",
      });
      setIsFinalizeOpen(false);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (purchaseId: string) => approvePurchaseOrder(purchaseId),
    onSuccess: async (purchase) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: purchasesQueryKeys.detail(purchase.id),
        }),
      ]);
      pushToast({
        title: "Purchase order approved",
        description: "The purchase order is now locked for review and ready to share with the supplier.",
        variant: "success",
      });
    },
  });

  const supplierNotifiedMutation = useMutation({
    mutationFn: (purchaseId: string) =>
      markPurchaseOrderSupplierNotified(purchaseId),
    onSuccess: async (purchase) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: purchasesQueryKeys.detail(purchase.id),
        }),
      ]);
      pushToast({
        title: "Supplier stage updated",
        description: "The purchase order is now marked as shared with the supplier.",
        variant: "success",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (purchaseId: string) =>
      cancelPurchase(purchaseId, {
        notes: cancelNotes.trim() || undefined,
      }),
    onSuccess: async (purchase) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: purchasesQueryKeys.detail(purchase.id),
        }),
      ]);
      pushToast({
        title: "Purchase cancelled",
        description: "The draft purchase order has been cancelled safely.",
        variant: "success",
      });
      setIsCancelOpen(false);
      setCancelNotes("");
    },
  });

  if (purchaseQuery.isLoading) {
    return <LoadingState title="Loading purchase detail" />;
  }

  if (purchaseQuery.error) {
    return (
      <ErrorState
        description={purchaseQuery.error.message}
        onRetry={() => purchaseQuery.refetch()}
        title="Unable to load purchase"
      />
    );
  }

  if (!purchaseQuery.data) {
    return (
      <ErrorState
        description="The requested purchase could not be found."
        title="Purchase not found"
      />
    );
  }

  const purchase = purchaseQuery.data;
  const isDraft = purchase.status === "draft";
  const canEditDraft = purchase.workflowStage === "draft" && canCreatePurchases;
  const canApprove = purchase.workflowStage === "draft" && canFinalizePurchases;
  const canMarkSupplierNotified =
    purchase.workflowStage === "approved" && canFinalizePurchases;
  const canCancelDraft = isDraft && canFinalizePurchases;
  const canReceiveIntoStock = isDraft && canFinalizePurchases;
  const hasReturnableItems = purchase.items.some(
    (item) => item.remainingReturnableQuantity > 0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Link
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              to="/app/purchases"
            >
              Back to purchase orders
            </Link>
            {purchase.status !== "cancelled" ? (
              <DocumentActionGroup id={purchase.id} kind="purchase" />
            ) : null}
            {canEditDraft ? (
              <Link
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                to={`/app/purchases/${purchase.id}/edit`}
              >
                <Pencil className="h-4 w-4" />
              </Link>
            ) : null}
            {canApprove ? (
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate(purchase.id)}
                type="button"
              >
                Approve purchase order
              </button>
            ) : null}
            {canMarkSupplierNotified ? (
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                disabled={supplierNotifiedMutation.isPending}
                onClick={() => supplierNotifiedMutation.mutate(purchase.id)}
                type="button"
              >
                Mark supplier notified
              </button>
            ) : null}
            {canCancelDraft ? (
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => setIsCancelOpen(true)}
                type="button"
              >
                Cancel purchase order
              </button>
            ) : null}
            {canReceiveIntoStock ? (
              <button
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold !text-white transition hover:bg-slate-800"
                onClick={() => setIsFinalizeOpen(true)}
                type="button"
              >
                Receive into stock
              </button>
            ) : null}
            {!isDraft && canCreatePurchaseReturn && hasReturnableItems ? (
              <Link
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold !text-white transition hover:bg-slate-800"
                to={`/app/purchase-returns/new?purchaseId=${purchase.id}`}
              >
                Create return
              </Link>
            ) : null}
          </>
        }
        description="Review supplier, batch, financial, and stock receipt information in one clean purchase document view."
        eyebrow="Purchase management"
        title={purchase.purchaseNumber}
      />


      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.9fr)]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              hint={getPurchaseWorkflowLabel(purchase.workflowStage)}
              label="Grand total"
              value={formatCurrency(purchase.grandTotal)}
            />
            <SummaryCard
              hint={`Payment: ${purchase.paymentStatus}`}
              label="Paid amount"
              tone={purchase.paymentStatus === "paid" ? "accent" : "default"}
              value={formatCurrency(purchase.paidAmount)}
            />
            <SummaryCard
              hint="Outstanding payable balance"
              label="Due amount"
              tone={Number(purchase.dueAmount) > 0 ? "warning" : "accent"}
              value={formatCurrency(purchase.dueAmount)}
            />
            <SummaryCard
              hint="Completed purchase returns against this purchase"
              label="Returned amount"
              value={formatCurrency(purchase.totalCompletedReturnedAmount)}
            />
          </div>
          <SectionCard
            description="Operational and supplier-facing identifiers for this purchase order or received stock document."
            title="Document overview"
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                [
                  "Supplier invoice number",
                  purchase.supplierInvoiceNumber || "Not provided",
                ],
                ["Supplier invoice date", formatDate(purchase.supplierInvoiceDate)],
                ["Purchase date", formatDate(purchase.purchaseDate)],
                [
                  "Approved on",
                  purchase.purchaseOrderApprovedAt
                    ? formatDateTime(purchase.purchaseOrderApprovedAt)
                    : "Not approved",
                ],
                [
                  "Supplier notified on",
                  purchase.supplierNotifiedAt
                    ? formatDateTime(purchase.supplierNotifiedAt)
                    : "Not marked",
                ],
                [
                  "Finalized on",
                  purchase.finalizedAt
                    ? formatDateTime(purchase.finalizedAt)
                    : "Not received",
                ],
                [
                  "Cancelled on",
                  purchase.cancelledAt ? formatDateTime(purchase.cancelledAt) : "Not cancelled",
                ],
              ].map(([label, value]) => (
                <div
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3"
                  key={label}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-slate-900">{value}</p>
                </div>
              ))}
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Workflow
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
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
              </div>
            </div>
          </SectionCard>

          <SectionCard
            description="Line-level batch information exactly as stored against the purchase."
            title="Purchased items"
          >
            <div className="space-y-4">
              <div className="grid gap-3 lg:hidden">
                {purchase.items.map((item) => (
                  <article
                    className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                    key={item.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {item.medicine.medicineName}
                        </p>
                        <p className="text-sm text-slate-600">
                          {item.medicine.genericName}
                        </p>
                      </div>
                      <StatusBadge label={item.medicine.status} />
                    </div>
                    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[
                        ["Batch", item.batchNumber],
                        ["Expiry", formatDate(item.expiryDate)],
                        ["Quantity", formatNumber(item.quantity)],
                        ["Free quantity", formatNumber(item.freeQuantity)],
                        ["Returned", formatNumber(item.alreadyReturnedQuantity)],
                        ["Returnable", formatNumber(item.remainingReturnableQuantity)],
                        ["Purchase rate", formatCurrency(item.purchaseRate)],
                        ["Sale rate", formatCurrency(item.saleRate)],
                        ["MRP", formatCurrency(item.mrp)],
                        ["GST", `${item.gstPercent}%`],
                        ["Discount", `${item.discountPercent}%`],
                        ["Line total", formatCurrency(item.lineTotal)],
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
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-[1180px] w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <th className="px-4">Medicine</th>
                      <th className="px-4">Batch</th>
                      <th className="px-4">Expiry</th>
                      <th className="px-4">Qty</th>
                      <th className="px-4">Free</th>
                      <th className="px-4">Returned</th>
                      <th className="px-4">Returnable</th>
                      <th className="px-4">Purchase</th>
                      <th className="px-4">Sale</th>
                      <th className="px-4">MRP</th>
                      <th className="px-4">GST</th>
                      <th className="px-4">Discount</th>
                      <th className="px-4">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.items.map((item) => (
                      <tr className="rounded-3xl bg-slate-50" key={item.id}>
                        <td className="rounded-l-3xl px-4 py-4">
                          <div>
                            <p className="font-semibold text-slate-950">
                              {item.medicine.medicineName}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {item.medicine.genericName}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {item.batchNumber}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {formatDate(item.expiryDate)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{item.quantity}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {item.freeQuantity}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {item.alreadyReturnedQuantity}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {item.remainingReturnableQuantity}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {formatCurrency(item.purchaseRate)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {formatCurrency(item.saleRate)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {formatCurrency(item.mrp)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {item.gstPercent}%
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {item.discountPercent}%
                        </td>
                        <td className="rounded-r-3xl px-4 py-4 text-sm font-semibold text-slate-900">
                          {formatCurrency(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard
            description="Supplier contact and purchase-level financials."
            title="Supplier summary"
          >
            <div className="space-y-3">
              {[
                ["Supplier", purchase.supplier.supplierName],
                ["Company", purchase.supplier.companyName || "Not provided"],
                ["Contact person", purchase.supplier.contactPerson || "Not provided"],
                ["Mobile", purchase.supplier.mobileNumber],
                ["Email", purchase.supplier.email || "Not provided"],
              ].map(([label, value]) => (
                <div
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3"
                  key={label}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            description="Backend-calculated totals stored with the purchase."
            title="Financial breakdown"
          >
            <div className="space-y-2.5">
              {[
                ["Subtotal", formatCurrency(purchase.subtotal)],
                ["Discount amount", formatCurrency(purchase.discountAmount)],
                ["Tax amount", formatCurrency(purchase.taxAmount)],
                ["Round off", formatCurrency(purchase.roundOffAmount)],
                ["Grand total", formatCurrency(purchase.grandTotal)],
                ["Paid amount", formatCurrency(purchase.paidAmount)],
                ["Due amount", formatCurrency(purchase.dueAmount)],
              ].map(([label, value], index) => (
                <div
                  className={`flex items-center justify-between rounded-2xl px-3.5 py-3 text-sm ${
                    index === 4
                      ? "bg-slate-950 !text-white"
                      : "border border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                  key={label}
                >
                  <span>{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </SectionCard>

        </div>
      </div>

      <ConfirmDialog
        confirmLabel="Receive stock"
        description="This will receive all purchase-order items into live stock and lock the document against further editing."
        isLoading={finalizeMutation.isPending}
        onClose={() => setIsFinalizeOpen(false)}
        onConfirm={() => finalizeMutation.mutate(purchase.id)}
        open={isFinalizeOpen}
        title="Receive this purchase order?"
      />

      <ConfirmDialog
        confirmLabel="Cancel purchase"
        description="Use cancellation only for draft purchases that should not be posted to inventory."
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
          setIsCancelOpen(false);
          setCancelNotes("");
        }}
        onConfirm={() => cancelMutation.mutate(purchase.id)}
        open={isCancelOpen}
        title="Cancel this purchase?"
        tone="danger"
      />
    </div>
  );
};
