import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
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
import { accountingQueryKeys } from "../../accounting/api/accounting";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { DocumentActionGroup } from "../../documents/components/DocumentActionGroup";
import { inventoryQueryKeys } from "../../inventory/api/inventory";
import { purchasesQueryKeys } from "../../purchases/api/purchases";
import { hasPermission } from "../../../types/auth";
import {
  cancelPurchaseReturn,
  completePurchaseReturn,
  getPurchaseReturn,
  purchaseReturnsQueryKeys,
} from "../api/purchaseReturns";

export const PurchaseReturnDetailPage = () => {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const canEditDraft = hasPermission(
    sessionQuery.data?.user,
    "purchaseReturns.create",
  );
  const canCompleteDraft = hasPermission(
    sessionQuery.data?.user,
    "purchaseReturns.complete",
  );

  const purchaseReturnQuery = useQuery({
    queryKey: purchaseReturnsQueryKeys.detail(id),
    queryFn: () => getPurchaseReturn(id),
  });

  const invalidateRelatedData = async (purchaseId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: purchaseReturnsQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.detail(purchaseId) }),
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: accountingQueryKeys.all }),
    ]);
  };

  const completeMutation = useMutation({
    mutationFn: completePurchaseReturn,
    onSuccess: async (data) => {
      pushToast({
        title: "Purchase return completed",
        description: `${data.returnNumber} has been posted successfully.`,
        variant: "success",
      });
      await invalidateRelatedData(data.purchaseId);
    },
    onError: (error: Error) => {
      pushToast({
        title: "Unable to complete return",
        description: error.message,
        variant: "error",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelPurchaseReturn,
    onSuccess: async (data) => {
      pushToast({
        title: "Draft cancelled",
        description: `${data.returnNumber} was cancelled successfully.`,
        variant: "success",
      });
      await invalidateRelatedData(data.purchaseId);
    },
    onError: (error: Error) => {
      pushToast({
        title: "Unable to cancel draft",
        description: error.message,
        variant: "error",
      });
    },
  });

  if (purchaseReturnQuery.isLoading) {
    return <LoadingState title="Loading purchase return detail" />;
  }

  if (purchaseReturnQuery.error) {
    return (
      <ErrorState
        description={purchaseReturnQuery.error.message}
        onRetry={() => purchaseReturnQuery.refetch()}
        title="Unable to load purchase return detail"
      />
    );
  }

  const purchaseReturn = purchaseReturnQuery.data;

  if (!purchaseReturn) {
    return (
      <EmptyState
        description="The requested purchase return could not be found."
        title="Return not found"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Link
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              to={`/app/purchases/${purchaseReturn.purchaseId}`}
            >
              View purchase
            </Link>
            {purchaseReturn.status === "completed" ? (
              <DocumentActionGroup id={purchaseReturn.id} kind="purchase-return" />
            ) : null}
            {canEditDraft && purchaseReturn.status === "draft" ? (
              <Link
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                to={`/app/purchase-returns/${purchaseReturn.id}/edit`}
              >
                Edit draft
              </Link>
            ) : null}
            {canCompleteDraft && purchaseReturn.status === "draft" ? (
              <button
                className="rounded-2xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(purchaseReturn.id)}
                type="button"
              >
                {cancelMutation.isPending ? "Cancelling..." : "Cancel draft"}
              </button>
            ) : null}
            {canCompleteDraft && purchaseReturn.status === "draft" ? (
              <button
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={completeMutation.isPending}
                onClick={() => completeMutation.mutate(purchaseReturn.id)}
                type="button"
              >
                {completeMutation.isPending ? "Completing..." : "Complete return"}
              </button>
            ) : null}
          </>
        }
        description="Review stock, supplier, and purchase-impact details for this return without leaving the purchase workspace."
        eyebrow="Purchase management"
        title={purchaseReturn.returnNumber}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard hint="Current return status" label="Status" value={<StatusBadge label={purchaseReturn.status} />} />
        <SummaryCard hint="Total value of returned lines" label="Return amount" value={formatCurrency(purchaseReturn.totalReturnAmount)} />
        <SummaryCard hint="Linked purchase" label="Purchase" value={purchaseReturn.purchase.purchaseNumber} />
        <SummaryCard hint="Supplier on the original purchase" label="Supplier" value={purchaseReturn.supplier.supplierName} />
      </div>

      <SectionCard description="Header-level context for the return and linked purchase." title="Return summary">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Purchase number", purchaseReturn.purchase.purchaseNumber],
            ["Supplier", purchaseReturn.supplier.supplierName],
            ["Purchase date", formatDate(purchaseReturn.purchase.purchaseDate)],
            ["Payment status", humanizeLabel(purchaseReturn.purchase.paymentStatus)],
            ["Created by", purchaseReturn.createdBy.fullName],
            ["Created at", formatDateTime(purchaseReturn.createdAt)],
            ["Completed by", purchaseReturn.completedBy?.fullName ?? "Not completed"],
            ["Completed at", formatDateTime(purchaseReturn.completedAt)],
          ].map(([label, value]) => (
            <div
              className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3"
              key={label}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {label}
              </p>
              <p className="mt-1.5 text-sm font-semibold text-slate-950">{value}</p>
            </div>
          ))}
        </div>
        {purchaseReturn.notes ? (
          <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Notes
            </p>
            <p className="mt-1.5 text-sm leading-6 text-slate-700">{purchaseReturn.notes}</p>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard description="Every return line remains tied to the original purchase item and original batch." title="Returned items">
        {purchaseReturn.items.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 xl:hidden">
              {purchaseReturn.items.map((item) => (
                <article
                  className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">
                        {item.medicine.medicineName}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.medicine.genericName} · Batch {item.batch.batchNumber}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-950">
                      {formatCurrency(item.lineReturnAmount)}
                    </p>
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Returned qty", item.quantity.toString()],
                      ["Purchased qty", item.purchasedQuantity.toString()],
                      ["Free qty", item.freeQuantity.toString()],
                      ["Rate", formatCurrency(item.purchaseRate)],
                      ["Expiry", formatDate(item.batch.expiryDate)],
                      ["Reason", humanizeLabel(item.reason)],
                    ].map(([label, value]) => (
                      <div
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                        key={label}
                      >
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {label}
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {item.notes ? <p className="mt-3 text-sm text-slate-600">{item.notes}</p> : null}
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-[1160px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Medicine</th>
                    <th className="px-4">Batch</th>
                    <th className="px-4">Purchased</th>
                    <th className="px-4">Returned</th>
                    <th className="px-4">Rate</th>
                    <th className="px-4">Reason</th>
                    <th className="px-4">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseReturn.items.map((item) => (
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
                        <div>
                          <p>{item.batch.batchNumber}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(item.batch.expiryDate)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {item.purchasedQuantity}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.quantity}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatCurrency(item.purchaseRate)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        <div>
                          <p>{humanizeLabel(item.reason)}</p>
                          {item.notes ? (
                            <p className="mt-1 text-xs text-slate-500">{item.notes}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="rounded-r-3xl px-4 py-4 text-sm font-semibold text-slate-950">
                        {formatCurrency(item.lineReturnAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            description="This return does not contain any line items."
            title="No returned items"
          />
        )}
      </SectionCard>
    </div>
  );
};
