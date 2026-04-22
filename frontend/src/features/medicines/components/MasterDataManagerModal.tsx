import { zodResolver } from "@hookform/resolvers/zod";
import { useDeferredValue, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { EmptyState } from "../../../components/ui/EmptyState";
import { FormSection } from "../../../components/ui/FormSection";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Modal } from "../../../components/ui/Modal";
import { Pagination } from "../../../components/ui/Pagination";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useToast } from "../../../hooks/use-toast";
import type {
  Manufacturer,
  MedicineCategory,
  MedicineMasterListParams,
  MasterStatus,
} from "../../../types/medicine";
import {
  createCategory,
  createManufacturer,
  deleteCategory,
  deleteManufacturer,
  listCategories,
  listManufacturers,
  medicinesQueryKeys,
  updateCategory,
  updateManufacturer,
} from "../api/medicines";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

const masterDataSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(160),
  description: z.string().trim().max(255).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
});

type MasterDataFormValues = z.infer<typeof masterDataSchema>;
type MasterRecord = MedicineCategory | Manufacturer;

const getRecordDescription = (record: MasterRecord) =>
  "description" in record ? record.description : null;

interface MasterDataManagerModalProps {
  mode: "category" | "manufacturer";
  open: boolean;
  onClose: () => void;
}

