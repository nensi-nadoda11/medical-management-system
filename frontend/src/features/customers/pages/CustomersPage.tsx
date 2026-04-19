import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

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
import { formatCurrency, formatDate } from "../../../lib/utils";
import type { CustomerListItem } from "../../../types/customer";
import type { MasterStatus } from "../../../types/medicine";
import { useSessionQuery } from "../../auth/hooks/use-session";
import {
  createCustomer,
  customersQueryKeys,
  listCustomers,
  updateCustomer,
  updateCustomerStatus,
} from "../api/customers";
import { CustomerFormModal } from "../components/CustomerFormModal";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

type StatusFilter = MasterStatus | "all";

export const CustomersPage = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const role = sessionQuery.data?.user.role;
  const canEdit = role === "admin" || role === "staff";
  const canUpdateStatus = role === "admin";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<
    "fullName" | "lastPurchaseDate" | "dueAmount" | "updatedAt"
  >("fullName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerListItem | null>(null);
  const [pendingStatusCustomer, setPendingStatusCustomer] =
    useState<CustomerListItem | null>(null);
  const deferredSearch = useDeferredValue(search);

  const customerParams = {
    search: deferredSearch || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    pageSize: 10,
    sortBy,
    sortOrder,
  };

  const customersQuery = useQuery({
    queryKey: customersQueryKeys.list(customerParams),
    queryFn: () => listCustomers(customerParams),
  });

  const customers = customersQuery.data?.items ?? [];
  const pagination = customersQuery.data?.pagination;

  const saveCustomerMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof createCustomer>[0]) => {
      if (editingCustomer) {
        return updateCustomer(editingCustomer.id, payload);
      }

      return createCustomer(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customersQueryKeys.all });
      pushToast({
        title: editingCustomer ? "Customer updated" : "Customer created",
        description: "Customer records have been refreshed successfully.",
        variant: "success",
      });
      setIsFormOpen(false);
      setEditingCustomer(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      customerId,
      status,
    }: {
      customerId: string;
      status: MasterStatus;
    }) => updateCustomerStatus(customerId, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customersQueryKeys.all });
      pushToast({
        title: "Customer status updated",
        description: "Customer availability has been updated successfully.",
        variant: "success",
      });
      setPendingStatusCustomer(null);
    },
  });

  if (customersQuery.isLoading) {
    return <LoadingState title="Loading customers" />;
  }

  if (customersQuery.error) {
    return (
      <ErrorState
        description={customersQuery.error.message}
        onRetry={() => customersQuery.refetch()}
        title="Unable to load customers"
      />
    );
  }

  const summary = {
    totalCustomers: pagination?.total ?? 0,
    activeOnScreen: customers.filter((customer) => customer.status === "active").length,
    visiblePurchaseAmount: customers.reduce(
      (sum, customer) => sum + Number(customer.summary.totalPurchaseAmount),
      0,
    ),
    visibleDueAmount: customers.reduce(
      (sum, customer) => sum + Number(customer.summary.totalDueAmount),
      0,
    ),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          canEdit ? (
            <button
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => {
                setEditingCustomer(null);
                setIsFormOpen(true);
              }}
              type="button"
            >
              Add customer
            </button>
          ) : null
        }
        description="Manage customer master records, repeat-buyer visibility, and due-ready profiles in one compact workspace."
        eyebrow="Customer management"
        title="Customers"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard hint="Total matching customers" label="Customers" value={summary.totalCustomers} />
        <SummaryCard
          hint="Active customers on this page"
          label="Active visible"
          tone={summary.activeOnScreen ? "accent" : "default"}
          value={summary.activeOnScreen}
        />
        <SummaryCard
          hint="Visible purchase value on this page"
          label="Visible purchases"
          value={formatCurrency(summary.visiblePurchaseAmount)}
        />
        <SummaryCard
          hint="Visible outstanding due on this page"
          label="Visible due"
          tone={summary.visibleDueAmount > 0 ? "warning" : "default"}
          value={formatCurrency(summary.visibleDueAmount)}
        />
      </div>

      <SectionCard
        description="Search, filter, and sort customers without turning the screen into a heavy admin grid."
        title="Customer controls"
      >
        <div className="grid gap-4 xl:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))]">
          <label className="grid gap-2 text-sm font-medium text-slate-700 xl:col-span-2">
            Search customers
            <input
              className={inputClassName}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name, code, mobile, or email"
              value={search}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Status
            <select
              className={inputClassName}
              onChange={(event) => {
                setStatusFilter(event.target.value as StatusFilter);
                setPage(1);
              }}
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
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
              <option value="fullName">Customer name</option>
              <option value="lastPurchaseDate">Last purchase</option>
              <option value="dueAmount">Due amount</option>
              <option value="updatedAt">Last updated</option>
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
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
        </div>
      </SectionCard>

      <SectionCard
        description="Customer profiles stay compact but still surface the purchase and due signals the business needs every day."
        title="Customer directory"
      >
        {customers.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 lg:hidden">
              {customers.map((customer) => (
                <article
                  className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                  key={customer.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-950">
                          {customer.fullName}
                        </h3>
                        <StatusBadge label={customer.status} />
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {customer.customerCode} • {customer.mobileNumber}
                      </p>
                    </div>
                    <Link
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                      to={`/app/customers/${customer.id}`}
                    >
                      View
                    </Link>
                  </div>

                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["City", customer.city || "Not added"],
                      ["Total purchases", formatCurrency(customer.summary.totalPurchaseAmount)],
                      ["Due amount", formatCurrency(customer.summary.totalDueAmount)],
                      ["Last purchase", formatDate(customer.summary.lastPurchaseDate)],
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

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {canEdit ? (
                      <button
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                        onClick={() => {
                          setEditingCustomer(customer);
                          setIsFormOpen(true);
                        }}
                        type="button"
                      >
                        Edit
                      </button>
                    ) : null}
                    {canUpdateStatus ? (
                      <button
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                        onClick={() => setPendingStatusCustomer(customer)}
                        type="button"
                      >
                        {customer.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[1180px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Customer</th>
                    <th className="px-4">Code</th>
                    <th className="px-4">Mobile</th>
                    <th className="px-4">City</th>
                    <th className="px-4">Total purchases</th>
                    <th className="px-4">Due amount</th>
                    <th className="px-4">Last purchase</th>
                    <th className="px-4">Status</th>
                    <th className="px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr className="rounded-3xl bg-slate-50" key={customer.id}>
                      <td className="rounded-l-3xl px-4 py-4">
                        <div>
                          <p className="font-semibold text-slate-950">{customer.fullName}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {customer.email || "No email added"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{customer.customerCode}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{customer.mobileNumber}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{customer.city || "Not added"}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatCurrency(customer.summary.totalPurchaseAmount)}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-amber-700">
                        {formatCurrency(customer.summary.totalDueAmount)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatDate(customer.summary.lastPurchaseDate)}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={customer.status} />
                      </td>
                      <td className="rounded-r-3xl px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                            to={`/app/customers/${customer.id}`}
                          >
                            View
                          </Link>
                          {canEdit ? (
                            <button
                              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                              onClick={() => {
                                setEditingCustomer(customer);
                                setIsFormOpen(true);
                              }}
                              type="button"
                            >
                              Edit
                            </button>
                          ) : null}
                          {canUpdateStatus ? (
                            <button
                              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                              onClick={() => setPendingStatusCustomer(customer)}
                              type="button"
                            >
                              {customer.status === "active" ? "Deactivate" : "Activate"}
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
              canEdit ? (
                <button
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  onClick={() => {
                    setEditingCustomer(null);
                    setIsFormOpen(true);
                  }}
                  type="button"
                >
                  Add first customer
                </button>
              ) : null
            }
            description="Start with your repeat buyers and due-sensitive customers so billing and follow-up stay connected."
            title="No customers found"
          />
        )}
      </SectionCard>

      <CustomerFormModal
        customer={editingCustomer}
        errorMessage={saveCustomerMutation.error?.message}
        isSubmitting={saveCustomerMutation.isPending}
        onClose={() => {
          setIsFormOpen(false);
          setEditingCustomer(null);
        }}
        onSubmit={async (payload) => {
          await saveCustomerMutation.mutateAsync(payload);
        }}
        open={isFormOpen}
      />

      <ConfirmDialog
        confirmLabel={
          pendingStatusCustomer?.status === "active"
            ? "Deactivate customer"
            : "Activate customer"
        }
        description="This updates whether the customer remains available for active billing selection while safely keeping history intact."
        isLoading={statusMutation.isPending}
        onClose={() => setPendingStatusCustomer(null)}
        onConfirm={() => {
          if (!pendingStatusCustomer) {
            return;
          }

          statusMutation.mutate({
            customerId: pendingStatusCustomer.id,
            status:
              pendingStatusCustomer.status === "active" ? "inactive" : "active",
          });
        }}
        open={Boolean(pendingStatusCustomer)}
        title="Confirm status change"
      />
    </div>
  );
};
