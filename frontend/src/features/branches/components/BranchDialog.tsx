import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Modal } from "../../../components/ui/Modal";
import type { BranchFormPayload, BranchRecord } from "../../../types/branch";
import { getShopProfile, shopQueryKeys } from "../../shop/api/shop";

const branchSchema = z.object({
  name: z.string().trim().min(2, "Branch name is required.").max(160),
  code: z
    .string()
    .trim()
    .min(2, "Code is required.")
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers, or hyphen only."),
  address: z.string().trim().max(240).optional(),
  contactNumber: z.string().trim().max(40).optional(),
  status: z.enum(["active", "inactive"]),
  isDefault: z.boolean(),
  lowStockThreshold: z.coerce.number().int().min(0).max(100000).optional(),
  nearExpiryAlertDays: z.coerce.number().int().min(1).max(365).optional(),
  invoicePrefix: z
    .string()
    .trim()
    .max(20)
    .regex(/^[A-Za-z0-9-]*$/, "Use letters, numbers, or hyphen only."),
  lowStockAlertsEnabled: z.boolean(),
  lowStockEmailAlertsEnabled: z.boolean(),
  expiryAlertsEnabled: z.boolean(),
  expiryEmailAlertsEnabled: z.boolean(),
});

type BranchDialogValues = z.infer<typeof branchSchema>;
type BranchDialogFormInput = z.input<typeof branchSchema>;

const inputClassName =
  "rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

const toFormValues = (branch: BranchRecord | null): BranchDialogValues => ({
  name: branch?.name ?? "",
  code: branch?.code ?? "",
  address: branch?.address ?? "",
  contactNumber: branch?.contactNumber ?? "",
  status: branch?.status ?? "active",
  isDefault: branch?.isDefault ?? false,
  lowStockThreshold: branch?.settings.lowStockThreshold ?? undefined,
  nearExpiryAlertDays: branch?.settings.nearExpiryAlertDays ?? undefined,
  invoicePrefix: branch?.settings.invoicePrefix ?? "",
  lowStockAlertsEnabled: branch?.settings.lowStockAlertsEnabled ?? true,
  lowStockEmailAlertsEnabled: branch?.settings.lowStockEmailAlertsEnabled ?? false,
  expiryAlertsEnabled: branch?.settings.expiryAlertsEnabled ?? true,
  expiryEmailAlertsEnabled: branch?.settings.expiryEmailAlertsEnabled ?? false,
});

interface BranchDialogProps {
  errorMessage?: string;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (payload: BranchFormPayload) => Promise<void>;
  open: boolean;
  branch: BranchRecord | null;
}

export const BranchDialog = ({
  errorMessage,
  isLoading,
  onClose,
  onSubmit,
  open,
  branch,
}: BranchDialogProps) => {
  const shopProfileQuery = useQuery({
    queryKey: shopQueryKeys.profile,
    queryFn: getShopProfile,
    enabled: open && !!branch?.isDefault,
  });

  const form = useForm<BranchDialogFormInput, unknown, BranchDialogValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: toFormValues(branch) as BranchDialogFormInput,
  });

  useEffect(() => {
    const baseValues = toFormValues(branch) as BranchDialogFormInput;
    const shopProfile = shopProfileQuery.data;

    if (branch?.isDefault && shopProfile) {
      baseValues.name = shopProfile.name || baseValues.name;
      baseValues.contactNumber = shopProfile.phone || baseValues.contactNumber;
      
      const shopAddressParts = [
        shopProfile.addressLine1,
        shopProfile.addressLine2,
        shopProfile.city,
        shopProfile.state,
        shopProfile.pincode,
      ].filter(Boolean);
      
      const shopAddress = shopAddressParts.join(", ");
      baseValues.address = shopAddress || baseValues.address;
      baseValues.invoicePrefix = shopProfile.invoicePrefix || baseValues.invoicePrefix;
    }

    form.reset(baseValues);
  }, [branch, form, open, shopProfileQuery.data]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <Modal
      description="Create a new branch or adjust branch-level operational overrides."
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
            disabled={isLoading}
            form="branch-form"
            type="submit"
          >
            {isLoading ? "Saving..." : branch ? "Save changes" : "Create branch"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      panelClassName="max-w-4xl"
      title={branch ? "Edit branch" : "Create branch"}
    >
      <form
        className="grid gap-5"
        id="branch-form"
        onSubmit={handleSubmit(async (values) => {
          await onSubmit({
            name: values.name,
            code: values.code.toUpperCase(),
            address: values.address?.trim() || undefined,
            contactNumber: values.contactNumber?.trim() || undefined,
            status: values.status,
            isDefault: values.isDefault,
            settings: {
              ...(values.lowStockThreshold !== undefined
                ? { lowStockThreshold: values.lowStockThreshold }
                : {}),
              ...(values.nearExpiryAlertDays !== undefined
                ? { nearExpiryAlertDays: values.nearExpiryAlertDays }
                : {}),
              ...(values.invoicePrefix.trim()
                ? { invoicePrefix: values.invoicePrefix.trim().toUpperCase() }
                : {}),
              lowStockAlertsEnabled: values.lowStockAlertsEnabled,
              lowStockEmailAlertsEnabled: values.lowStockEmailAlertsEnabled,
              expiryAlertsEnabled: values.expiryAlertsEnabled,
              expiryEmailAlertsEnabled: values.expiryEmailAlertsEnabled,
            },
          });
        })}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Branch name
            <input className={inputClassName} {...register("name")} />
            {errors.name ? <span className="text-sm text-rose-600">{errors.name.message}</span> : null}
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Branch code
            <input className={inputClassName} {...register("code")} />
            {errors.code ? <span className="text-sm text-rose-600">{errors.code.message}</span> : null}
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Contact number
            <input className={inputClassName} {...register("contactNumber")} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Status
            <select className={inputClassName} {...register("status")}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
            Address
            <textarea className={`${inputClassName} min-h-24`} {...register("address")} />
          </label>
        </div>

        <div className="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Low stock threshold
            <input className={inputClassName} min={0} type="number" {...register("lowStockThreshold")} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Near expiry days
            <input className={inputClassName} min={1} type="number" {...register("nearExpiryAlertDays")} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Invoice prefix
            <input className={inputClassName} {...register("invoicePrefix")} />
            {errors.invoicePrefix ? (
              <span className="text-sm text-rose-600">{errors.invoicePrefix.message}</span>
            ) : null}
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["isDefault", "Set as default branch"],
            ["lowStockAlertsEnabled", "Enable low stock alerts"],
            ["lowStockEmailAlertsEnabled", "Enable low stock email alerts"],
            ["expiryAlertsEnabled", "Enable expiry alerts"],
            ["expiryEmailAlertsEnabled", "Enable expiry email alerts"],
          ].map(([field, label]) => (
            <label
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
              key={field}
            >
              <input type="checkbox" {...register(field as keyof BranchDialogValues)} />
              <span>{label}</span>
            </label>
          ))}
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
