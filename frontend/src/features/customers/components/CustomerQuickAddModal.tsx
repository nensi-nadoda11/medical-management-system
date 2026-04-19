import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Modal } from "../../../components/ui/Modal";
import type { CustomerDetail, SaveCustomerPayload } from "../../../types/customer";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

const quickCustomerSchema = z.object({
  fullName: z.string().trim().min(2, "Customer name is required.").max(160),
  mobileNumber: z
    .string()
    .trim()
    .refine((value) => value.replace(/\D/g, "").length >= 10, "Enter a valid mobile number."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal("")),
});

type QuickCustomerValues = z.infer<typeof quickCustomerSchema>;

interface CustomerQuickAddModalProps {
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: SaveCustomerPayload) => Promise<CustomerDetail>;
  onCreated: (customer: CustomerDetail) => void;
  errorMessage?: string;
}

const defaultValues: QuickCustomerValues = {
  fullName: "",
  mobileNumber: "",
  email: "",
};

export const CustomerQuickAddModal = ({
  open,
  isSubmitting,
  onClose,
  onSubmit,
  onCreated,
  errorMessage,
}: CustomerQuickAddModalProps) => {
  const form = useForm<QuickCustomerValues>({
    resolver: zodResolver(quickCustomerSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
    }
  }, [form, open]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <Modal
      description="Add a billing-ready customer without leaving the POS. The full profile can be completed later."
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
            form="quick-customer-form"
            type="submit"
          >
            {isSubmitting ? "Saving..." : "Create customer"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      panelClassName="max-w-2xl"
      title="Quick add customer"
    >
      <form
        className="grid gap-4"
        id="quick-customer-form"
        onSubmit={handleSubmit(async (values) => {
          const createdCustomer = await onSubmit({
            fullName: values.fullName.trim(),
            mobileNumber: values.mobileNumber.trim(),
            email: values.email?.trim() ? values.email.trim().toLowerCase() : null,
            status: "active",
          });
          onCreated(createdCustomer);
        })}
      >
        <label className="grid gap-2 text-sm font-medium text-slate-700">
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
            <span className="text-sm text-rose-600">{errors.mobileNumber.message}</span>
          ) : null}
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Email
          <input className={inputClassName} {...register("email")} />
          {errors.email ? (
            <span className="text-sm text-rose-600">{errors.email.message}</span>
          ) : null}
        </label>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
      </form>
    </Modal>
  );
};