export const MasterDataManagerModal = ({
  mode,
  open,
  onClose,
}: MasterDataManagerModalProps) => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MasterStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [editingRecord, setEditingRecord] = useState<MasterRecord | null>(null);
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState<MasterRecord | null>(null);
  const deferredSearch = useDeferredValue(search);

  const isCategoryMode = mode === "category";
  const labels = isCategoryMode
    ? {
        title: "Manage categories",
        singular: "category",
        description:
          "Keep medicine categories clean and well organized so teams can classify products consistently.",
      }
    : {
        title: "Manage manufacturers",
        singular: "manufacturer",
        description:
          "Maintain manufacturer master data used across catalog, purchase, and inventory workflows.",
      };

  const params: MedicineMasterListParams = {
    search: deferredSearch || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    pageSize: 8,
    sortBy: "name",
    sortOrder: "asc",
  };

  const listQuery = useQuery({
    queryKey: isCategoryMode
      ? medicinesQueryKeys.categoryList(params)
      : medicinesQueryKeys.manufacturerList(params),
    queryFn: () =>
      isCategoryMode ? listCategories(params) : listManufacturers(params),
    enabled: open,
  });

  const form = useForm<MasterDataFormValues>({
    resolver: zodResolver(masterDataSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "active",
    },
  });

  useEffect(() => {
    if (!editingRecord) {
      form.reset({
        name: "",
        description: "",
        status: "active",
      });
      return;
    }

    form.reset({
      name: editingRecord.name,
      description: "description" in editingRecord ? editingRecord.description ?? "" : "",
      status: editingRecord.status,
    });
  }, [editingRecord, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: MasterDataFormValues) => {
      if (isCategoryMode) {
        if (editingRecord) {
          return updateCategory(editingRecord.id, {
            name: values.name.trim(),
            description: values.description?.trim() ? values.description.trim() : null,
            status: values.status,
          });
        }

        return createCategory({
          name: values.name.trim(),
          description: values.description?.trim() ? values.description.trim() : null,
          status: values.status,
        });
      }

      if (editingRecord) {
        return updateManufacturer(editingRecord.id, {
          name: values.name.trim(),
          status: values.status,
        });
      }

      return createManufacturer({
        name: values.name.trim(),
        status: values.status,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: isCategoryMode
            ? medicinesQueryKeys.categories
            : medicinesQueryKeys.manufacturers,
        }),
        queryClient.invalidateQueries({ queryKey: medicinesQueryKeys.lists() }),
      ]);

      pushToast({
        title: editingRecord
          ? `${isCategoryMode ? "Category" : "Manufacturer"} updated`
          : `${isCategoryMode ? "Category" : "Manufacturer"} created`,
        description: isCategoryMode
          ? "Medicine category data has been refreshed successfully."
          : "Manufacturer data has been refreshed successfully.",
        variant: "success",
      });

      setEditingRecord(null);
      form.reset({
        name: "",
        description: "",
        status: "active",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isCategoryMode) {
        return deleteCategory(id);
      }
      return deleteManufacturer(id);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: isCategoryMode
            ? medicinesQueryKeys.categories
            : medicinesQueryKeys.manufacturers,
        }),
        queryClient.invalidateQueries({ queryKey: medicinesQueryKeys.lists() }),
      ]);

      pushToast({
        title: `${isCategoryMode ? "Category" : "Manufacturer"} deleted`,
        description: "The record has been removed from the library successfully.",
        variant: "success",
      });

      setPendingDeleteRecord(null);
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      pushToast({
        title: "Deletion failed",
        description: err.response?.data?.error?.message || "An unexpected error occurred while deleting the record.",
        variant: "error",
      });
    },
  });

  const records = listQuery.data?.items ?? [];
  const pagination = listQuery.data?.pagination;

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = form;

  const resetModalState = () => {
    setSearch("");
    setStatusFilter("all");
    setPage(1);
    setEditingRecord(null);
    form.reset({
      name: "",
      description: "",
      status: "active",
    });
  };

  return (
    <Modal
      bodyClassName="space-y-6"
      description={labels.description}
      footer={
        <>
          <button
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={resetModalState}
            type="button"
          >
            {editingRecord ? "Clear selection" : "Reset form"}
          </button>
          <button
            className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saveMutation.isPending || (!isDirty && !editingRecord)}
            form={`${mode}-master-form`}
            type="submit"
          >
            {saveMutation.isPending
              ? "Saving..."
              : editingRecord
                ? `Save ${labels.singular}`
                : `Create ${labels.singular}`}
          </button>
        </>
      }
      onClose={() => {
        resetModalState();
        onClose();
      }}
      open={open}
      panelClassName="max-w-5xl"
      title={labels.title}
    >
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <FormSection
          description={`Use this compact form to ${editingRecord ? "update" : "add"} a ${labels.singular} without leaving the catalog workspace.`}
          title={editingRecord ? `Edit ${labels.singular}` : `New ${labels.singular}`}
        >
          <form
            className="grid gap-4"
            id={`${mode}-master-form`}
            onSubmit={handleSubmit(async (values) => {
              await saveMutation.mutateAsync(values);
            })}
          >
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              {isCategoryMode ? "Category name" : "Manufacturer name"}
              <input
                className={inputClassName}
                placeholder={isCategoryMode ? "Analgesics" : "Sunrise Pharma"}
                {...register("name")}
              />
              {errors.name ? (
                <span className="text-sm text-rose-600">{errors.name.message}</span>
              ) : null}
            </label>

            {isCategoryMode ? (
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Description
                <textarea
                  className={`${inputClassName} min-h-24 resize-none`}
                  placeholder="Short business note for this category"
                  {...register("description")}
                />
                {errors.description ? (
                  <span className="text-sm text-rose-600">
                    {errors.description.message}
                  </span>
                ) : null}
              </label>
            ) : null}

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Status
              <select className={inputClassName} {...register("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              {errors.status ? (
                <span className="text-sm text-rose-600">{errors.status.message}</span>
              ) : null}
            </label>

            {saveMutation.error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {saveMutation.error.message}
              </div>
            ) : null}
          </form>
        </FormSection>

        <FormSection
          description={`Search, review, and reopen any existing ${isCategoryMode ? "category" : "manufacturer"} record from here.`}
          title={`${isCategoryMode ? "Category" : "Manufacturer"} library`}
        >
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_180px]">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Search
                <input
                  className={inputClassName}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder={`Search ${isCategoryMode ? "categories" : "manufacturers"}`}
                  value={search}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Status
                <select
                  className={inputClassName}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as MasterStatus | "all");
                    setPage(1);
                  }}
                  value={statusFilter}
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>

            {listQuery.isLoading ? (
              <LoadingState
                description={`Please wait while we load ${isCategoryMode ? "category" : "manufacturer"} data.`}
                title={`Loading ${isCategoryMode ? "categories" : "manufacturers"}`}
              />
            ) : records.length ? (
              <div className="space-y-3">
                {records.map((record) => {
                  const recordDescription = getRecordDescription(record);

                  return (
                    <article
                      className="rounded-[20px] border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/50"
                      key={record.id}
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="truncate text-sm font-semibold text-slate-950">
                              {record.name}
                            </h4>
                            <StatusBadge label={record.status} />
                          </div>
                          {recordDescription ? (
                            <p className="truncate text-xs text-slate-500">
                              {recordDescription}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                            onClick={() => setEditingRecord(record)}
                            title="Edit"
                            type="button"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-100 text-rose-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                            onClick={() => setPendingDeleteRecord(record)}
                            title="Delete"
                            type="button"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}

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
                description={`No ${labels.singular} records match the current filters.`}
                title={`No ${labels.singular}s found`}
              />
            )}
          </div>
        </FormSection>
      </div>

      <ConfirmDialog
        confirmLabel={`Delete ${labels.singular}`}
        description={`This action cannot be undone. Are you sure you want to remove this ${labels.singular} permanently?`}
        isLoading={deleteMutation.isPending}
        onClose={() => setPendingDeleteRecord(null)}
        onConfirm={() => {
          if (pendingDeleteRecord) {
            deleteMutation.mutate(pendingDeleteRecord.id);
          }
        }}
        open={Boolean(pendingDeleteRecord)}
        title="Confirm deletion"
        tone="danger"
      />
    </Modal>
  );
};
