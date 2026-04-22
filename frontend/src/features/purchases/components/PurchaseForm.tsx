import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { FormSection } from "../../../components/ui/FormSection";
import { EmptyState } from "../../../components/ui/EmptyState";
import { GST_PERCENTAGES, type Medicine } from "../../../types/medicine";
import type { PurchaseDetail, SavePurchasePayload } from "../../../types/purchase";
import type { Supplier } from "../../../types/supplier";
import { cn, formatCurrency, toDateInputValue } from "../../../lib/utils";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

const purchaseItemSchema = z.object({
  medicineId: z.string().trim().min(1, "Select a medicine."),
  batchNumber: z.string().trim().min(1, "Batch number is required.").max(80),
  expiryDate: z.string().trim().min(1, "Expiry date is required."),
  quantity: z.number().int("Quantity must be a whole number.").min(1, "Quantity must be at least 1.").max(1000000, "Quantity is too high."),
  freeQuantity: z.number().int("Free quantity must be a whole number.").min(0, "Free quantity cannot be negative.").max(1000000, "Free quantity is too high."),
  purchaseRate: z.number().min(0, "Purchase rate cannot be negative.").max(999999999.99, "Purchase rate is too high."),
  saleRate: z.number().min(0, "Sale rate cannot be negative.").max(999999999.99, "Sale rate is too high."),
  mrp: z.number().min(0, "MRP cannot be negative.").max(999999999.99, "MRP is too high."),
  gstPercent: z.number().refine(
    (value) => GST_PERCENTAGES.includes(value as (typeof GST_PERCENTAGES)[number]),
    "Select a valid GST percentage.",
  ),
  discountPercent: z.number().min(0, "Discount cannot be negative.").max(100, "Discount cannot exceed 100%."),
});

const purchaseFormSchema = z
  .object({
    supplierId: z.string().trim().min(1, "Select a supplier."),
    supplierInvoiceNumber: z.string().trim().max(80).optional().or(z.literal("")),
    supplierInvoiceDate: z.string().trim().optional().or(z.literal("")),
    purchaseDate: z.string().trim().min(1, "Purchase date is required."),
    paidAmount: z.number().min(0, "Paid amount cannot be negative.").max(999999999.99, "Paid amount is too high."),
    roundOffAmount: z.number().min(-9999.99, "Round off amount is too low.").max(9999.99, "Round off amount is too high."),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
    items: z.array(purchaseItemSchema).min(1, "Add at least one purchase item."),
  })
  .superRefine((values, ctx) => {
    const seen = new Set<string>();

    values.items.forEach((item, index) => {
      const duplicateKey = [
        item.medicineId.trim(),
        item.batchNumber.trim().toLowerCase(),
        item.expiryDate,
      ].join("|");

      if (seen.has(duplicateKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "batchNumber"],
          message:
            "This medicine batch already exists in the purchase. Merge the quantities into one row.",
        });
      }

      seen.add(duplicateKey);

      if (values.purchaseDate && item.expiryDate && item.expiryDate < values.purchaseDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "expiryDate"],
          message: "Expiry date cannot be earlier than the purchase date.",
        });
      }
    });

    if (
      values.supplierInvoiceDate &&
      values.purchaseDate &&
      values.supplierInvoiceDate > values.purchaseDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["supplierInvoiceDate"],
        message: "Supplier invoice date cannot be later than the purchase date.",
      });
    }
  });

type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;

export type PurchaseSubmissionIntent = "draft" | "finalize";

interface PurchaseFormProps {
  mode: "create" | "edit";
  purchase?: PurchaseDetail | null;
  suppliers: Supplier[];
  medicines: Medicine[];
  isSubmitting: boolean;
  errorMessage?: string;
  onSubmit: (
    payload: SavePurchasePayload,
    intent: PurchaseSubmissionIntent,
  ) => Promise<void>;
}

const createEmptyItem = (): PurchaseFormValues["items"][number] => ({
  medicineId: "",
  batchNumber: "",
  expiryDate: "",
  quantity: 1,
  freeQuantity: 0,
  purchaseRate: 0,
  saleRate: 0,
  mrp: 0,
  gstPercent: 0,
  discountPercent: 0,
});

