import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../hooks/use-toast";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "../../../lib/utils";
import {
  createStockAdjustment,
  getInventoryMedicineDetail,
  inventoryQueryKeys,
  listInventorySummary,
} from "../api/inventory";
import type { CreateStockAdjustmentPayload } from "../../../types/inventory";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

const adjustmentSchema = z.object({
  medicineId: z.string().trim().min(1, "Select a medicine."),
  batchId: z.string().trim().min(1, "Select a batch."),
  adjustmentType: z.enum(["in", "out"]),
  quantity: z.number().int("Quantity must be a whole number.").min(1, "Quantity must be at least 1.").max(1000000, "Quantity is too high."),
  reason: z.string().trim().min(2, "Reason is required.").max(160),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

type AdjustmentFormValues = z.infer<typeof adjustmentSchema>;

interface StockAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  initialMedicineId?: string;
  initialBatchId?: string;
}

const defaultValues: AdjustmentFormValues = {
  medicineId: "",
  batchId: "",
  adjustmentType: "out",
  quantity: 1,
  reason: "",
  notes: "",
};

export const StockAdjustmentModal = ({
  open,
  onClose,
  initialMedicineId,
  initialBatchId,
}: StockAdjustmentModalProps) => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [medicineSearch, setMedicineSearch] = useState("");
  const [pendingPayload, setPendingPayload] =
    useState<AdjustmentFormValues | null>(null);

  const deferredMedicineSearch = useDeferredValue(medicineSearch);

  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues,
  });

  const selectedMedicineId = useWatch({
    control: form.control,
    name: "medicineId",
  });
  const selectedBatchId = useWatch({
    control: form.control,
    name: "batchId",
  });

  const medicineOptionsQuery = useQuery({
    queryKey: inventoryQueryKeys.summary({
      search: deferredMedicineSearch || undefined,
      page: 1,
      pageSize: 20,
      sortBy: "medicineName",
      sortOrder: "asc",
    }),
    queryFn: () =>
      listInventorySummary({
        search: deferredMedicineSearch || undefined,
        page: 1,
        pageSize: 20,
        sortBy: "medicineName",
        sortOrder: "asc",
      }),
    enabled: open,
  });

  const medicineDetailQuery = useQuery({
    queryKey: inventoryQueryKeys.detail(selectedMedicineId || "", false),
    queryFn: () => getInventoryMedicineDetail(selectedMedicineId, false),
    enabled: open && Boolean(selectedMedicineId),
  });

  const adjustmentMutation = useMutation({
    mutationFn: (payload: CreateStockAdjustmentPayload) =>
      createStockAdjustment(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all });
      pushToast({
        title: "Stock adjusted",
        description: "Inventory quantities have been updated successfully.",
        variant: "success",
      });
      setPendingPayload(null);
      setMedicineSearch("");
      form.reset(defaultValues);
      onClose();
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      return;
    }

    form.reset({
      ...defaultValues,
      medicineId: initialMedicineId ?? "",
      batchId: initialBatchId ?? "",
    });
  }, [form, initialBatchId, initialMedicineId, open]);

  useEffect(() => {
    if (!selectedMedicineId) {
      if (selectedBatchId) {
        form.setValue("batchId", "");
      }
      return;
    }

    const currentBatchStillExists = (
      medicineDetailQuery.data?.batches ?? []
    ).some((batch) => batch.id === selectedBatchId);

    if (!currentBatchStillExists && selectedBatchId) {
      form.setValue("batchId", "");
    }
  }, [form, medicineDetailQuery.data?.batches, selectedBatchId, selectedMedicineId]);

  const selectedBatch = (medicineDetailQuery.data?.batches ?? []).find(
    (batch) => batch.id === selectedBatchId,
  );

  const handleClose = () => {
    setMedicineSearch("");
    setPendingPayload(null);
    form.reset(defaultValues);
    onClose();
  };

  return (
    <>
      <Modal
        description="Use controlled adjustments for verified stock corrections only. Every adjustment is recorded in the stock ledger."
        footer={
          <>
            <button
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={handleClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={adjustmentMutation.isPending}
              form="stock-adjustment-form"
              type="submit"
            >
              Review adjustment
            </button>
          </>
        }
        onClose={handleClose}
        open={open}
        panelClassName="max-w-[820px]"
        title="Stock adjustment"
      >
        <form
          className="space-y-5"
          id="stock-adjustment-form"
          onSubmit={form.handleSubmit((values) => setPendingPayload(values))}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              Search medicine
              <input
                className={inputClassName}
                onChange={(event) => setMedicineSearch(event.target.value)}
                placeholder="Search stocked medicine by name"
                value={medicineSearch}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              Medicine
              <select className={inputClassName} {...form.register("medicineId")}>
                <option value="">Select medicine</option>
                {(medicineOptionsQuery.data?.items ?? []).map((item) => (
                  <option key={item.medicine.id} value={item.medicine.id}>
                    {item.medicine.medicineName} - Available {item.availableQuantity}
                  </option>
                ))}
              </select>
              {form.formState.errors.medicineId ? (
                <span className="text-sm text-rose-600">
                  {form.formState.errors.medicineId.message}
                </span>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              Batch
              <select
                className={inputClassName}
                disabled={!selectedMedicineId || medicineDetailQuery.isLoading}
                {...form.register("batchId")}
              >
                <option value="">
                  {selectedMedicineId ? "Select batch" : "Choose medicine first"}
                </option>
                {(medicineDetailQuery.data?.batches ?? []).map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchNumber} - Qty {batch.quantityAvailable} - {formatDate(batch.expiryDate)}
                  </option>
                ))}
              </select>
              {form.formState.errors.batchId ? (
                <span className="text-sm text-rose-600">
                  {form.formState.errors.batchId.message}
                </span>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Adjustment type
              <select className={inputClassName} {...form.register("adjustmentType")}>
                <option value="out">Stock out</option>
                <option value="in">Stock in</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Quantity
              <input
                className={inputClassName}
                type="number"
                {...form.register("quantity", { valueAsNumber: true })}
              />
              {form.formState.errors.quantity ? (
                <span className="text-sm text-rose-600">
                  {form.formState.errors.quantity.message}
                </span>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              Reason
              <input
                className={inputClassName}
                placeholder="Damaged stock, opening correction, expired removal..."
                {...form.register("reason")}
              />
              {form.formState.errors.reason ? (
                <span className="text-sm text-rose-600">
                  {form.formState.errors.reason.message}
                </span>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              Notes
              <textarea
                className={`${inputClassName} min-h-28 resize-none`}
                placeholder="Optional supporting details"
                {...form.register("notes")}
              />
              {form.formState.errors.notes ? (
                <span className="text-sm text-rose-600">
                  {form.formState.errors.notes.message}
                </span>
              ) : null}
            </label>
          </div>

          {selectedBatch ? (
            <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              {[
                ["Batch number", selectedBatch.batchNumber],
                ["Current quantity", formatNumber(selectedBatch.quantityAvailable)],
                ["Expiry", formatDate(selectedBatch.expiryDate)],
                ["Status", selectedBatch.status],
                ["Purchase rate", formatCurrency(selectedBatch.purchaseRate)],
                ["MRP", formatCurrency(selectedBatch.mrp)],
              ].map(([label, value]) => (
                <div
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                  key={label}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          ) : null}

          {adjustmentMutation.error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {adjustmentMutation.error.message}
            </div>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        confirmLabel="Confirm adjustment"
        description="Please confirm the batch, quantity, and reason before posting this stock adjustment."
        extraContent={
          pendingPayload && selectedBatch ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [
                  "Medicine",
                  medicineDetailQuery.data?.medicine.medicineName ?? "Selected medicine",
                ],
                ["Batch", selectedBatch.batchNumber],
                [
                  "Adjustment",
                  pendingPayload.adjustmentType === "in" ? "Stock in" : "Stock out",
                ],
                ["Quantity", formatNumber(pendingPayload.quantity)],
                ["Reason", pendingPayload.reason],
                [
                  "Available before",
                  formatNumber(selectedBatch.quantityAvailable),
                ],
              ].map(([label, value]) => (
                <div
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                  key={label}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          ) : null
        }
        isLoading={adjustmentMutation.isPending}
        onClose={() => setPendingPayload(null)}
        onConfirm={() => {
          if (!pendingPayload) {
            return;
          }

          adjustmentMutation.mutate({
            medicineId: pendingPayload.medicineId,
            batchId: pendingPayload.batchId,
            adjustmentType: pendingPayload.adjustmentType,
            quantity: pendingPayload.quantity,
            reason: pendingPayload.reason.trim(),
            notes: pendingPayload.notes?.trim() ? pendingPayload.notes.trim() : null,
          });
        }}
        open={Boolean(pendingPayload)}
        title="Post stock adjustment?"
        tone="danger"
      />
    </>
  );
};
