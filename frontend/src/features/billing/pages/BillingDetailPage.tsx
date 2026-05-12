import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { DocumentActionGroup } from "../../documents/components/DocumentActionGroup";
import { useToast } from "../../../hooks/use-toast";
import {
  formatCurrency,
  formatDate,
  humanizeLabel,
} from "../../../lib/utils";
import { hasPermission } from "../../../types/auth";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { billingQueryKeys, getBill, type BillDetailItem } from "../api/billing";
import {
  BillingModuleNav,
  billingModuleButtonClassName,
} from "../components/BillingModuleNav";
import { listSalesReturns, salesReturnsQueryKeys, type SalesReturnListItem } from "../../sales-returns/api/salesReturns";
import { customersQueryKeys } from "../../customers/api/customers";
import {
  accountingQueryKeys,
  createAccountingCustomerPayment,
} from "../../accounting/api/accounting";
import { CustomerPaymentEntryModal } from "../../accounting/components/CustomerPaymentEntryModal";

export const BillingDetailPage = () => {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const user = sessionQuery.data?.user;
  const canCreateBills = hasPermission(user, "billing.create");
  const canCreateSalesReturn = hasPermission(user, "billing.return");
  const canRecordPayments = hasPermission(user, "payments.create");
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const billQuery = useQuery({
    queryKey: billingQueryKeys.detail(id),
    queryFn: () => getBill(id),
  });
  const salesReturnsQuery = useQuery({
    enabled: Boolean(id),
    queryKey: salesReturnsQueryKeys.list({
      saleId: id,
      page: 1,
      pageSize: 5,
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
    queryFn: () =>
      listSalesReturns({
        saleId: id,
        page: 1,
        pageSize: 5,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
  });
  const paymentMutation = useMutation({
    mutationFn: createAccountingCustomerPayment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: billingQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: billingQueryKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: accountingQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: customersQueryKeys.all }),
      ]);
      pushToast({
        title: "Payment recorded",
        description: "Bill due and customer accounting were refreshed successfully.",
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

  if (billQuery.isLoading) {
    return <LoadingState title="Loading bill detail" />;
  }

  if (billQuery.error) {
    return (
      <ErrorState
        description={billQuery.error.message}
        onRetry={() => billQuery.refetch()}
        title="Unable to load bill detail"
      />
    );
  }

  const bill = billQuery.data;
  const relatedReturns = salesReturnsQuery.data?.items ?? [];

  if (!bill) {
    return <EmptyState description="The requested bill could not be found." title="Bill not found" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <BillingModuleNav canCreateBills={canCreateBills} />
            {bill.status === "completed" ? (
              <DocumentActionGroup
                buttonClassName={billingModuleButtonClassName}
                id={bill.id}
                kind="sale-invoice"
                pdfVariant="a4"
                previewVariant="a4"
                printVariant="compact"
              />
            ) : null}
            {canCreateBills && bill.status === "held" ? (
              <Link
                className={billingModuleButtonClassName}
                to={`/app/billing?heldBillId=${bill.id}`}
              >
                Open in POS
              </Link>
            ) : null}
            {canCreateSalesReturn && bill.status === "completed" ? (
              <Link
                className={billingModuleButtonClassName}
                to={`/app/billing/returns/new?saleId=${bill.id}`}
              >
                Create return
              </Link>
            ) : null}
            {canRecordPayments &&
            bill.status === "completed" &&
            bill.customerId &&
            Number(bill.dueAmount) > 0 ? (
              <button
                className={billingModuleButtonClassName}
                onClick={() => setIsPaymentOpen(true)}
                type="button"
              >
                Receive payment
              </button>
            ) : null}
          </>
        }
        eyebrow="Billing / POS"
        title={bill.billNumber}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 [&>article]:p-3.5">
        <SummaryCard
          label="Status"
          value={<StatusBadge label={bill.status} />}
        />
        <SummaryCard
          label="Payment"
          value={<StatusBadge label={bill.paymentStatus} />}
        />
        <SummaryCard
          label="Grand total"
          value={formatCurrency(bill.grandTotal)}
        />
        <SummaryCard
          label="Due amount"
          value={formatCurrency(bill.dueAmount)}
        />
      </div>

      <SectionCard title="Invoice summary">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Customer", bill.customerLabel],
            ["Phone", bill.customerPhone || "Not provided"],
            ["Payment method", humanizeLabel(bill.paymentMethod)],
            ["Created by", bill.createdBy.fullName],
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
      </SectionCard>

      <SectionCard title="Bill items">
        {bill.items.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 xl:hidden">
              {bill.items.map((item: BillDetailItem) => (
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
                        {item.medicine.genericName} • Batch {item.batch.batchNumber}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-950">
                      {formatCurrency(item.lineTotal)}
                    </p>
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Quantity", item.quantity.toString()],
                      ["Rate", formatCurrency(item.rate)],
                      ["GST", `${item.gstPercent}%`],
                      ["Discount", `${item.discountPercent}%`],
                      ["Subtotal", formatCurrency(item.lineSubtotal)],
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
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full table-fixed border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="w-[34%] px-3">Medicine</th>
                    <th className="w-[12%] px-3">Batch</th>
                    <th className="w-[8%] px-3">Qty</th>
                    <th className="w-[14%] px-3">Rate</th>
                    <th className="w-[8%] px-3">GST</th>
                    <th className="w-[10%] px-3">Discount</th>
                    <th className="w-[14%] px-3">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.items.map((item) => (
                    <tr className="rounded-3xl bg-slate-50" key={item.id}>
                      <td className="w-[34%] rounded-l-3xl px-3 py-4">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950">
                            {item.medicine.medicineName}
                          </p>
                          <p className="mt-1 truncate text-sm text-slate-600">
                            {item.medicine.genericName}
                          </p>
                        </div>
                      </td>
                      <td className="w-[12%] px-3 py-4 text-sm text-slate-700">
                        {item.batch.batchNumber}
                      </td>
                      <td className="w-[8%] px-3 py-4 text-sm text-slate-700">{item.quantity}</td>
                      <td className="w-[14%] px-3 py-4 text-sm text-slate-700">
                        {formatCurrency(item.rate)}
                      </td>
                      <td className="w-[8%] px-3 py-4 text-sm text-slate-700">{item.gstPercent}%</td>
                      <td className="w-[10%] px-3 py-4 text-sm text-slate-700">
                        {item.discountPercent}%
                      </td>
                      <td className="w-[14%] rounded-r-3xl px-3 py-4 text-sm font-semibold text-slate-950">
                        {formatCurrency(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            description="This bill does not contain any medicine lines."
            title="No bill items"
          />
        )}
      </SectionCard>

      <SectionCard title="Return history">
        {relatedReturns.length ? (
          <div className="space-y-3">
            {relatedReturns.map((item: SalesReturnListItem) => (
              <div
                className="flex flex-col gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                key={item.id}
              >
                <div className="space-y-1">
                  <Link
                    className="text-sm font-semibold text-slate-950 hover:text-teal-700"
                    to={`/app/billing/returns/${item.id}`}
                  >
                    {item.returnNumber}
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={item.status} />
                  <StatusBadge label={item.refundStatus} />
                  <span className="text-sm font-semibold text-slate-950">
                    {formatCurrency(item.totalReturnAmount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,251,0.96))] px-6 py-10 text-center shadow-[0_24px_58px_-46px_rgba(15,23,42,0.26)]">
            <h3 className="text-base font-semibold text-slate-900">No return history</h3>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Totals">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["Subtotal", formatCurrency(bill.subtotal)],
            ["Discount", formatCurrency(bill.discountAmount)],
            ["Tax", formatCurrency(bill.taxAmount)],
            ["Paid", formatCurrency(bill.paidAmount)],
            ["Grand total", formatCurrency(bill.grandTotal)],
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
      </SectionCard>

      {bill.customerId ? (
        <CustomerPaymentEntryModal
          errorMessage={paymentMutation.error?.message}
          isSubmitting={paymentMutation.isPending}
          onClose={() => setIsPaymentOpen(false)}
          onSubmit={async (payload) => {
            await paymentMutation.mutateAsync(payload);
          }}
          open={isPaymentOpen}
          preset={{
            customerId: bill.customerId,
            customerLabel: `${bill.customerLabel} / ${bill.customerPhone || "No phone"}`,
            saleId: bill.id,
            saleLabel: `${bill.billNumber} / Due ${formatCurrency(bill.dueAmount)} / ${formatDate(bill.completedAt ?? bill.createdAt)}`,
            lockCustomer: true,
            lockSale: true,
          }}
        />
      ) : null}
    </div>
  );
};
