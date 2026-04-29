import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  formatDate,
  formatNumber,
} from "../../../lib/utils";
import { listCategories, listManufacturers } from "../../medicines/api/medicines";
import { medicinesQueryKeys } from "../../medicines/api/medicines";
import { listInventorySummary, inventoryQueryKeys } from "../api/inventory";
import { StockAdjustmentModal } from "../components/StockAdjustmentModal";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";
const inventoryRefreshIntervalMs = 300000;

export const InventorySummaryPage = () => {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState<"all" | "only">("all");
  const [medicineStatus, setMedicineStatus] = useState<"" | "active" | "inactive">("");
  const [batchStatus, setBatchStatus] = useState<"" | "active" | "exhausted" | "expired">("");
  const [sortBy, setSortBy] = useState<
    "medicineName" | "availableQuantity" | "reorderLevel" | "updatedAt"
  >("medicineName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [adjustmentMedicineId, setAdjustmentMedicineId] = useState<string>();

  const deferredSearch = useDeferredValue(search);

  const params = {
    search: deferredSearch || undefined,
    categoryId: categoryId || undefined,
    manufacturerId: manufacturerId || undefined,
    lowStockOnly: lowStockOnly === "only" ? true : undefined,
    medicineStatus: medicineStatus || undefined,
    batchStatus: batchStatus || undefined,
    page,
    pageSize: 10,
    sortBy,
    sortOrder,
  };

  const inventoryQuery = useQuery({
    queryKey: inventoryQueryKeys.summary(params),
    queryFn: () => listInventorySummary(params),
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
    inventoryQuery.error ?? categoriesQuery.error ?? manufacturersQuery.error;

  if (
    inventoryQuery.isLoading ||
    categoriesQuery.isLoading ||
    manufacturersQuery.isLoading
  ) {
    return <LoadingState title="Loading inventory summary" />;
  }

  if (activeError) {
    return (
      <ErrorState
        description={activeError.message}
        onRetry={() => {
          inventoryQuery.refetch();
          categoriesQuery.refetch();
          manufacturersQuery.refetch();
        }}
        title="Unable to load inventory"
      />
    );
  }

  const items = inventoryQuery.data?.items ?? [];
  const pagination = inventoryQuery.data?.pagination;
  const lowStockCount = items.filter((item) => item.isLowStock).length;
  const visibleStock = items.reduce((sum, item) => sum + item.availableQuantity, 0);
  const visibleBatches = items.reduce((sum, item) => sum + item.activeBatchCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Link
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              to="/app/inventory/low-stock"
            >
              Low stock view
            </Link>
            <Link
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              to="/app/inventory/expiry"
            >
              Expiry report
            </Link>
            <button
              className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => setAdjustmentMedicineId("")}
              type="button"
            >
              Stock adjustment
            </button>
          </>
        }
        description="Track medicine-level stock availability, reorder readiness, and active batch coverage in one compact operational view."
        eyebrow="Inventory control"
        title="Inventory Summary"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          hint="Matching medicines in the current result set"
          label="Medicines"
          value={pagination?.total ?? 0}
        />
        <SummaryCard
          hint="Low stock medicines on this page"
          label="Low stock visible"
          tone={lowStockCount > 0 ? "danger" : "accent"}
          value={lowStockCount}
        />
        <SummaryCard
          hint="Total available quantity on screen"
          label="Visible stock"
          value={formatNumber(visibleStock)}
        />
        <SummaryCard
          hint="Active batches represented on screen"
          label="Active batches"
          value={formatNumber(visibleBatches)}
        />
      </div>


      <FilterBar
        actions={
          <button
            className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => {
              setSearch("");
              setCategoryId("");
              setManufacturerId("");
              setLowStockOnly("all");
              setMedicineStatus("");
              setBatchStatus("");
              setSortBy("medicineName");
              setSortOrder("asc");
              setPage(1);
            }}
            type="button"
          >
            Clear filters
          </button>
        }
        description="Keep stock search, risk filters, and sort controls visible without making the page feel heavy."
        title="Inventory filters"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700 xl:col-span-2">
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
            Low stock
            <select
              className={inputClassName}
              onChange={(event) => {
                setLowStockOnly(event.target.value as "all" | "only");
                setPage(1);
              }}
              value={lowStockOnly}
            >
              <option value="all">All medicines</option>
              <option value="only">Low stock only</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Medicine status
            <select
              className={inputClassName}
              onChange={(event) => {
                setMedicineStatus(event.target.value as typeof medicineStatus);
                setPage(1);
              }}
              value={medicineStatus}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Batch status
            <select
              className={inputClassName}
              onChange={(event) => {
                setBatchStatus(event.target.value as typeof batchStatus);
                setPage(1);
              }}
              value={batchStatus}
            >
              <option value="">All batch states</option>
              <option value="active">Active batches</option>
              <option value="exhausted">Exhausted batches</option>
              <option value="expired">Expired batches</option>
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
              <option value="medicineName">Medicine name</option>
              <option value="availableQuantity">Available stock</option>
              <option value="reorderLevel">Reorder level</option>
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
      </FilterBar>

      <SectionCard
        description="A practical stock register for daily refill and control decisions."
        title="Inventory register"
      >
        {items.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 xl:hidden">
              {items.map((item) => (
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
                        <StatusBadge
                          label={item.isLowStock ? "Low Stock" : "Safe"}
                          tone={item.isLowStock ? "low_stock" : "safe"}
                        />
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
                    <p className="text-base font-semibold text-slate-950">
                      {formatNumber(item.availableQuantity)}
                    </p>
                  </div>

                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Category", item.category.name],
                      ["Manufacturer", item.manufacturer.name],
                      ["Reorder level", formatNumber(item.reorderLevel)],
                      ["Active batches", formatNumber(item.activeBatchCount)],
                      ["Status", item.medicine.status],
                      ["Updated", formatDate(item.medicine.updatedAt)],
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

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                      to={`/app/inventory/${item.medicine.id}`}
                    >
                      View detail
                    </Link>
                    <button
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                      onClick={() => setAdjustmentMedicineId(item.medicine.id)}
                      type="button"
                    >
                      Adjust stock
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-[1220px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Medicine</th>
                    <th className="px-4">Category</th>
                    <th className="px-4">Manufacturer</th>
                    <th className="px-4">Available stock</th>
                    <th className="px-4">Reorder level</th>
                    <th className="px-4">Low stock</th>
                    <th className="px-4">Active batches</th>
                    <th className="px-4">Status</th>
                    <th className="px-4 text-right">Actions</th>
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
                      <td className="px-4 py-4">
                        <StatusBadge
                          label={item.isLowStock ? "Low Stock" : "Safe"}
                          tone={item.isLowStock ? "low_stock" : "safe"}
                        />
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatNumber(item.activeBatchCount)}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={item.medicine.status} />
                      </td>
                      <td className="rounded-r-3xl px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                            to={`/app/inventory/${item.medicine.id}`}
                          >
                            View detail
                          </Link>
                          <button
                            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                            onClick={() => setAdjustmentMedicineId(item.medicine.id)}
                            type="button"
                          >
                            Adjust
                          </button>
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
              <Link
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                to="/app/purchases/new"
              >
                Create purchase
              </Link>
            }
            description="No stock is visible right now. Inventory appears after at least one purchase is finalized and posted to stock."
            title="No inventory found"
          />
        )}
      </SectionCard>

      <StockAdjustmentModal
        initialMedicineId={adjustmentMedicineId}
        onClose={() => setAdjustmentMedicineId(undefined)}
        open={adjustmentMedicineId !== undefined}
      />
    </div>
  );
};