const buildDefaultValues = (
  purchase: PurchaseDetail | null | undefined,
  suppliers: Supplier[],
  medicines: Medicine[],
): PurchaseFormValues => {
  if (purchase) {
    return {
      supplierId: purchase.supplierId,
      supplierInvoiceNumber: purchase.supplierInvoiceNumber ?? "",
      supplierInvoiceDate: toDateInputValue(purchase.supplierInvoiceDate),
      purchaseDate: toDateInputValue(purchase.purchaseDate),
      paidAmount: Number(purchase.paidAmount),
      roundOffAmount: Number(purchase.roundOffAmount),
      notes: purchase.notes ?? "",
      items: purchase.items.map((item) => ({
        medicineId: item.medicine.id,
        batchNumber: item.batchNumber,
        expiryDate: toDateInputValue(item.expiryDate),
        quantity: item.quantity,
        freeQuantity: item.freeQuantity,
        purchaseRate: Number(item.purchaseRate),
        saleRate: Number(item.saleRate),
        mrp: Number(item.mrp),
        gstPercent: item.gstPercent as (typeof GST_PERCENTAGES)[number],
        discountPercent: Number(item.discountPercent),
      })),
    };
  }

  return {
    supplierId: suppliers[0]?.id ?? "",
    supplierInvoiceNumber: "",
    supplierInvoiceDate: "",
    purchaseDate: toDateInputValue(new Date()),
    paidAmount: 0,
    roundOffAmount: 0,
    notes: "",
    items: [
      {
        ...createEmptyItem(),
        medicineId: medicines[0]?.id ?? "",
      },
    ],
  };
};

const calculateLine = (item?: Partial<PurchaseFormValues["items"][number]>) => {
  const quantity = Number(item?.quantity ?? 0);
  const purchaseRate = Number(item?.purchaseRate ?? 0);
  const discountPercent = Number(item?.discountPercent ?? 0);
  const gstPercent = Number(item?.gstPercent ?? 0);

  const gross = quantity * purchaseRate;
  const discount = gross * (discountPercent / 100);
  const subtotal = gross - discount;
  const tax = subtotal * (gstPercent / 100);
  const total = subtotal + tax;

  return {
    gross,
    discount,
    subtotal,
    tax,
    total,
  };
};

const calculateTotals = (
  items: PurchaseFormValues["items"],
  paidAmount: number,
  roundOffAmount: number,
) => {
  const totals = items.reduce(
    (accumulator, item) => {
      const line = calculateLine(item);

      accumulator.subtotal += line.subtotal;
      accumulator.discount += line.discount;
      accumulator.tax += line.tax;
      accumulator.totalQuantity += Number(item.quantity ?? 0);
      accumulator.totalFreeQuantity += Number(item.freeQuantity ?? 0);
      return accumulator;
    },
    {
      subtotal: 0,
      discount: 0,
      tax: 0,
      totalQuantity: 0,
      totalFreeQuantity: 0,
    },
  );

  const grandTotal = totals.subtotal + totals.tax + Number(roundOffAmount || 0);
  const dueAmount = grandTotal - Number(paidAmount || 0);

  return {
    ...totals,
    grandTotal,
    paidAmount: Number(paidAmount || 0),
    dueAmount,
  };
};

const toPayload = (values: PurchaseFormValues): SavePurchasePayload => ({
  supplierId: values.supplierId,
  supplierInvoiceNumber: values.supplierInvoiceNumber?.trim()
    ? values.supplierInvoiceNumber.trim()
    : null,
  supplierInvoiceDate: values.supplierInvoiceDate || null,
  purchaseDate: values.purchaseDate,
  paidAmount: values.paidAmount,
  roundOffAmount: values.roundOffAmount,
  notes: values.notes?.trim() ? values.notes.trim() : null,
  items: values.items.map((item) => ({
    medicineId: item.medicineId,
    batchNumber: item.batchNumber.trim(),
    expiryDate: item.expiryDate,
    quantity: item.quantity,
    freeQuantity: item.freeQuantity,
    purchaseRate: item.purchaseRate,
    saleRate: item.saleRate,
    mrp: item.mrp,
    gstPercent: item.gstPercent as (typeof GST_PERCENTAGES)[number],
    discountPercent: item.discountPercent,
  })),
});

