import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
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
  humanizeLabel,
} from "../../../lib/utils";
import type { CustomerListItem } from "../../../types/customer";
import { useSessionQuery } from "../../auth/hooks/use-session";
import {
  createCustomerPayment,
  customersQueryKeys,
  getCustomer,
  listCustomerPayments,
  listCustomerPurchases,
  updateCustomer,
  updateCustomerStatus,
} from "../api/customers";
import { CustomerFormModal } from "../components/CustomerFormModal";
import { CustomerPaymentModal } from "../components/CustomerPaymentModal";

export const CustomerDetailPage = () => {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const role = sessionQuery.data?.user.role;
  const canEdit = role === "admin" || role === "staff";
  const canUpdateStatus = role === "admin";
  const canRecordPayments = role === "admin" || role === "accountant";

  const [purchasePage, setPurchasePage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: customersQueryKeys.detail(id),
    queryFn: () => getCustomer(id),
    enabled: Boolean(id),
  });

  const purchasesQuery = useQuery({
    queryKey: customersQueryKeys.purchases(id, {
      page: purchasePage,
      pageSize: 10,
      sortBy: "billDate",
      sortOrder: "desc",
    }),
    queryFn: () =>
      listCustomerPurchases(id, {
        page: purchasePage,
        pageSize: 10,
        sortBy: "billDate",
        sortOrder: "desc",
      }),
    enabled: Boolean(id),
  });

  const paymentsQuery = useQuery({
    queryKey: customersQueryKeys.payments(id, {
      page: paymentPage,
      pageSize: 10,
      sortBy: "paymentDate",
      sortOrder: "desc",
    }),
    queryFn: () =>
      listCustomerPayments(id, {
        page: paymentPage,
        pageSize: 10,
        sortBy: "paymentDate",
        sortOrder: "desc",
      }),
    enabled: Boolean(id),
  });

  const updateCustomerMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateCustomer>[1]) => updateCustomer(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customersQueryKeys.all });
      pushToast({
        title: "Customer updated",
        description: "Customer profile has been refreshed successfully.",
        variant: "success",
      });
      setIsEditOpen(false);
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: "active" | "inactive") => updateCustomerStatus(id, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customersQueryKeys.all });
      pushToast({
        title: "Customer status updated",
        description: "Customer availability has been updated successfully.",
        variant: "success",
      });
      setIsStatusConfirmOpen(false);
    },
  });

  const paymentMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createCustomerPayment>[1]) =>
      createCustomerPayment(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: customersQueryKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: customersQueryKeys.purchases(id, {
          page: purchasePage,
          pageSize: 10,
          sortBy: "billDate",
          sortOrder: "desc",
        }) }),
        queryClient.invalidateQueries({ queryKey: customersQueryKeys.payments(id, {
          page: paymentPage,
          pageSize: 10,
          sortBy: "paymentDate",
          sortOrder: "desc",
        }) }),
        queryClient.invalidateQueries({ queryKey: customersQueryKeys.lists() }),
      ]);
      pushToast({
        title: "Payment recorded",
        description: "Customer due balances have been updated successfully.",
        variant: "success",
      });
      setIsPaymentOpen(false);
    },
  });

  if (detailQuery.isLoading) {
    return <LoadingState title="Loading customer profile" />;
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <ErrorState
        description={detailQuery.error?.message ?? "Customer was not found."}
        onRetry={() => detailQuery.refetch()}
        title="Unable to load customer"
      />
    );
  }

  const customer = detailQuery.data;
  const purchases = purchasesQuery.data?.items ?? customer.recentPurchases;
  const payments = paymentsQuery.data?.items ?? customer.recentPayments;
  const dueBills = purchases.filter((bill) => Number(bill.dueAmount) > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Link
              className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              to="/app/customers"
            >
              Back to customers
            </Link>
            {canRecordPayments ? (
              <button
                className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => setIsPaymentOpen(true)}
                type="button"
              >
                Record payment
              </button>
            ) : null}
            {canEdit ? (
              <button
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={() => setIsEditOpen(true)}
                type="button"
              >
                Edit customer
              </button>
            ) : null}
          </>
        }
        description="Customer profile, purchase visibility, and payment history stay together so billing follow-up remains fast and reliable."
        eyebrow="Customer profile"
        title={customer.fullName}
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1.8fr]">
        <SectionCard
          description="Profile details remain compact but ready for daily billing and follow-up work."
          title="Profile summary"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={customer.status} />
              <StatusBadge label={customer.customerCode} tone="default" />
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ["Mobile", customer.mobileNumber],
                ["Alternate mobile", customer.alternateMobileNumber || "Not added"],
                ["Email", customer.email || "Not added"],
                ["Gender", customer.gender ? humanizeLabel(customer.gender) : "Not added"],
                ["Age", customer.age ?? "Not added"],
                ["Date of birth", formatDate(customer.dateOfBirth)],
                [
                  "Location",
                  [customer.city, customer.state].filter(Boolean).join(", ") || "Not added",
                ],
                ["Pincode", customer.pincode || "Not added"],
              ].map(([label, value]) => (
                <div
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                  key={label}
                >
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Address
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {[customer.addressLine1, customer.addressLine2]
                  .filter(Boolean)
                  .join(", ") || "No address added"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Notes
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {customer.notes || "No notes added"}
              </p>
            </div>

            {canUpdateStatus ? (
              <button
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => setIsStatusConfirmOpen(true)}
                type="button"
              >
                {customer.status === "active" ? "Deactivate customer" : "Activate customer"}
              </button>
            ) : null}
          </div>
        </SectionCard>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            hint="Completed bills linked to this customer"
            label="Total bills"
            value={customer.summary.totalBills}
          />
          <SummaryCard
            hint="Lifetime billed value"
            label="Total purchases"
            value={formatCurrency(customer.summary.totalPurchaseAmount)}
          />
          <SummaryCard
            hint="Outstanding amount across completed bills"
            label="Total due"
            tone={Number(customer.summary.totalDueAmount) > 0 ? "warning" : "default"}
            value={formatCurrency(customer.summary.totalDueAmount)}
          />
          <SummaryCard
            hint="Latest completed purchase date"
            label="Last purchase"
            value={formatDate(customer.summary.lastPurchaseDate)}
          />
          <SummaryCard
            hint="Recorded customer receipts"
            label="Payments received"
            value={formatCurrency(customer.summary.totalPaymentsReceived)}
          />
          <SummaryCard
            hint="Most recent recorded payment"
            label="Last payment"
            value={formatDate(customer.summary.lastPaymentDate)}
          />
        </div>
      </div>

      <SectionCard
        description="Previous bills stay easy to review for repeat orders, due follow-up, and service context."
        title="Purchase history"
      >
        {purchasesQuery.isLoading && !purchasesQuery.data ? (
          <LoadingState title="Loading purchase history" />
        ) : purchases.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 lg:hidden">
              {purchases.map((purchase) => (
                <article
                  className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                  key={purchase.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{purchase.billNumber}</p>
                      <p className="mt-1 text-sm text-slate-600">{formatDate(purchase.billDate)}</p>
                    </div>
                    <StatusBadge label={purchase.paymentStatus} />
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Bill amount", formatCurrency(purchase.grandTotal)],
                      ["Paid", formatCurrency(purchase.paidAmount)],
                      ["Due", formatCurrency(purchase.dueAmount)],
                      ["Created by", purchase.createdBy.fullName],
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
                  <Link
                    className="mt-4 inline-flex rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                    to={`/app/billing/${purchase.id}`}
                  >
                    View bill
                  </Link>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[1100px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Bill</th>
                    <th className="px-4">Date</th>
                    <th className="px-4">Amount</th>
                    <th className="px-4">Paid</th>
                    <th className="px-4">Due</th>
                    <th className="px-4">Payment status</th>
                    <th className="px-4">Created by</th>
                    <th className="px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => (
                    <tr className="rounded-3xl bg-slate-50" key={purchase.id}>
                      <td className="rounded-l-3xl px-4 py-4 font-semibold text-slate-950">
                        {purchase.billNumber}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatDate(purchase.billDate)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatCurrency(purchase.grandTotal)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatCurrency(purchase.paidAmount)}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-amber-700">
                        {formatCurrency(purchase.dueAmount)}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={purchase.paymentStatus} />
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {purchase.createdBy.fullName}
                      </td>
                      <td className="rounded-r-3xl px-4 py-4 text-right">
                        <Link
                          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                          to={`/app/billing/${purchase.id}`}
                        >
                          View bill
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {purchasesQuery.data?.pagination ? (
              <Pagination
                onPageChange={setPurchasePage}
                page={purchasesQuery.data.pagination.page}
                pageSize={purchasesQuery.data.pagination.pageSize}
                totalItems={purchasesQuery.data.pagination.total}
                totalPages={purchasesQuery.data.pagination.totalPages}
              />
            ) : null}
          </div>
        ) : (
          <EmptyState
            description="Completed bills for this customer will appear here."
            title="No purchase history yet"
          />
        )}
      </SectionCard>

      <SectionCard
        description="Payment records stay transparent with method, operator, and linked bill allocation details."
        title="Payment history"
      >
        {paymentsQuery.isLoading && !paymentsQuery.data ? (
          <LoadingState title="Loading payment history" />
        ) : payments.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 lg:hidden">
              {payments.map((payment) => (
                <article
                  className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                  key={payment.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {formatCurrency(payment.amount)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatDateTime(payment.paymentDate)}
                      </p>
                    </div>
                    <StatusBadge label={payment.paymentMethod} />
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Reference", payment.referenceNumber || "Not added"],
                      ["Received by", payment.receivedBy.fullName],
                      [
                        "Linked bill",
                        payment.linkedBillNumber ||
                          (payment.allocations.length > 1
                            ? `${payment.allocations.length} bills`
                            : "Auto allocated"),
                      ],
                      ["Notes", payment.notes || "Not added"],
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

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[1150px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Date</th>
                    <th className="px-4">Amount</th>
                    <th className="px-4">Method</th>
                    <th className="px-4">Reference</th>
                    <th className="px-4">Linked bill</th>
                    <th className="px-4">Received by</th>
                    <th className="px-4">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr className="rounded-3xl bg-slate-50" key={payment.id}>
                      <td className="rounded-l-3xl px-4 py-4 text-sm text-slate-700">
                        {formatDateTime(payment.paymentDate)}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-950">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={payment.paymentMethod} />
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {payment.referenceNumber || "Not added"}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {payment.linkedBillNumber ||
                          (payment.allocations.length > 1
                            ? `${payment.allocations.length} bills`
                            : "Auto allocated")}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {payment.receivedBy.fullName}
                      </td>
                      <td className="rounded-r-3xl px-4 py-4 text-sm text-slate-700">
                        {payment.notes || "Not added"}
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
          <EmptyState
            description="Recorded customer receipts will appear here."
            title="No payments recorded yet"
          />
        )}
      </SectionCard>

      <CustomerFormModal
        customer={customer as CustomerListItem}
        errorMessage={updateCustomerMutation.error?.message}
        isSubmitting={updateCustomerMutation.isPending}
        onClose={() => setIsEditOpen(false)}
        onSubmit={async (payload) => {
          await updateCustomerMutation.mutateAsync(payload);
        }}
        open={isEditOpen}
      />

      <CustomerPaymentModal
        dueBills={dueBills}
        errorMessage={paymentMutation.error?.message}
        isSubmitting={paymentMutation.isPending}
        onClose={() => setIsPaymentOpen(false)}
        onSubmit={async (payload) => {
          await paymentMutation.mutateAsync(payload);
        }}
        open={isPaymentOpen}
      />

      <ConfirmDialog
        confirmLabel={customer.status === "active" ? "Deactivate customer" : "Activate customer"}
        description="This updates whether the customer remains available for active billing selection while keeping all history intact."
        isLoading={statusMutation.isPending}
        onClose={() => setIsStatusConfirmOpen(false)}
        onConfirm={() =>
          statusMutation.mutate(customer.status === "active" ? "inactive" : "active")
        }
        open={isStatusConfirmOpen}
        title="Confirm status change"
      />
    </div>
  );
};
