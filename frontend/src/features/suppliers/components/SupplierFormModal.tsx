import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormSection } from "../../../components/ui/FormSection";
import { Modal } from "../../../components/ui/Modal";
import type { SaveSupplierPayload, Supplier } from "../../../types/supplier";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

const phoneIsValid = (value: string) => value.replace(/\D/g, "").length >= 10;

const supplierFormSchema = z
  .object({
    supplierName: z.string().trim().min(2, "Supplier name is required.").max(180),
    companyName: z.string().trim().max(180).optional().or(z.literal("")),
    contactPerson: z.string().trim().max(160).optional().or(z.literal("")),
    mobileNumber: z
      .string()
      .trim()
      .refine((value) => phoneIsValid(value), "Enter a valid mobile number."),
    alternateMobileNumber: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || phoneIsValid(value),
        "Enter a valid alternate mobile number.",
      )
      .optional()
      .or(z.literal("")),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address.")
      .optional()
      .or(z.literal("")),
    gstNumber: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || /^[0-9A-Za-z]{15}$/.test(value),
        "GST number must be 15 characters.",
      )
      .optional()
      .or(z.literal("")),
    drugLicenseNumber: z.string().trim().max(100).optional().or(z.literal("")),
    addressLine1: z.string().trim().max(255).optional().or(z.literal("")),
    addressLine2: z.string().trim().max(255).optional().or(z.literal("")),
    city: z.string().trim().max(100).optional().or(z.literal("")),
    state: z.string().trim().max(100).optional().or(z.literal("")),
    pincode: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || /^\d{6}$/.test(value),
        "Pincode must be a valid 6-digit code.",
      )
      .optional()
      .or(z.literal("")),
    openingBalance: z
      .string()
      .trim()
      .refine(
        (value) => /^-?\d{1,11}(\.\d{1,2})?$/.test(value),
        "Opening balance must be a valid amount with up to 2 decimal places.",
      ),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
    status: z.enum(["active", "inactive"]),
  })
  .superRefine((value, ctx) => {
    const primaryDigits = value.mobileNumber.replace(/\D/g, "");
    const alternateDigits = value.alternateMobileNumber?.replace(/\D/g, "") ?? "";

    if (alternateDigits.length > 0 && primaryDigits === alternateDigits) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alternateMobileNumber"],
        message: "Alternate mobile number must be different from mobile number.",
      });
    }
  });

type SupplierFormValues = z.infer<typeof supplierFormSchema>;

interface SupplierFormModalProps {
  open: boolean;
  supplier?: Supplier | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: SaveSupplierPayload) => Promise<void>;
  errorMessage?: string;
}

const defaultValues: SupplierFormValues = {
  supplierName: "",
  companyName: "",
  contactPerson: "",
  mobileNumber: "",
  alternateMobileNumber: "",
  email: "",
  gstNumber: "",
  drugLicenseNumber: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  openingBalance: "0.00",
  notes: "",
  status: "active",
};

const toPayload = (values: SupplierFormValues): SaveSupplierPayload => ({
  supplierName: values.supplierName.trim(),
  companyName: values.companyName?.trim() ? values.companyName.trim() : null,
  contactPerson: values.contactPerson?.trim() ? values.contactPerson.trim() : null,
  mobileNumber: values.mobileNumber.trim(),
  alternateMobileNumber: values.alternateMobileNumber?.trim()
    ? values.alternateMobileNumber.trim()
    : null,
  email: values.email?.trim() ? values.email.trim().toLowerCase() : null,
  gstNumber: values.gstNumber?.trim() ? values.gstNumber.trim().toUpperCase() : null,
  drugLicenseNumber: values.drugLicenseNumber?.trim()
    ? values.drugLicenseNumber.trim()
    : null,
  addressLine1: values.addressLine1?.trim() ? values.addressLine1.trim() : null,
  addressLine2: values.addressLine2?.trim() ? values.addressLine2.trim() : null,
  city: values.city?.trim() ? values.city.trim() : null,
  state: values.state?.trim() ? values.state.trim() : null,
  pincode: values.pincode?.trim() ? values.pincode.trim() : null,
  openingBalance: Number(values.openingBalance).toFixed(2),
  notes: values.notes?.trim() ? values.notes.trim() : null,
  status: values.status,
});