export const PurchaseForm = ({
  mode,
  purchase,
  suppliers,
  medicines,
  isSubmitting,
  errorMessage,
  onSubmit,
}: PurchaseFormProps) => {
  const [submissionIntent, setSubmissionIntent] =
    useState<PurchaseSubmissionIntent>("draft");

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: buildDefaultValues(purchase, suppliers, medicines),
  });

  const { control, register, handleSubmit, reset, formState } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchedItems = useWatch({
    control,
    name: "items",
  });
  const paidAmount = useWatch({
    control,
    name: "paidAmount",
  });
  const roundOffAmount = useWatch({
    control,
    name: "roundOffAmount",
  });

  useEffect(() => {
    reset(buildDefaultValues(purchase, suppliers, medicines));
  }, [medicines, purchase, reset, suppliers]);

  const totals = calculateTotals(
    watchedItems ?? [],
    Number(paidAmount ?? 0),
    Number(roundOffAmount ?? 0),
  );

  const canSubmit = suppliers.length > 0 && medicines.length > 0;

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(toPayload(values), submissionIntent);
      })}
    >

      {!canSubmit ? (
        <EmptyState
          description="You need at least one supplier and one medicine in the master data before creating a purchase."
          title="Purchase setup is incomplete"
        />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)]">
        <div className="space-y-5">
          <FormSection
            description="Capture the header information once, then keep line entry fast and easy to scan."
            title="Purchase header"
          >
            <div className="grid gap-3.5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Supplier
                <select className={inputClassName} {...register("supplierId")}>
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.supplierName}
                      {supplier.companyName ? ` - ${supplier.companyName}` : ""}
                      {supplier.status === "inactive" ? " (inactive)" : ""}
                    </option>
                  ))}
                </select>
                {formState.errors.supplierId ? (
                  <span className="text-sm text-rose-600">
                    {formState.errors.supplierId.message}
                  </span>
                ) : null}
                <span className="text-xs text-slate-500">
                  Choose the supplier whose invoice you are recording for this purchase.
                </span>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Supplier invoice number
                <input
                  className={inputClassName}
                  placeholder="Optional invoice reference"
                  {...register("supplierInvoiceNumber")}
                />
                {formState.errors.supplierInvoiceNumber ? (
                  <span className="text-sm text-rose-600">
                    {formState.errors.supplierInvoiceNumber.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Supplier invoice date
                <input
                  className={inputClassName}
                  type="date"
                  {...register("supplierInvoiceDate")}
                />
                {formState.errors.supplierInvoiceDate ? (
                  <span className="text-sm text-rose-600">
                    {formState.errors.supplierInvoiceDate.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Purchase date
                <input
                  className={inputClassName}
                  type="date"
                  {...register("purchaseDate")}
                />
                {formState.errors.purchaseDate ? (
                  <span className="text-sm text-rose-600">
                    {formState.errors.purchaseDate.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Paid amount
                <input
                  className={inputClassName}
                  step="0.01"
                  type="number"
                  {...register("paidAmount", { valueAsNumber: true })}
                />
                {formState.errors.paidAmount ? (
                  <span className="text-sm text-rose-600">
                    {formState.errors.paidAmount.message}
                  </span>
                ) : null}
                <span className="text-xs text-slate-500">
                  Enter only the amount already paid against this purchase.
                </span>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Round off amount
                <input
                  className={inputClassName}
                  step="0.01"
                  type="number"
                  {...register("roundOffAmount", { valueAsNumber: true })}
                />
                {formState.errors.roundOffAmount ? (
                  <span className="text-sm text-rose-600">
                    {formState.errors.roundOffAmount.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Notes
                <textarea
                  className={`${inputClassName} min-h-28 resize-none`}
                  placeholder="Optional operational notes"
                  {...register("notes")}
                />
                {formState.errors.notes ? (
                  <span className="text-sm text-rose-600">
                    {formState.errors.notes.message}
                  </span>
                ) : null}
              </label>
            </div>
          </FormSection>

          <FormSection
            title="Purchase items"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  onClick={() => append(createEmptyItem())}
                  type="button"
                >
                  Add item row
                </button>
              </div>

              <div className="grid gap-3 xl:hidden">
                {fields.map((field, index) => {
                  const item = watchedItems?.[index];
                  const medicine = medicines.find(
                    (medicineOption) => medicineOption.id === item?.medicineId,
                  );
                  const line = calculateLine(item);

                  return (
                    <article
                      className="rounded-[22px] border border-slate-200 bg-white p-4"
                      key={field.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Item {index + 1}
                          </p>
                          <p className="text-xs text-slate-500">
                            {medicine?.genericName || "Select medicine and batch details"}
                          </p>
                        </div>
                        <button
                          className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                          disabled={fields.length === 1}
                          onClick={() => remove(index)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                          Medicine
                          <select className={inputClassName} {...register(`items.${index}.medicineId`)}>
                            <option value="">Select medicine</option>
                            {medicines.map((medicineOption) => (
                              <option key={medicineOption.id} value={medicineOption.id}>
                                {medicineOption.medicineName}
                                {medicineOption.strength ? ` ${medicineOption.strength}` : ""}
                                {medicineOption.status === "inactive" ? " (inactive)" : ""}
                              </option>
                            ))}
                          </select>
                          {formState.errors.items?.[index]?.medicineId ? (
                            <span className="text-sm text-rose-600">
                              {formState.errors.items[index]?.medicineId?.message}
                            </span>
                          ) : null}
                        </label>

                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Batch number
                          <input className={inputClassName} {...register(`items.${index}.batchNumber`)} />
                          {formState.errors.items?.[index]?.batchNumber ? (
                            <span className="text-sm text-rose-600">
                              {formState.errors.items[index]?.batchNumber?.message}
                            </span>
                          ) : null}
                        </label>

                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Expiry date
                          <input
                            className={inputClassName}
                            type="date"
                            {...register(`items.${index}.expiryDate`)}
                          />
                          {formState.errors.items?.[index]?.expiryDate ? (
                            <span className="text-sm text-rose-600">
                              {formState.errors.items[index]?.expiryDate?.message}
                            </span>
                          ) : null}
                        </label>

                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Quantity
                          <input
                            className={inputClassName}
                            type="number"
                            {...register(`items.${index}.quantity`, {
                              valueAsNumber: true,
                            })}
                          />
                        </label>

                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Free quantity
                          <input
                            className={inputClassName}
                            type="number"
                            {...register(`items.${index}.freeQuantity`, {
                              valueAsNumber: true,
                            })}
                          />
                        </label>

                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Purchase rate
                          <input
                            className={inputClassName}
                            step="0.01"
                            type="number"
                            {...register(`items.${index}.purchaseRate`, {
                              valueAsNumber: true,
                            })}
                          />
                        </label>

                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Sale rate
                          <input
                            className={inputClassName}
                            step="0.01"
                            type="number"
                            {...register(`items.${index}.saleRate`, {
                              valueAsNumber: true,
                            })}
                          />
                        </label>

                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          MRP
                          <input
                            className={inputClassName}
                            step="0.01"
                            type="number"
                            {...register(`items.${index}.mrp`, {
                              valueAsNumber: true,
                            })}
                          />
                        </label>

                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          GST %
                          <select
                            className={inputClassName}
                            {...register(`items.${index}.gstPercent`, {
                              valueAsNumber: true,
                            })}
                          >
                            {GST_PERCENTAGES.map((option) => (
                              <option key={option} value={option}>
                                {option}%
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                          Discount %
                          <input
                            className={inputClassName}
                            step="0.01"
                            type="number"
                            {...register(`items.${index}.discountPercent`, {
                              valueAsNumber: true,
                            })}
                          />
                        </label>
                      </div>

                      <div className="mt-4 grid gap-2 rounded-[20px] border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Line subtotal
                          </p>
                          <p className="mt-1 font-semibold text-slate-950">
                            {formatCurrency(line.subtotal)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Line total
                          </p>
                          <p className="mt-1 font-semibold text-slate-950">
                            {formatCurrency(line.total)}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto xl:block">
                <table className="min-w-[1380px] w-full border-separate border-spacing-y-2.5">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <th className="px-3">Medicine</th>
                      <th className="px-3">Batch</th>
                      <th className="px-3">Expiry</th>
                      <th className="px-3">Qty</th>
                      <th className="px-3">Free</th>
                      <th className="px-3">Purchase</th>
                      <th className="px-3">Sale</th>
                      <th className="px-3">MRP</th>
                      <th className="px-3">GST</th>
                      <th className="px-3">Disc %</th>
                      <th className="px-3">Line total</th>
                      <th className="px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const item = watchedItems?.[index];
                      const line = calculateLine(item);

                      return (
                        <tr className="rounded-[22px] bg-slate-50 align-top" key={field.id}>
                          <td className="rounded-l-[22px] px-3 py-3">
                            <select
                              className={cn(inputClassName, "min-w-[220px]")}
                              {...register(`items.${index}.medicineId`)}
                            >
                              <option value="">Select medicine</option>
                              {medicines.map((medicineOption) => (
                                <option key={medicineOption.id} value={medicineOption.id}>
                                  {medicineOption.medicineName}
                                  {medicineOption.strength ? ` ${medicineOption.strength}` : ""}
                                  {medicineOption.status === "inactive" ? " (inactive)" : ""}
                                </option>
                              ))}
                            </select>
                            {formState.errors.items?.[index]?.medicineId ? (
                              <p className="mt-1 text-xs text-rose-600">
                                {formState.errors.items[index]?.medicineId?.message}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <input className={cn(inputClassName, "w-[120px]")} {...register(`items.${index}.batchNumber`)} />
                            {formState.errors.items?.[index]?.batchNumber ? (
                              <p className="mt-1 text-xs text-rose-600">
                                {formState.errors.items[index]?.batchNumber?.message}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <input
                              className={cn(inputClassName, "w-[148px]")}
                              type="date"
                              {...register(`items.${index}.expiryDate`)}
                            />
                            {formState.errors.items?.[index]?.expiryDate ? (
                              <p className="mt-1 text-xs text-rose-600">
                                {formState.errors.items[index]?.expiryDate?.message}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <input
                              className={cn(inputClassName, "w-[86px]")}
                              type="number"
                              {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              className={cn(inputClassName, "w-[86px]")}
                              type="number"
                              {...register(`items.${index}.freeQuantity`, {
                                valueAsNumber: true,
                              })}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              className={cn(inputClassName, "w-[110px]")}
                              step="0.01"
                              type="number"
                              {...register(`items.${index}.purchaseRate`, {
                                valueAsNumber: true,
                              })}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              className={cn(inputClassName, "w-[110px]")}
                              step="0.01"
                              type="number"
                              {...register(`items.${index}.saleRate`, {
                                valueAsNumber: true,
                              })}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              className={cn(inputClassName, "w-[110px]")}
                              step="0.01"
                              type="number"
                              {...register(`items.${index}.mrp`, {
                                valueAsNumber: true,
                              })}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <select
                              className={cn(inputClassName, "w-[90px]")}
                              {...register(`items.${index}.gstPercent`, {
                                valueAsNumber: true,
                              })}
                            >
                              {GST_PERCENTAGES.map((option) => (
                                <option key={option} value={option}>
                                  {option}%
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <input
                              className={cn(inputClassName, "w-[90px]")}
                              step="0.01"
                              type="number"
                              {...register(`items.${index}.discountPercent`, {
                                valueAsNumber: true,
                              })}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <div className="min-w-[115px] rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                              <p className="font-semibold text-slate-950">
                                {formatCurrency(line.total)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Taxable {formatCurrency(line.subtotal)}
                              </p>
                            </div>
                          </td>
                          <td className="rounded-r-[22px] px-3 py-3 text-right">
                            <button
                              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                              disabled={fields.length === 1}
                              onClick={() => remove(index)}
                              type="button"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {formState.errors.items?.message ? (
                <p className="text-sm text-rose-600">{formState.errors.items.message}</p>
              ) : null}
            </div>
          </FormSection>
        </div>

        <div className="space-y-5">
          <FormSection
            description="Review quantity, tax, and payable values before saving the draft or posting stock."
            title="Billing summary"
          >
            <div className="space-y-3">
              {[
                ["Taxable amount", formatCurrency(totals.subtotal)],
                ["Discount amount", formatCurrency(totals.discount)],
                ["Tax amount", formatCurrency(totals.tax)],
                ["Round off", formatCurrency(roundOffAmount)],
                ["Grand total", formatCurrency(totals.grandTotal)],
                ["Paid amount", formatCurrency(totals.paidAmount)],
                ["Due amount", formatCurrency(totals.dueAmount)],
              ].map(([label, value], index) => (
                <div
                  className={cn(
                    "flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm",
                    index === 4
                      ? "bg-slate-950 text-white"
                      : index === 6
                        ? "bg-amber-50 text-amber-900"
                        : "border border-slate-200 bg-white text-slate-700",
                  )}
                  key={label}
                >
                  <span>{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </FormSection>


          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60">

            {errorMessage ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-3">
              <button
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting || !canSubmit}
                onClick={() => setSubmissionIntent("draft")}
                type="submit"
              >
                {isSubmitting
                  ? "Saving..."
                  : mode === "create"
                    ? "Save as draft"
                    : "Update draft"}
              </button>
              <button
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold !text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting || !canSubmit}
                onClick={() => setSubmissionIntent("finalize")}
                type="submit"
              >
                {isSubmitting
                  ? "Processing..."
                  : mode === "create"
                    ? "Save and finalize purchase"
                    : "Update and finalize purchase"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
