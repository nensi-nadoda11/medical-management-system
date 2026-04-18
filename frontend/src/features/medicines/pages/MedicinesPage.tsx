import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useToast } from "../../../hooks/use-toast";
import { formatDateTime } from "../../../lib/utils";
import type {
  MasterStatus,
  Medicine,
  SaveMedicinePayload,
} from "../../../types/medicine";
import {
  createMedicine,
  listCategories,
  listManufacturers,
  listMedicines,
  medicinesQueryKeys,
  updateMedicine,
  updateMedicineStatus,
} from "../api/medicines";
import { MasterDataManagerModal } from "../components/MasterDataManagerModal";
import { MedicineFormModal } from "../components/MedicineFormModal";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

type StatusFilter = MasterStatus | "all";

export const MedicinesPage = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [manufacturerFilter, setManufacturerFilter] = useState("");
  const [sortBy, setSortBy] = useState<
    "medicineName" | "genericName" | "updatedAt"
  >("medicineName");
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [masterModal, setMasterModal] = useState<
    "category" | "manufacturer" | null
  >(null);
  const [pendingStatusMedicine, setPendingStatusMedicine] =
    useState<Medicine | null>(null);
  const deferredSearch = useDeferredValue(search);

  const medicineParams = {
    search: deferredSearch || undefined,
    categoryId: categoryFilter || undefined,
    manufacturerId: manufacturerFilter || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    pageSize: 10,
    sortBy,
    sortOrder: "asc" as const,
  };

  const masterDataParams = {
    page: 1,
    pageSize: 100,
    sortBy: "name" as const,
    sortOrder: "asc" as const,
  };

  const medicinesQuery = useQuery({
    queryKey: medicinesQueryKeys.list(medicineParams),
    queryFn: () => listMedicines(medicineParams),
  });

  const categoriesQuery = useQuery({
    queryKey: medicinesQueryKeys.categoryList(masterDataParams),
    queryFn: () => listCategories(masterDataParams),
  });

  const manufacturersQuery = useQuery({
    queryKey: medicinesQueryKeys.manufacturerList(masterDataParams),
    queryFn: () => listManufacturers(masterDataParams),
  });

  const saveMedicineMutation = useMutation({
    mutationFn: async (payload: SaveMedicinePayload) => {
      if (editingMedicine) {
        return updateMedicine(editingMedicine.id, payload);
      }

      return createMedicine(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: medicinesQueryKeys.all });
      pushToast({
        title: editingMedicine ? "Medicine updated" : "Medicine created",
        description:
          "The medicine catalog has been refreshed with your latest changes.",
        variant: "success",
      });
      setIsFormOpen(false);
      setEditingMedicine(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      medicineId,
      status,
    }: {
      medicineId: string;
      status: MasterStatus;
    }) => updateMedicineStatus(medicineId, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: medicinesQueryKeys.all });
      pushToast({
        title: "Medicine status updated",
        description: "Catalog availability has been updated successfully.",
        variant: "success",
      });
      setPendingStatusMedicine(null);
    },
  });

  const isLoading =
    medicinesQuery.isLoading ||
    categoriesQuery.isLoading ||
    manufacturersQuery.isLoading;

  const activeError =
    medicinesQuery.error ?? categoriesQuery.error ?? manufacturersQuery.error;

  const medicines = medicinesQuery.data?.items ?? [];
  const categories = categoriesQuery.data?.items ?? [];
  const manufacturers = manufacturersQuery.data?.items ?? [];
  const pagination = medicinesQuery.data?.pagination;

  const summary = {
    totalMedicines: medicinesQuery.data?.pagination.total ?? 0,
    activeCategories: categories.filter((item) => item.status === "active")
      .length,
    activeManufacturers: manufacturers.filter((item) => item.status === "active")
      .length,
    prescriptionFlagged: medicines.filter((item) => item.prescriptionRequired)
      .length,
  };

  if (isLoading) {
    return <LoadingState title="Loading medicine master" />;
  }

  if (activeError) {
    return (
      <ErrorState
        description={activeError.message}
        onRetry={() => {
          medicinesQuery.refetch();
          categoriesQuery.refetch();
          manufacturersQuery.refetch();
        }}
        title="Unable to load medicine catalog"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <button
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => setMasterModal("category")}
              type="button"
            >
              Manage categories
            </button>
            <button
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => setMasterModal("manufacturer")}
              type="button"
            >
              Manage manufacturers
            </button>
            <button
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => {
                setEditingMedicine(null);
                setIsFormOpen(true);
              }}
              type="button"
            >
              Add medicine
            </button>
          </>
        }
        description="Maintain a clean medicine master with strong classification, tax readiness, and future-safe inventory metadata."
        eyebrow="Catalog control"
        title="Medicine Master"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Medicines", summary.totalMedicines],
          ["Active categories", summary.activeCategories],
          ["Active manufacturers", summary.activeManufacturers],
          ["Prescription flagged", summary.prescriptionFlagged],
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

      <SectionCard
        description="Search, filter, and sort the medicine catalog without losing screen space."
        title="Catalog controls"
      >
        <div className="grid gap-4 xl:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
          <label className="grid gap-2 text-sm font-medium text-slate-700 xl:col-span-2">
            Search medicines
            <input
              className={inputClassName}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by medicine or generic name"
              value={search}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Category
            <select
              className={inputClassName}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setPage(1);
              }}
              value={categoryFilter}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
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
                setManufacturerFilter(event.target.value);
                setPage(1);
              }}
              value={manufacturerFilter}
            >
              <option value="">All manufacturers</option>
              {manufacturers.map((manufacturer) => (
                <option key={manufacturer.id} value={manufacturer.id}>
                  {manufacturer.name}
                </option>
              ))}
            </select>
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
                setSortBy(
                  event.target.value as
                    | "medicineName"
                    | "genericName"
                    | "updatedAt",
                );
                setPage(1);
              }}
              value={sortBy}
            >
              <option value="medicineName">Medicine name</option>
              <option value="genericName">Generic name</option>
              <option value="updatedAt">Last updated</option>
            </select>
          </label>
        </div>
      </SectionCard>

      <SectionCard
        description="A business-friendly view of your medicine catalog with fast access to editing and status control."
        title="Medicine catalog"
      >
        {medicines.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 lg:hidden">
              {medicines.map((medicine) => (
                <article
                  className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                  key={medicine.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-950">
                          {medicine.medicineName}
                        </h3>
                        <StatusBadge label={medicine.status} />
                      </div>
                      <p className="text-sm text-slate-600">
                        {medicine.genericName}
                      </p>
                    </div>
                    <button
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                      onClick={() => {
                        setEditingMedicine(medicine);
                        setIsFormOpen(true);
                      }}
                      type="button"
                    >
                      Edit
                    </button>
                  </div>

                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Form / Unit", `${medicine.form} / ${medicine.unit}`],
                      ["Category", medicine.category.name],
                      ["Manufacturer", medicine.manufacturer.name],
                      ["GST", `${medicine.gstPercent}%`],
                      ["Reorder", medicine.reorderLevel.toString()],
                      [
                        "Prescription",
                        medicine.prescriptionRequired
                          ? "Required"
                          : "Not required",
                      ],
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
                      Updated {formatDateTime(medicine.updatedAt)}
                    </p>
                    <button
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                      onClick={() => setPendingStatusMedicine(medicine)}
                      type="button"
                    >
                      {medicine.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[1120px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Medicine</th>
                    <th className="px-4">Form</th>
                    <th className="px-4">Category</th>
                    <th className="px-4">Manufacturer</th>
                    <th className="px-4">GST</th>
                    <th className="px-4">Reorder</th>
                    <th className="px-4">Prescription</th>
                    <th className="px-4">Status</th>
                    <th className="px-4">Updated</th>
                    <th className="px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {medicines.map((medicine) => (
                    <tr className="rounded-3xl bg-slate-50" key={medicine.id}>
                      <td className="rounded-l-3xl px-4 py-4">
                        <div>
                          <p className="font-semibold text-slate-950">
                            {medicine.medicineName}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {medicine.genericName}
                            {medicine.strength ? ` • ${medicine.strength}` : ""}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {medicine.form} / {medicine.unit}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {medicine.category.name}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {medicine.manufacturer.name}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {medicine.gstPercent}%
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {medicine.reorderLevel}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge
                          label={
                            medicine.prescriptionRequired
                              ? "Required"
                              : "Open sale"
                          }
                          tone={
                            medicine.prescriptionRequired ? "pending" : "active"
                          }
                        />
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={medicine.status} />
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {formatDateTime(medicine.updatedAt)}
                      </td>
                      <td className="rounded-r-3xl px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                            onClick={() => {
                              setEditingMedicine(medicine);
                              setIsFormOpen(true);
                            }}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                            onClick={() => setPendingStatusMedicine(medicine)}
                            type="button"
                          >
                            {medicine.status === "active"
                              ? "Deactivate"
                              : "Activate"}
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
              <button
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={() => {
                  setEditingMedicine(null);
                  setIsFormOpen(true);
                }}
                type="button"
              >
                Add first medicine
              </button>
            }
            description="Start your catalog with a few core medicines so later purchase, inventory, and billing modules have a stable master."
            title="No medicines found"
          />
        )}
      </SectionCard>

      <MedicineFormModal
        categories={categories}
        errorMessage={saveMedicineMutation.error?.message}
        isSubmitting={saveMedicineMutation.isPending}
        manufacturers={manufacturers}
        medicine={editingMedicine}
        onClose={() => {
          setIsFormOpen(false);
          setEditingMedicine(null);
        }}
        onSubmit={async (payload) => {
          await saveMedicineMutation.mutateAsync(payload);
        }}
        open={isFormOpen}
      />

      <MasterDataManagerModal
        mode="category"
        onClose={() => setMasterModal(null)}
        open={masterModal === "category"}
      />

      <MasterDataManagerModal
        mode="manufacturer"
        onClose={() => setMasterModal(null)}
        open={masterModal === "manufacturer"}
      />

      <ConfirmDialog
        confirmLabel={
          pendingStatusMedicine?.status === "active"
            ? "Deactivate medicine"
            : "Activate medicine"
        }
        description="This changes whether the medicine is available for active catalog use, while keeping the master record safely intact."
        isLoading={statusMutation.isPending}
        onClose={() => setPendingStatusMedicine(null)}
        onConfirm={() => {
          if (!pendingStatusMedicine) {
            return;
          }

          statusMutation.mutate({
            medicineId: pendingStatusMedicine.id,
            status:
              pendingStatusMedicine.status === "active" ? "inactive" : "active",
          });
        }}
        open={Boolean(pendingStatusMedicine)}
        title="Confirm status change"
      />
    </div>
  );
};