export const SupplierFormModal = ({
  open,
  supplier,
  isSubmitting,
  onClose,
  onSubmit,
  errorMessage,
}: SupplierFormModalProps) => {
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      return;
    }

    if (!supplier) {
      form.reset(defaultValues);
      return;
    }

    form.reset({
      supplierName: supplier.supplierName,
      companyName: supplier.companyName ?? "",
      contactPerson: supplier.contactPerson ?? "",
      mobileNumber: supplier.mobileNumber,
      alternateMobileNumber: supplier.alternateMobileNumber ?? "",
      email: supplier.email ?? "",
      gstNumber: supplier.gstNumber ?? "",
      drugLicenseNumber: supplier.drugLicenseNumber ?? "",
      addressLine1: supplier.addressLine1 ?? "",
      addressLine2: supplier.addressLine2 ?? "",
      city: supplier.city ?? "",
      state: supplier.state ?? "",
      pincode: supplier.pincode ?? "",
      openingBalance: supplier.openingBalance,
      notes: supplier.notes ?? "",
      status: supplier.status,
    });
  }, [form, open, supplier]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <Modal
      bodyClassName="space-y-6"
      description="Capture supplier contact and compliance details in a way that will stay ready for purchases and payment tracking."
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
            disabled={isSubmitting}
            form="supplier-form"
            type="submit"
          >
            {isSubmitting ? "Saving..." : supplier ? "Save supplier" : "Create supplier"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      panelClassName="max-w-6xl"
      title={supplier ? "Edit supplier" : "Add supplier"}
    >
      <form
        className="grid gap-6"
        id="supplier-form"
        onSubmit={handleSubmit(async (values) => {
          await onSubmit(toPayload(values));
        })}
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <FormSection
            description="Business-facing identifiers used across supplier search and purchase workflows."
            title="Business details"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Supplier name
                <input className={inputClassName} {...register("supplierName")} />
                {errors.supplierName ? (
                  <span className="text-sm text-rose-600">
                    {errors.supplierName.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Company name
                <input className={inputClassName} {...register("companyName")} />
                {errors.companyName ? (
                  <span className="text-sm text-rose-600">
                    {errors.companyName.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Contact person
                <input className={inputClassName} {...register("contactPerson")} />
                {errors.contactPerson ? (
                  <span className="text-sm text-rose-600">
                    {errors.contactPerson.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                GST number
                <input className={inputClassName} {...register("gstNumber")} />
                {errors.gstNumber ? (
                  <span className="text-sm text-rose-600">{errors.gstNumber.message}</span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Drug license number
                <input className={inputClassName} {...register("drugLicenseNumber")} />
                {errors.drugLicenseNumber ? (
                  <span className="text-sm text-rose-600">
                    {errors.drugLicenseNumber.message}
                  </span>
                ) : null}
              </label>
            </div>
          </FormSection>

          <FormSection
            description="Keep primary and alternate contact information clean for day-to-day coordination."
            title="Contact details"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Mobile number
                <input className={inputClassName} {...register("mobileNumber")} />
                {errors.mobileNumber ? (
                  <span className="text-sm text-rose-600">
                    {errors.mobileNumber.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Alternate mobile
                <input className={inputClassName} {...register("alternateMobileNumber")} />
                {errors.alternateMobileNumber ? (
                  <span className="text-sm text-rose-600">
                    {errors.alternateMobileNumber.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Email
                <input className={inputClassName} {...register("email")} />
                {errors.email ? (
                  <span className="text-sm text-rose-600">{errors.email.message}</span>
                ) : null}
              </label>
            </div>
          </FormSection>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <FormSection
            description="Address information improves supplier discovery, delivery coordination, and reporting."
            title="Address"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Address line 1
                <input className={inputClassName} {...register("addressLine1")} />
                {errors.addressLine1 ? (
                  <span className="text-sm text-rose-600">
                    {errors.addressLine1.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Address line 2
                <input className={inputClassName} {...register("addressLine2")} />
                {errors.addressLine2 ? (
                  <span className="text-sm text-rose-600">
                    {errors.addressLine2.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                City
                <input className={inputClassName} {...register("city")} />
                {errors.city ? (
                  <span className="text-sm text-rose-600">{errors.city.message}</span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                State
                <input className={inputClassName} {...register("state")} />
                {errors.state ? (
                  <span className="text-sm text-rose-600">{errors.state.message}</span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Pincode
                <input className={inputClassName} {...register("pincode")} />
                {errors.pincode ? (
                  <span className="text-sm text-rose-600">{errors.pincode.message}</span>
                ) : null}
              </label>
            </div>
          </FormSection>

          <FormSection
            description="Set supplier advance opening balance and internal notes from day one for cleaner financial readiness."
            title="Accounting setup"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Opening balance
                <input className={inputClassName} {...register("openingBalance")} />
                {errors.openingBalance ? (
                  <span className="text-sm text-rose-600">
                    {errors.openingBalance.message}
                  </span>
                ) : null}
                <span className="text-xs text-slate-500">
                  Enter a positive amount when advance is already lying with this supplier.
                </span>
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

              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
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
