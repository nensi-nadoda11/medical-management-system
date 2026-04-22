import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { ErrorState } from "../../../components/ui/ErrorState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { FilterBar } from "../../../components/ui/FilterBar";
import { ResponsiveDataList } from "../../../components/ui/ResponsiveDataList";
import { useToast } from "../../../hooks/use-toast";
import { formatCurrency, formatDateTime } from "../../../lib/utils";
import type { MasterStatus } from "../../../types/medicine";
import type { SaveSupplierPayload, Supplier } from "../../../types/supplier";
import {
  createSupplier,
  listSuppliers,
  suppliersQueryKeys,
  updateSupplier,
  updateSupplierStatus,
} from "../api/suppliers";
import { SupplierFormModal } from "../components/SupplierFormModal";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

type StatusFilter = MasterStatus | "all";

export const SuppliersPage = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<"supplierName" | "updatedAt">(
    "supplierName",
  );
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [pendingStatusSupplier, setPendingStatusSupplier] =
    useState<Supplier | null>(null);
  const deferredSearch = useDeferredValue(search);

  const supplierParams = {
    search: deferredSearch || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    pageSize: 10,
    sortBy,
    sortOrder: "asc" as const,
  };

  const suppliersQuery = useQuery({
    queryKey: suppliersQueryKeys.list(supplierParams),
    queryFn: () => listSuppliers(supplierParams),
  });

  const suppliers = suppliersQuery.data?.items ?? [];
  const pagination = suppliersQuery.data?.pagination;

  const summary = {
    totalSuppliers: suppliersQuery.data?.pagination.total ?? 0,
    activeOnScreen: suppliers.filter((item) => item.status === "active").length,
    withGst: suppliers.filter((item) => item.gstNumber).length,
    openingBalanceOnScreen: suppliers.reduce(
      (sum, item) => sum + Number(item.openingBalance),
      0,
    ),
  };

  const saveSupplierMutation = useMutation({
    mutationFn: async (payload: SaveSupplierPayload) => {
      if (editingSupplier) {
        return updateSupplier(editingSupplier.id, payload);
      }

      return createSupplier(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.all });
      pushToast({
        title: editingSupplier ? "Supplier updated" : "Supplier created",
        description: "Supplier master data has been refreshed successfully.",
        variant: "success",
      });
      setIsFormOpen(false);
      setEditingSupplier(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      supplierId,
      status,
    }: {
      supplierId: string;
      status: MasterStatus;
    }) => updateSupplierStatus(supplierId, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.all });
      pushToast({
        title: "Supplier status updated",
        description: "Supplier availability has been updated successfully.",
        variant: "success",
      });
      setPendingStatusSupplier(null);
    },
  });

  if (suppliersQuery.error) {
    return (
      <ErrorState
        description={suppliersQuery.error.message}
        onRetry={() => suppliersQuery.refetch()}
        title="Unable to load suppliers"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <button
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            onClick={() => {
              setEditingSupplier(null);
              setIsFormOpen(true);
            }}
            type="button"
          >
            Add supplier
          </button>
        }
        description="Manage supplier contacts, compliance details, and opening balances in a clean purchasing-ready workspace."
        eyebrow="Procurement master"
        title="Supplier Management"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Suppliers", summary.totalSuppliers],
          ["Active on screen", summary.activeOnScreen],
          ["GST captured", summary.withGst],
          [
            "Visible opening balance",
            formatCurrency(summary.openingBalanceOnScreen),
          ],
        ].map(([label, value]) => (
          <article
            className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60"
            key={label}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {label}
            </p>
            <p className="mt-2.5 text-[2rem] font-semibold tracking-tight text-slate-950">
              {value}
            </p>
          </article>
        ))}
      </div>

      <FilterBar
        description="Quick filters keep supplier review fast without turning the page into a cluttered admin form."
        title="Supplier filters"
        actions={
          <button
            className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setSortBy("supplierName");
              setPage(1);
            }}
            type="button"
          >
            Clear filters
          </button>
        }
      >
        <div className="grid gap-4 xl:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
          <label className="grid gap-2 text-sm font-medium text-slate-700 xl:col-span-2">
            Search suppliers
            <input
              className={inputClassName}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by supplier name or mobile number"
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
                setSortBy(event.target.value as "supplierName" | "updatedAt");
                setPage(1);
              }}
              value={sortBy}
            >
              <option value="supplierName">Supplier name</option>
              <option value="updatedAt">Last updated</option>
            </select>
          </label>
        </div>
      </FilterBar>

      <SectionCard
        description="A polished operational view of supplier master data for day-to-day admin work."
        title="Supplier directory"
      >
        <ResponsiveDataList
          data={suppliers}
          isLoading={suppliersQuery.isLoading}
          keyExtractor={(item) => item.id}
          emptyState={{
            title: "No suppliers found",
            description: "No suppliers match the current search. Try adding one if the directory is empty.",
          }}
          pagination={
            pagination ? (
              <Pagination
                onPageChange={setPage}
                page={pagination.page}
                pageSize={pagination.pageSize}
                totalItems={pagination.total}
                totalPages={pagination.totalPages}
              />
            ) : null
          }
          columns={[
            {
              header: "Supplier",
              accessor: (supplier) => (
                <div>
                  <p className="font-semibold text-slate-950">{supplier.supplierName}</p>
                  <p className="mt-1 text-sm text-slate-600">{supplier.email || "No email added"}</p>
                </div>
              ),
              className: "rounded-l-3xl px-4 py-4",
            },
            { header: "Company", accessor: (supplier) => supplier.companyName || "Independent" },
            { header: "Contact", accessor: (supplier) => supplier.contactPerson || "Not added" },
            { header: "Mobile", accessor: (supplier) => supplier.mobileNumber },
            {
              header: "Location",
              accessor: (supplier) =>
                [supplier.city, supplier.state].filter(Boolean).join(", ") || "Not added",
            },
            { header: "GST", accessor: (supplier) => supplier.gstNumber || "Not added" },
            { header: "Opening balance", accessor: (supplier) => formatCurrency(supplier.openingBalance) },
            { header: "Status", accessor: (supplier) => <StatusBadge label={supplier.status} /> },
            {
              header: "Actions",
              accessor: (supplier) => (
                <div className="flex justify-end gap-2">
                  <button
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                    onClick={() => {
                      setEditingSupplier(supplier);
                      setIsFormOpen(true);
                    }}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                    onClick={() => setPendingStatusSupplier(supplier)}
                    type="button"
                  >
                    {supplier.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                </div>
              ),
              className: "rounded-r-3xl px-4 py-4 text-right",
              headerClassName: "px-4 text-right",
            },
          ]}
          renderCard={(supplier) => (
            <article
              className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
              key={supplier.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-950">
                      {supplier.supplierName}
                    </h3>
                    <StatusBadge label={supplier.status} />
                  </div>
                  <p className="text-sm text-slate-600">
                    {supplier.companyName || "Independent supplier"}
                  </p>
                </div>
                <button
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  onClick={() => {
                    setEditingSupplier(supplier);
                    setIsFormOpen(true);
                  }}
                  type="button"
                >
                  Edit
                </button>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["Mobile", supplier.mobileNumber],
                  ["Email", supplier.email || "Not added"],
                  [
                    "Location",
                    [supplier.city, supplier.state]
                      .filter(Boolean)
                      .join(", ") || "Not added",
                  ],
                  ["GST", supplier.gstNumber || "Not added"],
                  [
                    "Opening balance",
                    formatCurrency(supplier.openingBalance),
                  ],
                  ["Contact person", supplier.contactPerson || "Not added"],
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

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Updated {formatDateTime(supplier.updatedAt)}
                </p>
                <button
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  onClick={() => setPendingStatusSupplier(supplier)}
                  type="button"
                >
                  {supplier.status === "active" ? "Deactivate" : "Activate"}
                </button>
              </div>
            </article>
          )}
        />
      </SectionCard>

      <SupplierFormModal
        errorMessage={saveSupplierMutation.error?.message}
        isSubmitting={saveSupplierMutation.isPending}
        onClose={() => {
          setIsFormOpen(false);
          setEditingSupplier(null);
        }}
        onSubmit={async (payload) => {
          await saveSupplierMutation.mutateAsync(payload);
        }}
        open={isFormOpen}
        supplier={editingSupplier}
      />

      <ConfirmDialog
        confirmLabel={
          pendingStatusSupplier?.status === "active"
            ? "Deactivate supplier"
            : "Activate supplier"
        }
        description="This updates whether the supplier remains available for active operational use while safely retaining the record."
        isLoading={statusMutation.isPending}
        onClose={() => setPendingStatusSupplier(null)}
        onConfirm={() => {
          if (!pendingStatusSupplier) {
            return;
          }

          statusMutation.mutate({
            supplierId: pendingStatusSupplier.id,
            status:
              pendingStatusSupplier.status === "active" ? "inactive" : "active",
          });
        }}
        open={Boolean(pendingStatusSupplier)}
        title="Confirm status change"
      />
    </div>
  );
};
