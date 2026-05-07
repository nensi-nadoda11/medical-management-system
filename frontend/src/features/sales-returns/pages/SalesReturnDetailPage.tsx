import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { useToast } from "../../../hooks/use-toast";
import { formatCurrency, formatDate, formatDateTime, humanizeLabel } from "../../../lib/utils";
import { hasPermission } from "../../../types/auth";
import { billingQueryKeys } from "../../billing/api/billing";
import { BillingModuleNav } from "../../billing/components/BillingModuleNav";
import { DocumentActionGroup } from "../../documents/components/DocumentActionGroup";
import { useSessionQuery } from "../../auth/hooks/use-session";
import {
  cancelSalesReturn,
  completeSalesReturn,
  getSalesReturn,
  salesReturnsQueryKeys,
} from "../api/salesReturns";

export const SalesReturnDetailPage = () => {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const user = sessionQuery.data?.user;
  const canManageReturns = hasPermission(user, "billing.return");
  const canCreateBills = hasPermission(user, "billing.create");

  const salesReturnQuery = useQuery({
    queryKey: salesReturnsQueryKeys.detail(id),
    queryFn: () => getSalesReturn(id),
  });

  const invalidateRelatedData = async (saleId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: salesReturnsQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.detail(saleId) }),
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.lists() }),
    ]);
  };

  const completeMutation = useMutation({
    mutationFn: completeSalesReturn,
    onSuccess: async (data) => {
      pushToast({
        title: "Sales return completed",
        description: `${data.returnNumber} has been posted successfully.`,
        variant: "success",
      });
      await invalidateRelatedData(data.saleId);
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
    mutationFn: cancelSalesReturn,
    onSuccess: async (data) => {
      pushToast({
        title: "Draft cancelled",
        description: `${data.returnNumber} was cancelled successfully.`,
        variant: "success",
      });
      await invalidateRelatedData(data.saleId);
    },
    onError: (error: Error) => {
      pushToast({
        title: "Unable to cancel draft",
        description: error.message,
        variant: "error",
      });
    },
  });

  if (salesReturnQuery.isLoading) {
    return <LoadingState title="Loading sales return detail" />;
  }

  if (salesReturnQuery.error) {
    return (
      <ErrorState
        description={salesReturnQuery.error.message}
        onRetry={() => salesReturnQuery.refetch()}
        title="Unable to load sales return detail"
      />
    );
  }

  const salesReturn = salesReturnQuery.data;

  if (!salesReturn) {
    return (
      <EmptyState
        description="The requested sales return could not be found."
        title="Return not found"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <BillingModuleNav canCreateBills={canCreateBills} />
            {salesReturn.status === "completed" ? (
              <DocumentActionGroup id={salesReturn.id} kind="sale-return" />
            ) : null}
            <Link
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              to={`/app/billing/${salesReturn.saleId}`}
            >
              View bill
            </Link>
            {canManageReturns && salesReturn.status === "draft" ? (
              <Link
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                to={`/app/billing/returns/${salesReturn.id}/edit`}
              >
                <Pencil className="h-4 w-4" />
              </Link>
            ) : null}
            {canManageReturns && salesReturn.status === "draft" ? (
              <button
                className="rounded-2xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(salesReturn.id)}
                type="button"
              >
                {cancelMutation.isPending ? "Cancelling..." : "Cancel draft"}
              </button>
            ) : null}
            {canManageReturns && salesReturn.status === "draft" ? (
              <button
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={completeMutation.isPending}
                onClick={() => completeMutation.mutate(salesReturn.id)}
                type="button"
              >
                {completeMutation.isPending ? "Completing..." : "Complete return"}
              </button>
            ) : null}
          </>
        }
        description="Review return lifecycle, item-level quantities, and refund visibility without leaving the billing workspace."
        eyebrow="Billing / Sales Returns"
        title={salesReturn.returnNumber}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard hint="Current return status" label="Status" value={<StatusBadge label={salesReturn.status} />} />
        <SummaryCard hint="Refund processing status" label="Refund status" value={<StatusBadge label={salesReturn.refundStatus} />} />
        <SummaryCard hint="Total value of returned lines" label="Return amount" value={formatCurrency(salesReturn.totalReturnAmount)} />
        <SummaryCard hint="Actual refund recorded" label="Refund amount" value={formatCurrency(salesReturn.refundAmount)} />
      </div>

      <SectionCard description="Header-level context for the return and linked bill." title="Return summary">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Bill number", salesReturn.sale.billNumber],
            ["Customer", salesReturn.sale.customerLabel],
            ["Payment method", humanizeLabel(salesReturn.sale.paymentMethod)],
            ["Refund method", salesReturn.refundMethod ? humanizeLabel(salesReturn.refundMethod) : "Not set"],
            ["Created by", salesReturn.createdBy.fullName],
            ["Created at", formatDateTime(salesReturn.createdAt)],
            ["Completed by", salesReturn.completedBy?.fullName ?? "Not completed"],
            ["Completed at", formatDateTime(salesReturn.completedAt)],
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
        {salesReturn.notes ? (
          <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Notes
            </p>
            <p className="mt-1.5 text-sm leading-6 text-slate-700">{salesReturn.notes}</p>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard description="Every return line remains tied to the original bill item and batch." title="Returned items">
        {salesReturn.items.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 xl:hidden">
              {salesReturn.items.map((item) => (
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
                      ["Sold qty", item.soldQuantity.toString()],
                      ["Rate", formatCurrency(item.rate)],
                      ["Expiry", formatDate(item.batch.expiryDate)],
                      ["Reason", item.reason],
                      ["Discount", formatCurrency(item.discountAmount)],
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
                  {item.notes ? (
                    <p className="mt-3 text-sm text-slate-600">{item.notes}</p>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-[1120px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Medicine</th>
                    <th className="px-4">Batch</th>
                    <th className="px-4">Sold qty</th>
                    <th className="px-4">Returned qty</th>
                    <th className="px-4">Rate</th>
                    <th className="px-4">Reason</th>
                    <th className="px-4">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {salesReturn.items.map((item) => (
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
                      <td className="px-4 py-4 text-sm text-slate-700">{item.soldQuantity}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.quantity}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatCurrency(item.rate)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        <div>
                          <p>{item.reason}</p>
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
