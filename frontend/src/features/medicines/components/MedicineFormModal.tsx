import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormSection } from "../../../components/ui/FormSection";
import { Modal } from "../../../components/ui/Modal";
import {
  GST_PERCENTAGES,
  MASTER_STATUSES,
  MEDICINE_FORMS,
  MEDICINE_UNITS,
  type Manufacturer,
  type Medicine,
  type MedicineCategory,
  type SaveMedicinePayload,
} from "../../../types/medicine";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

const medicineFormSchema = z.object({
  medicineName: z.string().trim().min(2, "Medicine name is required.").max(180),
  genericName: z.string().trim().min(2, "Generic name is required.").max(180),
  brandName: z.string().trim().max(160).optional().or(z.literal("")),
  strength: z.string().trim().max(80).optional().or(z.literal("")),
  form: z.enum(MEDICINE_FORMS),
  unit: z.enum(MEDICINE_UNITS),
  categoryId: z.string().trim().min(1, "Select a category."),
  manufacturerId: z.string().trim().min(1, "Select a manufacturer."),
  hsnCode: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || /^\d{4,8}$/.test(value), {
      message: "HSN code must be 4 to 8 digits.",
    })
    .optional()
    .or(z.literal("")),
  gstPercent: z.number().refine(
    (value) => GST_PERCENTAGES.includes(value as (typeof GST_PERCENTAGES)[number]),
    "Choose a valid GST percentage.",
  ),
  barcode: z.string().trim().max(100).optional().or(z.literal("")),
  reorderLevel: z
    .number()
    .int("Reorder level must be a whole number.")
    .min(0, "Reorder level cannot be negative.")
    .max(100000, "Reorder level is too high."),
  prescriptionRequired: z.boolean(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  status: z.enum(MASTER_STATUSES),
});

type MedicineFormValues = z.infer<typeof medicineFormSchema>;

interface MedicineFormModalProps {
  open: boolean;
  medicine?: Medicine | null;
  categories: MedicineCategory[];
  manufacturers: Manufacturer[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: SaveMedicinePayload) => Promise<void>;
  errorMessage?: string;
}

const defaultValues: MedicineFormValues = {
  medicineName: "",
  genericName: "",
  brandName: "",
  strength: "",
  form: "tablet",
  unit: "strip",
  categoryId: "",
  manufacturerId: "",
  hsnCode: "",
  gstPercent: 5,
  barcode: "",
  reorderLevel: 0,
  prescriptionRequired: false,
  notes: "",
  status: "active",
};

const toPayload = (values: MedicineFormValues): SaveMedicinePayload => ({
  medicineName: values.medicineName.trim(),
  genericName: values.genericName.trim(),
  brandName: values.brandName?.trim() ? values.brandName.trim() : null,
  strength: values.strength?.trim() ? values.strength.trim() : null,
  form: values.form,
  unit: values.unit,
  categoryId: values.categoryId,
  manufacturerId: values.manufacturerId,
  hsnCode: values.hsnCode?.trim() ? values.hsnCode.trim() : null,
  gstPercent: values.gstPercent as (typeof GST_PERCENTAGES)[number],
  barcode: values.barcode?.trim() ? values.barcode.trim() : null,
  reorderLevel: values.reorderLevel,
  prescriptionRequired: values.prescriptionRequired,
  notes: values.notes?.trim() ? values.notes.trim() : null,
  status: values.status,
});

