import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { DocumentActionGroup } from "../../documents/components/DocumentActionGroup";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  humanizeLabel,
} from "../../../lib/utils";
import { hasPermission } from "../../../types/auth";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { billingQueryKeys, getBill, type BillDetailItem } from "../api/billing";
import { BillingModuleNav } from "../components/BillingModuleNav";
import { listSalesReturns, salesReturnsQueryKeys, type SalesReturnListItem } from "../../sales-returns/api/salesReturns";

export const BillingDetailPage = () => {
  const { id = "" } = useParams();
  const sessionQuery = useSessionQuery();
  const user = sessionQuery.data?.user;
  const canCreateBills = hasPermission(user, "billing.create");
  const canCreateSalesReturn = hasPermission(user, "billing.return");

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
                id={bill.id}
                kind="sale-invoice"
                pdfVariant="a4"
                previewVariant="a4"
                printVariant="compact"
              />
            ) : null}
            {canCreateBills && bill.status === "held" ? (
              <Link
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                to={`/app/billing?heldBillId=${bill.id}`}
              >
                Open in POS
              </Link>
            ) : null}
            {canCreateSalesReturn && bill.status === "completed" ? (
              <Link
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                to={`/app/billing/returns/new?saleId=${bill.id}`}
              >
                Create return
              </Link>
            ) : null}
          </>
        }
        description="Review the invoice summary, medicine lines, payment status, and operator details in one clean screen."
        eyebrow="Billing / POS"
        title={bill.billNumber}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          hint="Current bill status"
          label="Status"
          value={<StatusBadge label={bill.status} />}
        />
        <SummaryCard
          hint="Payment collection progress"
          label="Payment"
          value={<StatusBadge label={bill.paymentStatus} />}
        />
        <SummaryCard
          hint="Final bill value"
          label="Grand total"
          value={formatCurrency(bill.grandTotal)}
        />
        <SummaryCard
          hint="Outstanding amount"
          label="Due amount"
          value={formatCurrency(bill.dueAmount)}
        />
      </div>

      <SectionCard
        description="Commercial summary for the bill header."
        title="Invoice summary"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Customer", bill.customerLabel],
            ["Phone", bill.customerPhone || "Not provided"],
            ["Payment method", humanizeLabel(bill.paymentMethod)],
            ["Created by", bill.createdBy.fullName],
            ["Created at", formatDateTime(bill.createdAt)],
            ["Completed at", formatDateTime(bill.completedAt)],
            ["Updated by", bill.updatedBy.fullName],
            ["Updated at", formatDateTime(bill.updatedAt)],
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
        {bill.notes ? (
          <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Notes
            </p>
            <p className="mt-1.5 text-sm leading-6 text-slate-700">{bill.notes}</p>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        description="Medicine lines are preserved batch by batch for clear auditability."
        title="Bill items"
      >
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
                      ["Expiry", formatDate(item.batch.expiryDate)],
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
              <table className="min-w-[1120px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Medicine</th>
                    <th className="px-4">Batch</th>
                    <th className="px-4">Expiry</th>
                    <th className="px-4">Qty</th>
                    <th className="px-4">Rate</th>
                    <th className="px-4">GST</th>
                    <th className="px-4">Discount</th>
                    <th className="px-4">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.items.map((item) => (
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
                        <div className="space-y-2">
                          <p>{item.batch.batchNumber}</p>
                          {item.batch.isNearExpiry ? (
                            <StatusBadge label="near_expiry" />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatDate(item.batch.expiryDate)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.quantity}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatCurrency(item.rate)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.gstPercent}%</td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {item.discountPercent}%
                      </td>
                      <td className="rounded-r-3xl px-4 py-4 text-sm font-semibold text-slate-950">
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

      <SectionCard
        description="Sales return activity linked to this bill stays visible for audit and customer support."
        title="Return history"
      >
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
                  <p className="text-sm text-slate-600">{formatDateTime(item.createdAt)}</p>
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
          <EmptyState
            description="No sales returns have been created for this bill yet."
            title="No return history"
          />
        )}
      </SectionCard>

      <SectionCard description="Commercial totals calculated by the backend." title="Totals">
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
    </div>
  );
};
