import { zodResolver } from "@hookform/resolvers/zod";
import { useDeferredValue, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { EmptyState } from "../../../components/ui/EmptyState";
import { FormSection } from "../../../components/ui/FormSection";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Modal } from "../../../components/ui/Modal";
import { Pagination } from "../../../components/ui/Pagination";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useToast } from "../../../hooks/use-toast";
import { formatDateTime } from "../../../lib/utils";
import type {
  Manufacturer,
  MedicineCategory,
  MedicineMasterListParams,
  MasterStatus,
} from "../../../types/medicine";
import {
  createCategory,
  createManufacturer,
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
    if (!open) {
      setSearch("");
      setStatusFilter("all");
      setPage(1);
      setEditingRecord(null);
      form.reset({
        name: "",
        description: "",
        status: "active",
      });
    }
  }, [form, open]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, statusFilter]);

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

  const records = listQuery.data?.items ?? [];
  const pagination = listQuery.data?.pagination;

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = form;

  return (
    <Modal
      bodyClassName="space-y-6"
      description={labels.description}
      footer={
        <>
          <button
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => {
              setEditingRecord(null);
              form.reset({
                name: "",
                description: "",
                status: "active",
              });
            }}
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
      onClose={onClose}
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
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${isCategoryMode ? "categories" : "manufacturers"}`}
                  value={search}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Status
                <select
                  className={inputClassName}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as MasterStatus | "all")
                  }
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
                      className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
                      key={record.id}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-base font-semibold text-slate-950">
                              {record.name}
                            </h4>
                            <StatusBadge label={record.status} />
                          </div>
                          {recordDescription ? (
                            <p className="text-sm leading-6 text-slate-600">
                              {recordDescription}
                            </p>
                          ) : (
                            <p className="text-sm text-slate-500">
                              No description added yet.
                            </p>
                          )}
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                            Updated {formatDateTime(record.updatedAt)}
                          </p>
                        </div>

                        <button
                          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                          onClick={() => setEditingRecord(record)}
                          type="button"
                        >
                          Edit
                        </button>
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
    </Modal>
  );
};