export const MedicineFormModal = ({
  open,
  medicine,
  categories,
  manufacturers,
  isSubmitting,
  onClose,
  onSubmit,
  errorMessage,
}: MedicineFormModalProps) => {
  const form = useForm<MedicineFormValues>({
    resolver: zodResolver(medicineFormSchema),
    defaultValues,
  });

  const preferredCategoryId =
    categories.find((category) => category.status === "active")?.id ?? categories[0]?.id ?? "";
  const preferredManufacturerId =
    manufacturers.find((manufacturer) => manufacturer.status === "active")?.id ??
    manufacturers[0]?.id ??
    "";

  useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      return;
    }

    if (!medicine) {
      form.reset({
        ...defaultValues,
        categoryId: preferredCategoryId,
        manufacturerId: preferredManufacturerId,
      });
      return;
    }

    form.reset({
      medicineName: medicine.medicineName,
      genericName: medicine.genericName,
      brandName: medicine.brandName ?? "",
      strength: medicine.strength ?? "",
      form: medicine.form,
      unit: medicine.unit,
      categoryId: medicine.category.id,
      manufacturerId: medicine.manufacturer.id,
      hsnCode: medicine.hsnCode ?? "",
      gstPercent: medicine.gstPercent,
      barcode: medicine.barcode ?? "",
      reorderLevel: medicine.reorderLevel,
      prescriptionRequired: medicine.prescriptionRequired,
      notes: medicine.notes ?? "",
      status: medicine.status,
    });
  }, [form, manufacturers, medicine, open, preferredCategoryId, preferredManufacturerId]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  const hasLookupData = categories.length > 0 && manufacturers.length > 0;

  return (
    <Modal
      bodyClassName="space-y-6"
      description="Capture clean product master data that will later power purchase, billing, and stock workflows."
      footer={
        <>
          <button
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting || !hasLookupData}
            form="medicine-form"
            type="submit"
          >
            {isSubmitting ? "Saving..." : medicine ? "Save changes" : "Create medicine"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      panelClassName="max-w-5xl"
      title={medicine ? "Edit medicine" : "Add medicine"}
    >
      {!hasLookupData ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Create at least one active category and one manufacturer before adding a
          medicine.
        </div>
      ) : null}

      <form
        className="grid gap-6"
        id="medicine-form"
        onSubmit={handleSubmit(async (values) => {
          await onSubmit(toPayload(values));
        })}
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <FormSection
            description="These fields define how the medicine appears across catalog and future transactional workflows."
            title="Core details"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Medicine name
                <input className={inputClassName} {...register("medicineName")} />
                {errors.medicineName ? (
                  <span className="text-sm text-rose-600">
                    {errors.medicineName.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Generic name
                <input className={inputClassName} {...register("genericName")} />
                {errors.genericName ? (
                  <span className="text-sm text-rose-600">
                    {errors.genericName.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Brand name
                <input className={inputClassName} {...register("brandName")} />
                {errors.brandName ? (
                  <span className="text-sm text-rose-600">{errors.brandName.message}</span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Strength
                <input
                  className={inputClassName}
                  placeholder="500 mg"
                  {...register("strength")}
                />
                {errors.strength ? (
                  <span className="text-sm text-rose-600">{errors.strength.message}</span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Form
                <select className={inputClassName} {...register("form")}>
                  {MEDICINE_FORMS.map((formOption) => (
                    <option key={formOption} value={formOption}>
                      {formOption}
                    </option>
                  ))}
                </select>
                {errors.form ? (
                  <span className="text-sm text-rose-600">{errors.form.message}</span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Unit
                <select className={inputClassName} {...register("unit")}>
                  {MEDICINE_UNITS.map((unitOption) => (
                    <option key={unitOption} value={unitOption}>
                      {unitOption}
                    </option>
                  ))}
                </select>
                {errors.unit ? (
                  <span className="text-sm text-rose-600">{errors.unit.message}</span>
                ) : null}
              </label>
            </div>
          </FormSection>

          <FormSection
            description="Link the medicine to the right category and manufacturer for clean reporting and downstream operations."
            title="Classification"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Category
                <select className={inputClassName} {...register("categoryId")}>
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                      {category.status === "inactive" ? " (inactive)" : ""}
                    </option>
                  ))}
                </select>
                {errors.categoryId ? (
                  <span className="text-sm text-rose-600">
                    {errors.categoryId.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Manufacturer
                <select className={inputClassName} {...register("manufacturerId")}>
                  <option value="">Select manufacturer</option>
                  {manufacturers.map((manufacturer) => (
                    <option key={manufacturer.id} value={manufacturer.id}>
                      {manufacturer.name}
                      {manufacturer.status === "inactive" ? " (inactive)" : ""}
                    </option>
                  ))}
                </select>
                {errors.manufacturerId ? (
                  <span className="text-sm text-rose-600">
                    {errors.manufacturerId.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                GST percent
                <select
                  className={inputClassName}
                  {...register("gstPercent", { valueAsNumber: true })}
                >
                  {GST_PERCENTAGES.map((gstOption) => (
                    <option key={gstOption} value={gstOption}>
                      {gstOption}%
                    </option>
                  ))}
                </select>
                {errors.gstPercent ? (
                  <span className="text-sm text-rose-600">
                    {errors.gstPercent.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Reorder level
                <input
                  className={inputClassName}
                  type="number"
                  {...register("reorderLevel", { valueAsNumber: true })}
                />
                {errors.reorderLevel ? (
                  <span className="text-sm text-rose-600">
                    {errors.reorderLevel.message}
                  </span>
                ) : null}
              </label>
            </div>
          </FormSection>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <FormSection
            description="Reference attributes help with barcode lookup, tax mapping, and compliance workflows."
            title="Reference fields"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                HSN code
                <input className={inputClassName} {...register("hsnCode")} />
                {errors.hsnCode ? (
                  <span className="text-sm text-rose-600">{errors.hsnCode.message}</span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Barcode
                <input className={inputClassName} {...register("barcode")} />
                {errors.barcode ? (
                  <span className="text-sm text-rose-600">{errors.barcode.message}</span>
                ) : null}
              </label>

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

              <label className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                <input type="checkbox" {...register("prescriptionRequired")} />
                Prescription required
              </label>
            </div>
          </FormSection>

          <FormSection
            description="Add internal notes only when they improve downstream understanding for your team."
            title="Operational notes"
          >
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Notes
                <textarea
                  className={`${inputClassName} min-h-32 resize-none`}
                  {...register("notes")}
                />
                {errors.notes ? (
                  <span className="text-sm text-rose-600">{errors.notes.message}</span>
                ) : null}
              </label>
            </div>
          </FormSection>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
      </form>
    </Modal>
  );
};
