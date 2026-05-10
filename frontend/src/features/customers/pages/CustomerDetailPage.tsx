import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useToast } from "../../../hooks/use-toast";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  humanizeLabel,
} from "../../../lib/utils";
import { hasPermission } from "../../../types/auth";
import type {
  CustomerListItem,
  SaveCustomerPaymentPayload,
} from "../../../types/customer";
import { useSessionQuery } from "../../auth/hooks/use-session";
import {
  accountingQueryKeys,
  createAccountingCustomerPayment,
} from "../../accounting/api/accounting";
import { notificationsQueryKeys } from "../../notifications/api/notifications";
import {
  customersQueryKeys,
  getCustomer,
  listCustomerPayments,
  listCustomerPurchases,
  updateCustomer,
  updateCustomerStatus,
} from "../api/customers";
import { CustomerFormModal } from "../components/CustomerFormModal";
import { CustomerPaymentModal } from "../components/CustomerPaymentModal";

const compactStatCardClassName =
  "min-w-0 rounded-[22px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,255,0.94))] px-4 py-4 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.2)]";

export const CustomerDetailPage = () => {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const user = sessionQuery.data?.user;
  const canEditCustomer = hasPermission(user, "customers.edit");
  const canUpdateStatus = hasPermission(user, "customers.edit");
  const canViewPayments = hasPermission(user, "payments.view");
  const canRecordPayments = hasPermission(user, "payments.create");

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
    enabled: Boolean(id) && canViewPayments,
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
    mutationFn: (payload: SaveCustomerPaymentPayload) =>
      createAccountingCustomerPayment({
        ...payload,
        customerId: id,
      }),
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
        queryClient.invalidateQueries({ queryKey: accountingQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.all }),
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
  const payments = canViewPayments
    ? paymentsQuery.data?.items ?? customer.recentPayments
    : [];
  const dueBills = purchases.filter((bill) => Number(bill.dueAmount) > 0);
  const statCards = [
    { label: "Total bills", value: customer.summary.totalBills },
    {
      label: "Total purchases",
      value: formatCurrency(customer.summary.totalPurchaseAmount),
    },
    {
      label: "Total due",
      tone: Number(customer.summary.totalDueAmount) > 0 ? "warning" : "default",
      value: formatCurrency(customer.summary.totalDueAmount),
    },
    {
      label: "Last purchase",
      value: formatDate(customer.summary.lastPurchaseDate),
    },
    {
      label: "Payments received",
      value: formatCurrency(customer.summary.totalPaymentsReceived),
    },
  ] as const;

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
            {canEditCustomer ? (
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
        eyebrow="Customer profile"
        title={customer.fullName}
      />

      <div className="grid gap-4 xl:grid-cols-[1.18fr_1.82fr]">
        <SectionCard contentClassName="pt-1" title="Profile summary">
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

        <div className="grid auto-rows-min gap-4 md:grid-cols-2 xl:grid-cols-3">
          {statCards.map((card) => (
            <article
              className={`${compactStatCardClassName} ${
                ("tone" in card && card.tone === "warning")
                  ? "border-amber-100 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,255,255,0.94))]"
                  : ""
              }`}
              key={card.label}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {card.label}
              </p>
              <p className="mt-2 break-words text-[1.28rem] font-semibold tracking-tight text-slate-950 md:text-[1.5rem]">
                {card.value}
              </p>
            </article>
          ))}
        </div>
      </div>

      <SectionCard contentClassName="pt-1" title="Purchase history">
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
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,251,0.96))] px-6 py-8 text-center shadow-[0_20px_44px_-40px_rgba(15,23,42,0.22)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm shadow-slate-200/80">
              <span className="text-base font-semibold text-slate-500">i</span>
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">No purchase history yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              Completed bills for this customer will appear here.
            </p>
          </div>
        )}
      </SectionCard>

      {canViewPayments ? (
        <SectionCard contentClassName="pt-1" title="Payment history">
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
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,251,0.96))] px-6 py-8 text-center shadow-[0_20px_44px_-40px_rgba(15,23,42,0.22)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm shadow-slate-200/80">
              <span className="text-base font-semibold text-slate-500">i</span>
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">No payments recorded yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              Recorded customer receipts will appear here.
            </p>
          </div>
        )}
        </SectionCard>
      ) : null}

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
