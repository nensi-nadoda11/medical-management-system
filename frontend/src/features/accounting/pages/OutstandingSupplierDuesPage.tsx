import { useDeferredValue, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeIndianRupee, Building2, ReceiptText } from "lucide-react";
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
import { formatCurrency, formatDate } from "../../../lib/utils";
import { AccountingModuleNav } from "../components/AccountingModuleNav";
import { accountingQueryKeys, listOutstandingSuppliers } from "../api/accounting";

const pageSize = 10;

type SupplierDueSortBy = "supplierName" | "outstandingAmount" | "lastPurchaseDate";
type SortOrder = "asc" | "desc";

export const OutstandingSupplierDuesPage = () => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SupplierDueSortBy>("outstandingAmount");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, sortBy, sortOrder]);

  const outstandingSuppliersQuery = useQuery({
    queryKey: accountingQueryKeys.outstandingSuppliers({
      search: deferredSearch || undefined,
      page,
      pageSize,
      sortBy,
      sortOrder,
    }),
    queryFn: () =>
      listOutstandingSuppliers({
        search: deferredSearch || undefined,
        page,
        pageSize,
        sortBy,
        sortOrder,
      }),
    staleTime: 60_000,
  });

  if (outstandingSuppliersQuery.isLoading && !outstandingSuppliersQuery.data) {
    return <LoadingState title="Loading supplier dues" />;
  }

  if (outstandingSuppliersQuery.error) {
    return (
      <ErrorState
        description={outstandingSuppliersQuery.error.message}
        onRetry={() => outstandingSuppliersQuery.refetch()}
        title="Unable to load supplier dues"
      />
    );
  }

  const response = outstandingSuppliersQuery.data;
  const items = response?.items ?? [];
  const summary = response?.summary;
  const pagination = response?.pagination;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<AccountingModuleNav />}
        className="px-5 py-4 md:px-6 md:py-4"
        title="Supplier Dues"
      />

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          icon={<BadgeIndianRupee className="h-5 w-5" />}
          label="Total Due"
          tone="danger"
          value={formatCurrency(summary?.totalOutstandingAmount ?? 0)}
        />
        <SummaryCard
          icon={<Building2 className="h-5 w-5" />}
          label="Suppliers Due"
          tone="warning"
          value={summary?.entityCount ?? 0}
        />
        <SummaryCard
          icon={<ReceiptText className="h-5 w-5" />}
          label="Open Purchases"
          value={summary?.openPurchaseCount ?? 0}
        />
      </div>

      <FilterBar
        className="p-3.5 md:p-4"
        contentClassName="border-0 bg-transparent p-0 shadow-none"
        title="Suppliers"
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(12rem,0.9fr)_minmax(10rem,0.75fr)]">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Search</span>
            <input
              className="ui-input"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search supplier"
              value={search}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Sort by</span>
            <select
              className="ui-input"
              onChange={(event) => setSortBy(event.target.value as SupplierDueSortBy)}
              value={sortBy}
            >
              <option value="outstandingAmount">Due amount</option>
              <option value="supplierName">Supplier name</option>
              <option value="lastPurchaseDate">Last purchase date</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Order</span>
            <select
              className="ui-input"
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              value={sortOrder}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
        </div>
      </FilterBar>

      <SectionCard title="Due List">
        {outstandingSuppliersQuery.isFetching && !items.length ? (
          <LoadingState title="Refreshing supplier dues" />
        ) : items.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 lg:hidden">
              {items.map((item) => (
                <article
                  className="rounded-[22px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_16px_40px_-36px_rgba(15,23,42,0.24)]"
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-950">{item.supplierName}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.companyName || "Independent"}
                      </p>
                    </div>
                    <StatusBadge label={item.status} />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Mobile
                      </p>
                      <p className="mt-1 text-sm text-slate-700">{item.mobileNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Open Purchases
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {item.summary.openPurchaseCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Last Purchase
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {item.summary.lastPurchaseDate
                          ? formatDate(item.summary.lastPurchaseDate)
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Due Amount
                      </p>
                      <p className="mt-1 text-base font-semibold text-rose-600">
                        {formatCurrency(item.summary.outstandingAmount)}
                      </p>
                    </div>
                  </div>
                  <Link
                    className="ui-btn ui-btn--secondary mt-4 inline-flex !min-h-[2.5rem] !px-3.5"
                    to={`/app/accounting/suppliers/${item.id}`}
                  >
                    Open ledger
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-[22px] border border-slate-200/80 lg:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Supplier
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Mobile
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Open Purchases
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Last Purchase
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Due Amount
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white/95">
                    {items.map((item) => (
                      <tr className="transition hover:bg-slate-50/70" key={item.id}>
                        <td className="px-4 py-3.5 align-top">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-950">{item.supplierName}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-500">
                                {item.companyName || "Independent"}
                              </span>
                              <StatusBadge label={item.status} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-700">{item.mobileNumber}</td>
                        <td className="px-4 py-3.5 text-sm font-semibold text-slate-900">
                          {item.summary.openPurchaseCount}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-700">
                          {item.summary.lastPurchaseDate
                            ? formatDate(item.summary.lastPurchaseDate)
                            : "-"}
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm font-semibold text-rose-600">
                          {formatCurrency(item.summary.outstandingAmount)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            className="ui-btn ui-btn--secondary inline-flex !min-h-[2.3rem] !px-3"
                            to={`/app/accounting/suppliers/${item.id}`}
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Pagination
              onPageChange={setPage}
              page={pagination?.page ?? 1}
              pageSize={pagination?.pageSize ?? pageSize}
              totalItems={pagination?.total ?? 0}
              totalPages={pagination?.totalPages ?? 1}
            />
          </div>
        ) : (
          <EmptyState description="No supplier dues found." title="No supplier dues" />
        )}
      </SectionCard>
    </div>
  );
};
