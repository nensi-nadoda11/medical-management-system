import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, Pencil } from "lucide-react";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { ErrorState } from "../../../components/ui/ErrorState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { ResponsiveDataList } from "../../../components/ui/ResponsiveDataList";
import { useToast } from "../../../hooks/use-toast";
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
const compactFieldClassName = `${inputClassName} h-12 py-2 text-sm leading-6`;

const getPreviewText = (value: string | number | null | undefined, maxChars = 5) => {
  const text =
    value === null || value === undefined || value === "" ? "-" : String(value);

  return text.length > maxChars ? `${text.slice(0, maxChars)}...` : text;
};

const TruncatedText = ({
  value,
  className = "",
}: {
  value: string | number | null | undefined;
  className?: string;
}) => {
  const text =
    value === null || value === undefined || value === "" ? "-" : String(value);

  return (
    <span className={`inline-block whitespace-nowrap ${className}`} title={text}>
      {getPreviewText(text)}
    </span>
  );
};

const CompactBadge = ({
  label,
  toneClassName,
}: {
  label: string;
  toneClassName: string;
}) => (
  <span
    className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ${toneClassName}`}
    title={label}
  >
    {getPreviewText(label)}
  </span>
);

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

  const activeError =
    medicinesQuery.error ?? categoriesQuery.error ?? manufacturersQuery.error;

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

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 md:overflow-visible md:pb-0">
            <button
              className="shrink-0 whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => setMasterModal("category")}
              type="button"
            >
              Manage categories
            </button>
            <button
              className="shrink-0 whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => setMasterModal("manufacturer")}
              type="button"
            >
              Manage manufacturers
            </button>
            <button
              className="shrink-0 whitespace-nowrap rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => {
                setEditingMedicine(null);
                setIsFormOpen(true);
              }}
              type="button"
            >
              Add medicine
            </button>
          </div>
        }
        className="py-4"
        eyebrow="Catalog control"
        titleClassName="whitespace-nowrap"
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
            className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/60"
            key={label}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {label}
            </p>
            <p className="mt-1.5 text-[1.75rem] font-semibold tracking-tight text-slate-950">
              {value}
            </p>
          </article>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,240px)_repeat(4,minmax(0,1fr))_auto] xl:items-center">
        <label className="block min-w-0">
          <span className="sr-only">Search medicines</span>
          <input
            className={`${compactFieldClassName} w-full`}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search medicines"
            value={search}
          />
        </label>

        <label className="block min-w-0">
          <span className="sr-only">Category</span>
          <select
            className={`${compactFieldClassName} w-full`}
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

        <label className="block min-w-0">
          <span className="sr-only">Manufacturer</span>
          <select
            className={`${compactFieldClassName} w-full`}
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

        <label className="block min-w-0">
          <span className="sr-only">Status</span>
          <select
            className={`${compactFieldClassName} w-full`}
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

        <label className="block min-w-0">
          <span className="sr-only">Sort by</span>
          <select
            className={`${compactFieldClassName} w-full`}
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

        <button
          className="h-11 shrink-0 whitespace-nowrap rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          onClick={() => {
            setSearch("");
            setStatusFilter("all");
            setCategoryFilter("");
            setManufacturerFilter("");
            setSortBy("medicineName");
            setPage(1);
          }}
          type="button"
        >
          Clear filters
        </button>
      </div>

      <SectionCard title="Medicine catalog">
        <ResponsiveDataList
          data={medicines}
          isLoading={medicinesQuery.isLoading}
          keyExtractor={(item) => item.id}
          emptyState={{
            title: "No medicines found",
            description:
              "No medicines match the current search. Try adding one if the catalog is empty.",
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
          tableClassName="min-w-[980px] w-full border-separate border-spacing-y-2.5"
          columns={[
            {
              header: "Medicine",
              accessor: (medicine) => {
                const secondaryText = [medicine.genericName, medicine.strength]
                  .filter(Boolean)
                  .join(" | ");

                return (
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-950">
                      <TruncatedText value={medicine.medicineName} />
                    </p>
                    <p className="text-sm text-slate-600" title={secondaryText || "-"}>
                      {getPreviewText(secondaryText)}
                    </p>
                  </div>
                );
              },
              className: "rounded-l-3xl px-4 py-4",
            },
            {
              header: "Form",
              accessor: (medicine) => (
                <TruncatedText value={`${medicine.form} / ${medicine.unit}`} />
              ),
            },
            {
              header: "Category",
              accessor: (medicine) => (
                <TruncatedText value={medicine.category.name} />
              ),
            },
            {
              header: "Manufacturer",
              accessor: (medicine) => (
                <TruncatedText value={medicine.manufacturer.name} />
              ),
            },
            {
              header: "GST",
              accessor: (medicine) => (
                <TruncatedText value={`${medicine.gstPercent}%`} />
              ),
            },
            {
              header: "Reorder",
              accessor: (medicine) => (
                <TruncatedText value={medicine.reorderLevel} />
              ),
            },
            {
              header: "Prescription",
              accessor: (medicine) => (
                <CompactBadge
                  label={medicine.prescriptionRequired ? "Required" : "Open sale"}
                  toneClassName={
                    medicine.prescriptionRequired
                      ? "bg-amber-50 text-amber-700 ring-amber-200"
                      : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  }
                />
              ),
            },
            {
              header: "Status",
              accessor: (medicine) => (
                <CompactBadge
                  label={medicine.status}
                  toneClassName={
                    medicine.status === "active"
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-slate-100 text-slate-600 ring-slate-200"
                  }
                />
              ),
            },
            {
              header: "Actions",
              accessor: (medicine) => (
                <div className="flex justify-end gap-2">
                  <button
                    aria-label={`Edit ${medicine.medicineName}`}
                    className="rounded-2xl border border-slate-200 p-2.5 text-slate-700 transition hover:border-slate-300 hover:bg-white"
                    onClick={() => {
                      setEditingMedicine(medicine);
                      setIsFormOpen(true);
                    }}
                    title="Edit medicine"
                    type="button"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    aria-label={
                      medicine.status === "active"
                        ? `Deactivate ${medicine.medicineName}`
                        : `Activate ${medicine.medicineName}`
                    }
                    className="rounded-2xl border border-slate-200 p-2.5 text-slate-700 transition hover:border-slate-300 hover:bg-white"
                    onClick={() => setPendingStatusMedicine(medicine)}
                    title={
                      medicine.status === "active"
                        ? "Deactivate medicine"
                        : "Activate medicine"
                    }
                    type="button"
                  >
                    {medicine.status === "active" ? (
                      <Ban className="h-4 w-4" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ),
              className: "rounded-r-3xl px-4 py-4 text-right",
              headerClassName: "px-4 text-right",
            },
          ]}
          renderCard={(medicine) => (
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
                  <p className="text-sm text-slate-600">{medicine.genericName}</p>
                </div>
                <button
                  className="rounded-2xl border border-slate-200 p-2.5 text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  onClick={() => {
                    setEditingMedicine(medicine);
                    setIsFormOpen(true);
                  }}
                  title="Edit medicine"
                  type="button"
                >
                  <Pencil className="h-4 w-4" />
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
                    medicine.prescriptionRequired ? "Required" : "Not required",
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

              <div className="mt-4 flex justify-end">
                <button
                  aria-label={
                    medicine.status === "active"
                      ? `Deactivate ${medicine.medicineName}`
                      : `Activate ${medicine.medicineName}`
                  }
                  className="rounded-2xl border border-slate-200 p-2.5 text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  onClick={() => setPendingStatusMedicine(medicine)}
                  title={
                    medicine.status === "active"
                      ? "Deactivate medicine"
                      : "Activate medicine"
                  }
                  type="button"
                >
                  {medicine.status === "active" ? (
                    <Ban className="h-4 w-4" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </button>
              </div>
            </article>
          )}
        />
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
