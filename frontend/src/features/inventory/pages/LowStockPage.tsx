import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { formatNumber } from "../../../lib/utils";
import { medicinesQueryKeys, listCategories, listManufacturers } from "../../medicines/api/medicines";
import { inventoryQueryKeys, listLowStock } from "../api/inventory";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";
const inventoryRefreshIntervalMs = 300000;

export const LowStockPage = () => {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [sortBy, setSortBy] = useState<
    "medicineName" | "availableQuantity" | "reorderLevel"
  >("availableQuantity");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const deferredSearch = useDeferredValue(search);

  const params = {
    search: deferredSearch || undefined,
    categoryId: categoryId || undefined,
    manufacturerId: manufacturerId || undefined,
    sortBy,
    sortOrder,
    page,
    pageSize: 10,
  };

  const lowStockQuery = useQuery({
    queryKey: inventoryQueryKeys.lowStock(params),
    queryFn: () => listLowStock(params),
    refetchInterval: inventoryRefreshIntervalMs,
  });

  const categoriesQuery = useQuery({
    queryKey: medicinesQueryKeys.categoryList({
      page: 1,
      pageSize: 100,
      sortBy: "name",
      sortOrder: "asc",
    }),
    queryFn: () =>
      listCategories({
        page: 1,
        pageSize: 100,
        sortBy: "name",
        sortOrder: "asc",
      }),
  });

  const manufacturersQuery = useQuery({
    queryKey: medicinesQueryKeys.manufacturerList({
      page: 1,
      pageSize: 100,
      sortBy: "name",
      sortOrder: "asc",
    }),
    queryFn: () =>
      listManufacturers({
        page: 1,
        pageSize: 100,
        sortBy: "name",
        sortOrder: "asc",
      }),
  });

  const activeError =
    lowStockQuery.error ?? categoriesQuery.error ?? manufacturersQuery.error;

  if (
    lowStockQuery.isLoading ||
    categoriesQuery.isLoading ||
    manufacturersQuery.isLoading
  ) {
    return <LoadingState title="Loading low stock report" />;
  }

  if (activeError) {
    return (
      <ErrorState
        description={activeError.message}
        onRetry={() => {
          lowStockQuery.refetch();
          categoriesQuery.refetch();
          manufacturersQuery.refetch();
        }}
        title="Unable to load low stock report"
      />
    );
  }

  const items = lowStockQuery.data?.items ?? [];
  const pagination = lowStockQuery.data?.pagination;
  const totalShortage = items.reduce(
    (sum, item) => sum + Math.max(item.reorderLevel - item.availableQuantity, 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Link
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            to="/app/inventory"
          >
            Back to inventory
          </Link>
        }
        className="py-4"
        eyebrow="Inventory control"
        title="Low Stock"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          label="Low stock medicines"
          tone="danger"
          value={pagination?.total ?? 0}
        />
        <SummaryCard
          label="Visible shortage"
          tone="warning"
          value={formatNumber(totalShortage)}
        />
        <SummaryCard
          label="Current page items"
          value={items.length}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,3fr)_minmax(180px,1.15fr)_minmax(180px,1.15fr)_minmax(150px,0.9fr)_minmax(150px,0.9fr)] xl:items-end">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Search
          <input
            className={inputClassName}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search medicine, generic name, or barcode"
            value={search}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Category
          <select
            className={inputClassName}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPage(1);
            }}
            value={categoryId}
          >
            <option value="">All categories</option>
            {(categoriesQuery.data?.items ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Manufacturer
          <select
            className={inputClassName}
            onChange={(event) => {
              setManufacturerId(event.target.value);
              setPage(1);
            }}
            value={manufacturerId}
          >
            <option value="">All manufacturers</option>
            {(manufacturersQuery.data?.items ?? []).map((manufacturer) => (
              <option key={manufacturer.id} value={manufacturer.id}>
                {manufacturer.name}
              </option>
            ))}
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
            <option value="availableQuantity">Current stock</option>
            <option value="reorderLevel">Reorder level</option>
            <option value="medicineName">Medicine name</option>
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

      <SectionCard title="Low stock register">
        {items.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 xl:hidden">
              {items.map((item) => {
                const shortage = Math.max(item.reorderLevel - item.availableQuantity, 0);

                return (
                  <article
                    className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                    key={item.medicine.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-950">
                            {item.medicine.medicineName}
                          </h3>
                          <StatusBadge label="Low Stock" tone="low_stock" />
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.medicine.genericName}
                        </p>
                        {item.medicine.barcode ? (
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            Barcode: {item.medicine.barcode}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-base font-semibold text-rose-700">
                        Short {formatNumber(shortage)}
                      </p>
                    </div>

                    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[
                        ["Current stock", formatNumber(item.availableQuantity)],
                        ["Reorder level", formatNumber(item.reorderLevel)],
                        ["Category", item.category.name],
                        ["Manufacturer", item.manufacturer.name],
                      ].map(([label, value]) => (
                        <div
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                          key={label}
                        >
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {label}
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-900">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-[1020px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Medicine</th>
                    <th className="px-4">Category</th>
                    <th className="px-4">Manufacturer</th>
                    <th className="px-4">Current stock</th>
                    <th className="px-4">Reorder level</th>
                    <th className="px-4">Shortage</th>
                    <th className="px-4">Indicator</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr className="rounded-3xl bg-slate-50" key={item.medicine.id}>
                      <td className="rounded-l-3xl px-4 py-4">
                        <div>
                          <p className="font-semibold text-slate-950">
                            {item.medicine.medicineName}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {item.medicine.genericName}
                          </p>
                          {item.medicine.barcode ? (
                            <p className="mt-1 text-xs font-medium text-slate-500">
                              Barcode: {item.medicine.barcode}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.category.name}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {item.manufacturer.name}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-950">
                        {formatNumber(item.availableQuantity)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatNumber(item.reorderLevel)}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-rose-700">
                        {formatNumber(
                          Math.max(item.reorderLevel - item.availableQuantity, 0),
                        )}
                      </td>
                      <td className="rounded-r-3xl px-4 py-4">
                        <StatusBadge label="Low Stock" tone="low_stock" />
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
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,251,0.96))] px-6 py-12 text-center shadow-[0_24px_58px_-46px_rgba(15,23,42,0.26)]">
            <p className="text-base font-semibold text-slate-900">Low stock is clear</p>
          </div>
        )}
      </SectionCard>
    </div>
  );
};
