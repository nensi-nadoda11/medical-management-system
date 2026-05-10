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
import { purchasesQueryKeys, listPurchases } from "../../purchases/api/purchases";
import { suppliersQueryKeys } from "../../suppliers/api/suppliers";
import { AccountingModuleNav } from "../components/AccountingModuleNav";
import { SearchableOptionSelect } from "../components/SearchableOptionSelect";
import { SupplierPaymentEntryModal } from "../components/SupplierPaymentEntryModal";
import {
  accountingQueryKeys,
  createAccountingSupplierPayment,
  getSupplierDueSummary,
  listAccountingSupplierOptions,
} from "../api/accounting";

const secondaryButtonClassName =
  "rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white";

type SupplierSelectionOption = {
  id: string;
  supplierName: string;
  companyName: string | null;
  mobileNumber: string;
};

const buildSupplierLabel = (supplier: {
  supplierName: string;
  companyName: string | null;
  mobileNumber: string;
}) => `${supplier.supplierName} / ${supplier.companyName || "Independent"} / ${supplier.mobileNumber}`;

export const SupplierAccountingPage = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const user = sessionQuery.data?.user;
  const canRecordPayments = hasPermission(user, "payments.create");

  const [search, setSearch] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedSupplierLabel, setSelectedSupplierLabel] = useState("");
  const [purchasePage, setPurchasePage] = useState(1);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentPreset, setPaymentPreset] = useState<{
    supplierId: string;
    supplierLabel: string;
    purchaseId?: string;
    purchaseLabel?: string;
    lockSupplier?: boolean;
    lockPurchase?: boolean;
  } | null>(null);
  const deferredSearch = useDeferredValue(search);
  const optionPageSize = 20;

  const supplierOptionsQuery = useQuery({
    queryKey: accountingQueryKeys.supplierOptions(deferredSearch, optionPageSize),
    queryFn: () => listAccountingSupplierOptions(deferredSearch || undefined, optionPageSize),
  });

  const supplierSummaryQuery = useQuery({
    queryKey: accountingQueryKeys.supplierSummary(selectedSupplierId),
    queryFn: () => getSupplierDueSummary(selectedSupplierId),
    enabled: Boolean(selectedSupplierId),
  });

  const supplierPurchasesQuery = useQuery({
    queryKey: purchasesQueryKeys.list({
      supplierId: selectedSupplierId,
      status: "finalized",
      page: purchasePage,
      pageSize: 10,
      sortBy: "purchaseDate",
      sortOrder: "desc",
    }),
    queryFn: () =>
      listPurchases({
        supplierId: selectedSupplierId,
        status: "finalized",
        page: purchasePage,
        pageSize: 10,
        sortBy: "purchaseDate",
        sortOrder: "desc",
      }),
    enabled: Boolean(selectedSupplierId),
  });

  const paymentMutation = useMutation({
    mutationFn: createAccountingSupplierPayment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accountingQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all }),
      ]);
      pushToast({
        title: "Supplier payment recorded",
        description: "Supplier accounting updated successfully.",
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

  const handleSelectSupplier = (option: SupplierSelectionOption) => {
    setSelectedSupplierId(option.id);
    setSelectedSupplierLabel(buildSupplierLabel(option));
    setPurchasePage(1);
  };

  const supplierOptions = useMemo<SupplierSelectionOption[]>(() => {
    const items = supplierOptionsQuery.data?.items ?? [];

    if (!selectedSupplierId || items.some((item) => item.id === selectedSupplierId)) {
      return items;
    }

    if (supplierSummaryQuery.data) {
      return [supplierSummaryQuery.data.supplier, ...items];
    }

    return [
      {
        id: selectedSupplierId,
        supplierName: selectedSupplierLabel || "Selected supplier",
        companyName: null,
        mobileNumber: "",
        status: "active" as const,
        openingBalance: "0.00",
      },
      ...items,
    ];
  }, [
    selectedSupplierId,
    selectedSupplierLabel,
    supplierOptionsQuery.data?.items,
    supplierSummaryQuery.data,
  ]);

  const selectedSupplier = supplierSummaryQuery.data?.supplier ?? null;
  const selectedSupplierDisplayLabel = selectedSupplier
    ? buildSupplierLabel(selectedSupplier)
    : selectedSupplierLabel;

  const openPaymentModal = (preset?: typeof paymentPreset) => {
    if (!selectedSupplierId) {
      return;
    }

    setPaymentPreset(
      preset ?? {
        supplierId: selectedSupplierId,
        supplierLabel: selectedSupplierDisplayLabel,
        lockSupplier: true,
      },
    );
    setIsPaymentOpen(true);
  };

  if (supplierOptionsQuery.isLoading && !supplierOptionsQuery.data) {
    return <LoadingState title="Loading supplier accounting" />;
  }

  if (supplierOptionsQuery.error) {
    return (
      <ErrorState
        description={supplierOptionsQuery.error.message}
        onRetry={() => supplierOptionsQuery.refetch()}
        title="Unable to load supplier accounting"
      />
    );
  }

  const supplierSummary = supplierSummaryQuery.data?.summary;
  const supplierPurchases = supplierPurchasesQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <AccountingModuleNav />
            {canRecordPayments && selectedSupplierId ? (
              <button
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={() => openPaymentModal()}
                type="button"
              >
                Pay supplier
              </button>
            ) : null}
          </>
        }
        className="px-5 py-4 md:px-6 md:py-4"
        title="Supplier Accounting"
      />

      <FilterBar
        actions={
          selectedSupplierId ? (
            <button
              className={secondaryButtonClassName}
              onClick={() => {
                setSelectedSupplierId("");
                setSelectedSupplierLabel("");
                setSearch("");
                setPurchasePage(1);
              }}
              type="button"
            >
              Clear
            </button>
          ) : null
        }
        className="p-3.5 md:p-4"
        contentClassName="border-0 bg-transparent p-0 shadow-none"
        title="Supplier"
      >
        <SearchableOptionSelect
          emptyMessage="No supplier found."
          isLoading={supplierOptionsQuery.isFetching}
          onSearchChange={setSearch}
          onSelect={(value) => {
            const option = supplierOptions.find((item) => item.id === value);

            if (!option) {
              setSelectedSupplierId("");
              setSelectedSupplierLabel("");
              setPurchasePage(1);
              return;
            }

            handleSelectSupplier(option);
          }}
          options={supplierOptions.map((item) => ({
            id: item.id,
            label: buildSupplierLabel(item),
          }))}
          placeholder="Select supplier"
          search={search}
          searchPlaceholder="Search supplier"
          value={selectedSupplierId}
        />
      </FilterBar>

      {!selectedSupplierId ? (
        <EmptyState description="Select supplier to view accounting." title="No supplier selected" />
      ) : supplierSummaryQuery.isLoading || supplierPurchasesQuery.isLoading ? (
        <LoadingState title="Loading supplier details" />
      ) : supplierSummaryQuery.error || supplierPurchasesQuery.error || !selectedSupplier || !supplierSummary ? (
        <ErrorState
          description={
            supplierSummaryQuery.error?.message ??
            supplierPurchasesQuery.error?.message ??
            "Unable to load supplier details."
          }
          onRetry={() => {
            supplierSummaryQuery.refetch();
            supplierPurchasesQuery.refetch();
          }}
          title="Unable to load supplier details"
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
                  Pay supplier
                </button>
              ) : null
            }
            title={selectedSupplier.supplierName}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={selectedSupplier.status} />
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
                  {selectedSupplier.companyName || "Independent"}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
                  {selectedSupplier.mobileNumber}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <SummaryCard label="Total purchased" value={formatCurrency(supplierSummary.totalPurchases)} />
                <SummaryCard label="Total paid" value={formatCurrency(supplierSummary.totalPayments)} />
                <SummaryCard
                  label="Due"
                  tone={Number(supplierSummary.outstandingAmount) > 0 ? "warning" : "default"}
                  value={formatCurrency(supplierSummary.outstandingAmount)}
                />
                <SummaryCard
                  label="Advance"
                  tone={Number(supplierSummary.advanceAmount) > 0 ? "accent" : "default"}
                  value={formatCurrency(supplierSummary.advanceAmount)}
                />
                <SummaryCard label="Open purchases" value={supplierSummary.openPurchaseCount} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Recent purchases">
            {supplierPurchases.length ? (
              <div className="space-y-4">
                <div className="grid gap-3 xl:hidden">
                  {supplierPurchases.map((purchase) => (
                    <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-4" key={purchase.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{purchase.purchaseNumber}</p>
                          <p className="mt-1 text-sm text-slate-600">{formatDate(purchase.purchaseDate)}</p>
                        </div>
                        <StatusBadge label={purchase.paymentStatus} />
                      </div>

                      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                        {[
                          ["Amount", formatCurrency(purchase.grandTotal)],
                          ["Paid", formatCurrency(purchase.paidAmount)],
                          ["Due", formatCurrency(purchase.dueAmount)],
                          ["Status", purchase.status],
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
                        <Link className={secondaryButtonClassName} to={`/app/purchases/${purchase.id}`}>
                          View purchase
                        </Link>
                        {canRecordPayments && Number(purchase.dueAmount) > 0 ? (
                          <button
                            className={secondaryButtonClassName}
                            onClick={() =>
                              openPaymentModal({
                                supplierId: selectedSupplier.id,
                                supplierLabel: selectedSupplierDisplayLabel,
                                purchaseId: purchase.id,
                                purchaseLabel: `${purchase.purchaseNumber} / Due ${formatCurrency(purchase.dueAmount)} / ${formatDate(purchase.purchaseDate)}`,
                                lockSupplier: true,
                                lockPurchase: true,
                              })
                            }
                            type="button"
                          >
                            Pay now
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto xl:block">
                  <table className="min-w-[1240px] w-full border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <th className="px-4">Purchase</th>
                        <th className="px-4">Date</th>
                        <th className="px-4">Amount</th>
                        <th className="px-4">Paid</th>
                        <th className="px-4">Due</th>
                        <th className="px-4">Payment</th>
                        <th className="px-4">Status</th>
                        <th className="px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierPurchases.map((purchase) => (
                        <tr className="rounded-3xl bg-slate-50" key={purchase.id}>
                          <td className="rounded-l-3xl px-4 py-4 font-semibold text-slate-950">
                            {purchase.purchaseNumber}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">{formatDate(purchase.purchaseDate)}</td>
                          <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(purchase.grandTotal)}</td>
                          <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(purchase.paidAmount)}</td>
                          <td className="px-4 py-4 text-sm font-semibold text-amber-700">
                            {formatCurrency(purchase.dueAmount)}
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge label={purchase.paymentStatus} />
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge label={purchase.status} />
                          </td>
                          <td className="rounded-r-3xl px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              <Link className={secondaryButtonClassName} to={`/app/purchases/${purchase.id}`}>
                                View purchase
                              </Link>
                              {canRecordPayments && Number(purchase.dueAmount) > 0 ? (
                                <button
                                  className={secondaryButtonClassName}
                                  onClick={() =>
                                    openPaymentModal({
                                      supplierId: selectedSupplier.id,
                                      supplierLabel: selectedSupplierDisplayLabel,
                                      purchaseId: purchase.id,
                                      purchaseLabel: `${purchase.purchaseNumber} / Due ${formatCurrency(purchase.dueAmount)} / ${formatDate(purchase.purchaseDate)}`,
                                      lockSupplier: true,
                                      lockPurchase: true,
                                    })
                                  }
                                  type="button"
                                >
                                  Pay now
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {supplierPurchasesQuery.data?.pagination ? (
                  <Pagination
                    onPageChange={setPurchasePage}
                    page={supplierPurchasesQuery.data.pagination.page}
                    pageSize={supplierPurchasesQuery.data.pagination.pageSize}
                    totalItems={supplierPurchasesQuery.data.pagination.total}
                    totalPages={supplierPurchasesQuery.data.pagination.totalPages}
                  />
                ) : null}
              </div>
            ) : (
              <EmptyState description="No purchases found for this supplier." title="No purchases" />
            )}
          </SectionCard>
        </>
      )}

      <SupplierPaymentEntryModal
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
