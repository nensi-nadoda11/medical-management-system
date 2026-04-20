import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  cancelPurchase,
  finalizePurchase,
  getPurchase,
  purchasesQueryKeys,
} from "../api/purchases";

export const PurchaseDetailPage = () => {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const canCreatePurchaseReturn = hasPermission(
    sessionQuery.data?.user,
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
        description: "Inventory has been updated with the finalized batch stock.",
        variant: "success",
      });
      setIsFinalizeOpen(false);
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
        description: "The draft purchase has been cancelled safely.",
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
              Back to purchases
            </Link>
            {purchase.status === "finalized" ? (
              <DocumentActionGroup id={purchase.id} kind="purchase" />
            ) : null}
            {isDraft ? (
              <Link
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                to={`/app/purchases/${purchase.id}/edit`}
              >
                Edit draft
              </Link>
            ) : null}
            {isDraft ? (
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => setIsCancelOpen(true)}
                type="button"
              >
                Cancel purchase
              </button>
            ) : null}
            {isDraft ? (
              <button
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={() => setIsFinalizeOpen(true)}
                type="button"
              >
                Finalize purchase
              </button>
            ) : null}
            {!isDraft && canCreatePurchaseReturn && hasReturnableItems ? (
              <Link
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                to={`/app/purchase-returns/new?purchaseId=${purchase.id}`}
              >
                Create return
              </Link>
            ) : null}
          </>
        }
        description="Review supplier, batch, financial, and posting information in one clean purchase detail view."
        eyebrow="Purchase management"
        title={purchase.purchaseNumber}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          hint={`Status: ${purchase.status}`}
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
        <SummaryCard
          hint="Total line items in this purchase"
          label="Item rows"
          value={purchase.items.length}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.9fr)]">
        <div className="space-y-5">
          <SectionCard
            description="Operational and supplier-facing identifiers for this purchase."
            title="Purchase overview"
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["Purchase number", purchase.purchaseNumber],
                ["Supplier", purchase.supplier.supplierName],
                [
                  "Supplier invoice number",
                  purchase.supplierInvoiceNumber || "Not provided",
                ],
                ["Supplier invoice date", formatDate(purchase.supplierInvoiceDate)],
                ["Purchase date", formatDate(purchase.purchaseDate)],
                ["Created on", formatDateTime(purchase.createdAt)],
                [
                  "Finalized on",
                  purchase.finalizedAt ? formatDateTime(purchase.finalizedAt) : "Not finalized",
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
                  Status
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge label={purchase.status} />
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
                      ? "bg-slate-950 text-white"
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

          <SectionCard
            description="Return history tied to this finalized purchase."
            title="Return history"
          >
            {purchase.returnHistory.length ? (
              <div className="space-y-3">
                {purchase.returnHistory.map((entry) => (
                  <Link
                    className="block rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 transition hover:border-slate-300 hover:bg-white"
                    key={entry.id}
                    to={`/app/purchase-returns/${entry.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {entry.returnNumber}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {entry.createdBy.fullName} · {formatDateTime(entry.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <StatusBadge label={entry.status} />
                        <p className="mt-2 text-sm font-semibold text-slate-950">
                          {formatCurrency(entry.totalReturnAmount)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-600">
                No purchase returns have been created for this purchase yet.
              </p>
            )}
          </SectionCard>

          <SectionCard
            description="Free-form operational notes saved with the purchase."
            title="Notes"
          >
            <p className="text-sm leading-6 text-slate-600">
              {purchase.notes || "No notes were added for this purchase."}
            </p>
          </SectionCard>
        </div>
      </div>

      <ConfirmDialog
        confirmLabel="Finalize purchase"
        description="This will post all purchase item batches into live stock and lock the purchase against further editing."
        isLoading={finalizeMutation.isPending}
        onClose={() => setIsFinalizeOpen(false)}
        onConfirm={() => finalizeMutation.mutate(purchase.id)}
        open={isFinalizeOpen}
        title="Finalize this draft purchase?"
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
