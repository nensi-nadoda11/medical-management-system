import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { FilterBar } from "../../../components/ui/FilterBar";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { useToast } from "../../../hooks/use-toast";
import { formatCurrency, formatDate } from "../../../lib/utils";
import { hasPermission } from "../../../types/auth";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { billingQueryKeys } from "../../billing/api/billing";
import {
  customersQueryKeys,
  listCustomerOptions,
  listCustomerPurchases,
} from "../../customers/api/customers";
import { AccountingModuleNav } from "../components/AccountingModuleNav";
import { CustomerPaymentEntryModal } from "../components/CustomerPaymentEntryModal";
import { SearchableOptionSelect } from "../components/SearchableOptionSelect";
import {
  accountingQueryKeys,
  createAccountingCustomerPayment,
  getCustomerDueSummary,
} from "../api/accounting";

const secondaryButtonClassName =
  "rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white";

type CustomerSelectionOption = {
  id: string;
  customerCode: string;
  fullName: string;
  mobileNumber: string;
};

const buildCustomerLabel = (customer: {
  fullName: string;
  customerCode: string;
  mobileNumber: string;
}) => `${customer.fullName} / ${customer.customerCode} / ${customer.mobileNumber}`;

export const CustomerAccountingPage = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const user = sessionQuery.data?.user;
  const canRecordPayments = hasPermission(user, "payments.create");

  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCustomerLabel, setSelectedCustomerLabel] = useState("");
  const [billPage, setBillPage] = useState(1);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentPreset, setPaymentPreset] = useState<{
    customerId: string;
    customerLabel: string;
    saleId?: string;
    saleLabel?: string;
    lockCustomer?: boolean;
    lockSale?: boolean;
  } | null>(null);
  const deferredSearch = useDeferredValue(search);
  const optionPageSize = 20;

  const customerOptionsQuery = useQuery({
    queryKey: customersQueryKeys.options(deferredSearch, optionPageSize),
    queryFn: () => listCustomerOptions(deferredSearch || undefined, optionPageSize),
  });

  const customerSummaryQuery = useQuery({
    queryKey: accountingQueryKeys.customerSummary(selectedCustomerId),
    queryFn: () => getCustomerDueSummary(selectedCustomerId),
    enabled: Boolean(selectedCustomerId),
  });

  const customerBillsQuery = useQuery({
    queryKey: customersQueryKeys.purchases(selectedCustomerId, {
      page: billPage,
      pageSize: 10,
      sortBy: "billDate",
      sortOrder: "desc",
    }),
    queryFn: () =>
      listCustomerPurchases(selectedCustomerId, {
        page: billPage,
        pageSize: 10,
        sortBy: "billDate",
        sortOrder: "desc",
      }),
    enabled: Boolean(selectedCustomerId),
  });

  const paymentMutation = useMutation({
    mutationFn: createAccountingCustomerPayment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accountingQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: customersQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: billingQueryKeys.all }),
      ]);
      pushToast({
        title: "Customer payment recorded",
        description: "Customer accounting updated successfully.",
        variant: "success",
      });
      setIsPaymentOpen(false);
      setPaymentPreset(null);
    },
    onError: (error: Error) => {
      pushToast({
        title: "Unable to record payment",
        description: error.message,
        variant: "error",
      });
    },
  });

  const handleSelectCustomer = (option: CustomerSelectionOption) => {
    setSelectedCustomerId(option.id);
    setSelectedCustomerLabel(buildCustomerLabel(option));
    setBillPage(1);
  };

  const customerOptions = useMemo<CustomerSelectionOption[]>(() => {
    const items = customerOptionsQuery.data?.items ?? [];

    if (!selectedCustomerId || items.some((item) => item.id === selectedCustomerId)) {
      return items;
    }

    if (customerSummaryQuery.data) {
      return [customerSummaryQuery.data.customer, ...items];
    }

    return [
      {
        id: selectedCustomerId,
        customerCode: "",
        fullName: selectedCustomerLabel || "Selected customer",
        mobileNumber: "",
        city: null,
        status: "active" as const,
        totalDueAmount: "0.00",
        lastPurchaseDate: null,
      },
      ...items,
    ];
  }, [
    customerOptionsQuery.data?.items,
    customerSummaryQuery.data,
    selectedCustomerId,
    selectedCustomerLabel,
  ]);

  const selectedCustomer = customerSummaryQuery.data?.customer ?? null;
  const selectedCustomerDisplayLabel = selectedCustomer
    ? buildCustomerLabel(selectedCustomer)
    : selectedCustomerLabel;

  const openPaymentModal = (preset?: typeof paymentPreset) => {
    if (!selectedCustomerId) {
      return;
    }

    setPaymentPreset(
      preset ?? {
        customerId: selectedCustomerId,
        customerLabel: selectedCustomerDisplayLabel,
        lockCustomer: true,
      },
    );
    setIsPaymentOpen(true);
  };

  if (customerOptionsQuery.isLoading && !customerOptionsQuery.data) {
    return <LoadingState title="Loading customer accounting" />;
  }

  if (customerOptionsQuery.error) {
    return (
      <ErrorState
        description={customerOptionsQuery.error.message}
        onRetry={() => customerOptionsQuery.refetch()}
        title="Unable to load customer accounting"
      />
    );
  }

  const customerSummary = customerSummaryQuery.data?.summary;
  const customerBills = customerBillsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <AccountingModuleNav />
            {canRecordPayments && selectedCustomerId ? (
              <button
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={() => openPaymentModal()}
                type="button"
              >
                Receive payment
              </button>
            ) : null}
          </>
        }
        eyebrow="Accounting / Customers"
        title="Customer Accounting"
      />

      <FilterBar
        actions={
          selectedCustomerId ? (
            <button
              className={secondaryButtonClassName}
              onClick={() => {
                setSelectedCustomerId("");
                setSelectedCustomerLabel("");
                setSearch("");
                setBillPage(1);
              }}
              type="button"
            >
              Clear
            </button>
          ) : null
        }
        contentClassName="border-0 bg-transparent p-0 shadow-none"
        title="Customer"
      >
        <SearchableOptionSelect
          emptyMessage="No customer found."
          isLoading={customerOptionsQuery.isFetching}
          onSearchChange={setSearch}
          onSelect={(value) => {
            const option = customerOptions.find((item) => item.id === value);

            if (!option) {
              setSelectedCustomerId("");
              setSelectedCustomerLabel("");
              setBillPage(1);
              return;
            }

            handleSelectCustomer(option);
          }}
          options={customerOptions.map((item) => ({
            id: item.id,
            label: buildCustomerLabel(item),
          }))}
          placeholder="Select customer"
          search={search}
          searchPlaceholder="Search customer"
          value={selectedCustomerId}
        />
      </FilterBar>

      {!selectedCustomerId ? (
        <EmptyState description="Select customer to view accounting." title="No customer selected" />
      ) : customerSummaryQuery.isLoading || customerBillsQuery.isLoading ? (
        <LoadingState title="Loading customer details" />
      ) : customerSummaryQuery.error || customerBillsQuery.error || !selectedCustomer || !customerSummary ? (
        <ErrorState
          description={
            customerSummaryQuery.error?.message ??
            customerBillsQuery.error?.message ??
            "Unable to load customer details."
          }
          onRetry={() => {
            customerSummaryQuery.refetch();
            customerBillsQuery.refetch();
          }}
          title="Unable to load customer details"
        />
      ) : (
        <>
          <SectionCard
            action={
              canRecordPayments ? (
                <button
                  className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  onClick={() => openPaymentModal()}
                  type="button"
                >
                  Receive payment
                </button>
              ) : null
            }
            title={selectedCustomer.fullName}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={selectedCustomer.status} />
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
                  {selectedCustomer.customerCode}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
                  {selectedCustomer.mobileNumber}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <SummaryCard label="Total billed" value={formatCurrency(customerSummary.totalSales)} />
                <SummaryCard label="Total received" value={formatCurrency(customerSummary.totalPayments)} />
                <SummaryCard
                  label="Due"
                  tone={Number(customerSummary.outstandingAmount) > 0 ? "warning" : "default"}
                  value={formatCurrency(customerSummary.outstandingAmount)}
                />
                <SummaryCard
                  label="Advance"
                  tone={Number(customerSummary.advanceAmount) > 0 ? "accent" : "default"}
                  value={formatCurrency(customerSummary.advanceAmount)}
                />
                <SummaryCard label="Open bills" value={customerSummary.openBillCount} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Bills">
            {customerBills.length ? (
              <div className="space-y-4">
                <div className="grid gap-3 xl:hidden">
                  {customerBills.map((bill) => (
                    <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-4" key={bill.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{bill.billNumber}</p>
                          <p className="mt-1 text-sm text-slate-600">{formatDate(bill.billDate)}</p>
                        </div>
                        <StatusBadge label={bill.paymentStatus} />
                      </div>

                      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                        {[
                          ["Bill amount", formatCurrency(bill.grandTotal)],
                          ["Paid", formatCurrency(bill.paidAmount)],
                          ["Due", formatCurrency(bill.dueAmount)],
                          ["Created by", bill.createdBy.fullName],
                        ].map(([label, value]) => (
                          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5" key={label}>
                            <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {label}
                            </dt>
                            <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
                          </div>
                        ))}
                      </dl>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link className={secondaryButtonClassName} to={`/app/billing/${bill.id}`}>
                          View bill
                        </Link>
                        {canRecordPayments && Number(bill.dueAmount) > 0 ? (
                          <button
                            className={secondaryButtonClassName}
                            onClick={() =>
                              openPaymentModal({
                                customerId: selectedCustomer.id,
                                customerLabel: selectedCustomerDisplayLabel,
                                saleId: bill.id,
                                saleLabel: `${bill.billNumber} / Due ${formatCurrency(bill.dueAmount)} / ${formatDate(bill.billDate)}`,
                                lockCustomer: true,
                                lockSale: true,
                              })
                            }
                            type="button"
                          >
                            Receive
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto xl:block">
                  <table className="min-w-[1180px] w-full border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <th className="px-4">Bill</th>
                        <th className="px-4">Date</th>
                        <th className="px-4">Amount</th>
                        <th className="px-4">Paid</th>
                        <th className="px-4">Due</th>
                        <th className="px-4">Status</th>
                        <th className="px-4">Created by</th>
                        <th className="px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerBills.map((bill) => (
                        <tr className="rounded-3xl bg-slate-50" key={bill.id}>
                          <td className="rounded-l-3xl px-4 py-4 font-semibold text-slate-950">
                            {bill.billNumber}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">{formatDate(bill.billDate)}</td>
                          <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(bill.grandTotal)}</td>
                          <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(bill.paidAmount)}</td>
                          <td className="px-4 py-4 text-sm font-semibold text-amber-700">
                            {formatCurrency(bill.dueAmount)}
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge label={bill.paymentStatus} />
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">{bill.createdBy.fullName}</td>
                          <td className="rounded-r-3xl px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              <Link className={secondaryButtonClassName} to={`/app/billing/${bill.id}`}>
                                View bill
                              </Link>
                              {canRecordPayments && Number(bill.dueAmount) > 0 ? (
                                <button
                                  className={secondaryButtonClassName}
                                  onClick={() =>
                                    openPaymentModal({
                                      customerId: selectedCustomer.id,
                                      customerLabel: selectedCustomerDisplayLabel,
                                      saleId: bill.id,
                                      saleLabel: `${bill.billNumber} / Due ${formatCurrency(bill.dueAmount)} / ${formatDate(bill.billDate)}`,
                                      lockCustomer: true,
                                      lockSale: true,
                                    })
                                  }
                                  type="button"
                                >
                                  Receive
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {customerBillsQuery.data?.pagination ? (
                  <Pagination
                    onPageChange={setBillPage}
                    page={customerBillsQuery.data.pagination.page}
                    pageSize={customerBillsQuery.data.pagination.pageSize}
                    totalItems={customerBillsQuery.data.pagination.total}
                    totalPages={customerBillsQuery.data.pagination.totalPages}
                  />
                ) : null}
              </div>
            ) : (
              <EmptyState description="No bills found for this customer." title="No bills" />
            )}
          </SectionCard>
        </>
      )}

      <CustomerPaymentEntryModal
        errorMessage={paymentMutation.error?.message}
        isSubmitting={paymentMutation.isPending}
        onClose={() => {
          setIsPaymentOpen(false);
          setPaymentPreset(null);
        }}
        onSubmit={async (payload) => {
          await paymentMutation.mutateAsync(payload);
        }}
        open={isPaymentOpen}
        preset={paymentPreset}
      />
    </div>
  );
};
