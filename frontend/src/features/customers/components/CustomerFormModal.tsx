import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormSection } from "../../../components/ui/FormSection";
import { Modal } from "../../../components/ui/Modal";
import { toDateInputValue } from "../../../lib/utils";
import type { CustomerListItem, SaveCustomerPayload } from "../../../types/customer";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

const phoneIsValid = (value: string) => value.replace(/\D/g, "").length >= 10;

const customerFormSchema = z
  .object({
    fullName: z.string().trim().min(2, "Customer name is required.").max(160),
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
    gender: z.enum(["male", "female", "other"]).or(z.literal("")),
    age: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || (Number(value) >= 0 && Number(value) <= 130),
        "Age must be between 0 and 130.",
      )
      .optional()
      .or(z.literal("")),
    dateOfBirth: z.string().trim().optional().or(z.literal("")),
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

type CustomerFormValues = z.infer<typeof customerFormSchema>;

interface CustomerFormModalProps {
  open: boolean;
  customer?: CustomerListItem | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: SaveCustomerPayload) => Promise<void>;
  errorMessage?: string;
}

const defaultValues: CustomerFormValues = {
  fullName: "",
  mobileNumber: "",
  alternateMobileNumber: "",
  email: "",
  gender: "",
  age: "",
  dateOfBirth: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  notes: "",
  status: "active",
};

const toPayload = (values: CustomerFormValues): SaveCustomerPayload => ({
  fullName: values.fullName.trim(),
  mobileNumber: values.mobileNumber.trim(),
  alternateMobileNumber: values.alternateMobileNumber?.trim()
    ? values.alternateMobileNumber.trim()
    : null,
  email: values.email?.trim() ? values.email.trim().toLowerCase() : null,
  gender: values.gender || null,
  age: values.age?.trim() ? Number(values.age) : null,
  dateOfBirth: values.dateOfBirth?.trim() ? values.dateOfBirth : null,
  addressLine1: values.addressLine1?.trim() ? values.addressLine1.trim() : null,
  addressLine2: values.addressLine2?.trim() ? values.addressLine2.trim() : null,
  city: values.city?.trim() ? values.city.trim() : null,
  state: values.state?.trim() ? values.state.trim() : null,
  pincode: values.pincode?.trim() ? values.pincode.trim() : null,
  notes: values.notes?.trim() ? values.notes.trim() : null,
  status: values.status,
});

export const CustomerFormModal = ({
  open,
  customer,
  isSubmitting,
  onClose,
  onSubmit,
  errorMessage,
}: CustomerFormModalProps) => {
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      return;
    }

    if (!customer) {
      form.reset(defaultValues);
      return;
    }

    form.reset({
      fullName: customer.fullName,
      mobileNumber: customer.mobileNumber,
      alternateMobileNumber: customer.alternateMobileNumber ?? "",
      email: customer.email ?? "",
      gender: customer.gender ?? "",
      age: customer.age?.toString() ?? "",
      dateOfBirth: toDateInputValue(customer.dateOfBirth),
      addressLine1: customer.addressLine1 ?? "",
      addressLine2: customer.addressLine2 ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
      pincode: customer.pincode ?? "",
      notes: customer.notes ?? "",
      status: customer.status,
    });
  }, [customer, form, open]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <Modal
      bodyClassName="space-y-6"
      description="Keep customer master data clean for billing, due follow-up, and future ledger-ready workflows."
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
            form="customer-form"
            type="submit"
          >
            {isSubmitting ? "Saving..." : customer ? "Save customer" : "Create customer"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      panelClassName="max-w-3xl"
      title={customer ? "Edit customer" : "Add customer"}
    >
      <form
        className="grid gap-6"
        id="customer-form"
        onSubmit={handleSubmit(async (values) => {
          await onSubmit(toPayload(values));
        })}
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <FormSection
            description="Core customer identity used across billing, search, and repeat-buyer visibility."
            title="Customer profile"
          >
            <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Full name
                <input className={inputClassName} {...register("fullName")} />
                {errors.fullName ? (
                  <span className="text-sm text-rose-600">{errors.fullName.message}</span>
                ) : null}
              </label>

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

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Gender
                <select className={inputClassName} {...register("gender")}>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Age
                <input className={inputClassName} {...register("age")} type="number" />
                {errors.age ? (
                  <span className="text-sm text-rose-600">{errors.age.message}</span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Date of birth
                <input className={inputClassName} {...register("dateOfBirth")} type="date" />
              </label>
            </div>
          </FormSection>

          <FormSection
            description="Address and status fields keep customer records ready for follow-up and operational review."
            title="Address and status"
          >
            <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Address line 1
                <input className={inputClassName} {...register("addressLine1")} />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Address line 2
                <input className={inputClassName} {...register("addressLine2")} />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                City
                <input className={inputClassName} {...register("city")} />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                State
                <input className={inputClassName} {...register("state")} />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Pincode
                <input className={inputClassName} {...register("pincode")} />
                {errors.pincode ? (
                  <span className="text-sm text-rose-600">{errors.pincode.message}</span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Status
                <select className={inputClassName} {...register("status")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Notes
                <textarea
                  className={`${inputClassName} min-h-32 resize-none`}
                  {...register("notes")}
                />
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
