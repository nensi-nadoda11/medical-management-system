import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Modal } from "../../../components/ui/Modal";
import { formatCurrency, formatDate, toDateInputValue } from "../../../lib/utils";
import type {
  CustomerPaymentMethod,
  CustomerPurchaseHistoryItem,
  SaveCustomerPaymentPayload,
} from "../../../types/customer";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

const paymentSchema = z.object({
  saleId: z.string().trim().optional().or(z.literal("")),
  amount: z
    .string()
    .trim()
    .refine((value) => Number(value) > 0, "Payment amount must be greater than zero."),
  paymentMethod: z.enum(["cash", "upi", "card", "bank_transfer", "cheque"]),
  referenceNumber: z.string().trim().max(120).optional().or(z.literal("")),
  paymentDate: z.string().trim().min(1, "Payment date is required."),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface CustomerPaymentModalProps {
  open: boolean;
  isSubmitting: boolean;
  dueBills: CustomerPurchaseHistoryItem[];
  onClose: () => void;
  onSubmit: (payload: SaveCustomerPaymentPayload) => Promise<void>;
  errorMessage?: string;
}

const defaultValues: PaymentFormValues = {
  saleId: "",
  amount: "",
  paymentMethod: "cash",
  referenceNumber: "",
  paymentDate: toDateInputValue(new Date()),
  notes: "",
};

const paymentMethods: Array<{ value: CustomerPaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
];

export const CustomerPaymentModal = ({
  open,
  isSubmitting,
  dueBills,
  onClose,
  onSubmit,
  errorMessage,
}: CustomerPaymentModalProps) => {
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
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

  const selectedSaleId = useWatch({ control: form.control, name: "saleId" });
  const selectedBill = dueBills.find((bill) => bill.id === selectedSaleId);

  return (
    <Modal
      description="Record a bill-specific receipt or a general payment that the backend will safely allocate against due bills."
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
            form="customer-payment-form"
            type="submit"
          >
            {isSubmitting ? "Saving..." : "Record payment"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      panelClassName="max-w-3xl"
      title="Record customer payment"
    >
      <form
        className="grid gap-4"
        id="customer-payment-form"
        onSubmit={handleSubmit(async (values) => {
          await onSubmit({
            saleId: values.saleId || undefined,
            amount: Number(values.amount),
            paymentMethod: values.paymentMethod,
            referenceNumber: values.referenceNumber?.trim() || null,
            paymentDate: values.paymentDate,
            notes: values.notes?.trim() || null,
          });
        })}
      >
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Apply to bill
          <select className={inputClassName} {...register("saleId")}>
            <option value="">Auto allocate to oldest due bills</option>
            {dueBills.map((bill) => (
              <option key={bill.id} value={bill.id}>
                {bill.billNumber} / Due {formatCurrency(bill.dueAmount)} / {formatDate(bill.billDate)}
              </option>
            ))}
          </select>
        </label>

        {selectedBill ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Selected bill due: {formatCurrency(selectedBill.dueAmount)}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Amount
            <input
              className={inputClassName}
              {...register("amount")}
              step="0.01"
              type="number"
            />
            {errors.amount ? (
              <span className="text-sm text-rose-600">{errors.amount.message}</span>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Payment method
            <select className={inputClassName} {...register("paymentMethod")}>
              {paymentMethods.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Reference number
            <input className={inputClassName} {...register("referenceNumber")} />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Payment date
            <input className={inputClassName} {...register("paymentDate")} type="date" />
            {errors.paymentDate ? (
              <span className="text-sm text-rose-600">{errors.paymentDate.message}</span>
            ) : null}
          </label>
        </div>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Notes
          <textarea
            className={`${inputClassName} min-h-24 resize-none`}
            {...register("notes")}
          />
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
