import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ApiError } from "../../../lib/api";
import { PageHeader } from "../../../components/ui/PageHeader";
import { LoadingState } from "../../../components/ui/LoadingState";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useToast } from "../../../hooks/use-toast";
import { formatDateTime } from "../../../lib/utils";
import type { UpdateShopProfilePayload } from "../../../types/shop";
import { getShopProfile, shopQueryKeys, updateShopProfile } from "../api/shop";

const optionalTextField = z
  .string()
  .trim()
  .max(255)
  .optional()
  .or(z.literal(""));

const shopProfileSchema = z.object({
  name: z.string().trim().min(3, "Shop name is required.").max(160),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || value.replace(/\D/g, "").length >= 10,
      "Enter a valid phone number.",
    )
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal("")),
  addressLine1: optionalTextField,
  addressLine2: optionalTextField,
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  pincode: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || /^\d{6}$/.test(value), "Enter a valid 6-digit pincode.")
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
  licenseNumber: z.string().trim().max(100).optional().or(z.literal("")),
  invoicePrefix: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || (value.length >= 2 && value.length <= 20),
      "Invoice prefix should be between 2 and 20 characters.",
    )
    .refine(
      (value) => value.length === 0 || /^[A-Za-z0-9-]+$/.test(value),
      "Invoice prefix may contain only letters, numbers, and hyphens.",
    )
    .optional()
    .or(z.literal("")),
});

type ShopProfileFormValues = z.infer<typeof shopProfileSchema>;

const defaultValues: ShopProfileFormValues = {
  name: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  gstNumber: "",
  licenseNumber: "",
  invoicePrefix: "",
};

const toPayload = (values: ShopProfileFormValues): UpdateShopProfilePayload => ({
  name: values.name.trim(),
  phone: values.phone?.trim() ? values.phone.trim() : null,
  email: values.email?.trim() ? values.email.trim() : null,
  addressLine1: values.addressLine1?.trim() ? values.addressLine1.trim() : null,
  addressLine2: values.addressLine2?.trim() ? values.addressLine2.trim() : null,
  city: values.city?.trim() ? values.city.trim() : null,
  state: values.state?.trim() ? values.state.trim() : null,
  pincode: values.pincode?.trim() ? values.pincode.trim() : null,
  gstNumber: values.gstNumber?.trim() ? values.gstNumber.trim().toUpperCase() : null,
  licenseNumber: values.licenseNumber?.trim() ? values.licenseNumber.trim() : null,
  invoicePrefix: values.invoicePrefix?.trim() ? values.invoicePrefix.trim().toUpperCase() : null,
});

export const ShopSetupPage = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const shopProfileQuery = useQuery({
    queryKey: shopQueryKeys.profile,
    queryFn: getShopProfile,
  });

  const form = useForm<ShopProfileFormValues>({
    resolver: zodResolver(shopProfileSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!shopProfileQuery.data) {
      return;
    }

    form.reset({
      name: shopProfileQuery.data.name ?? "",
      phone: shopProfileQuery.data.phone ?? "",
      email: shopProfileQuery.data.email ?? "",
      addressLine1: shopProfileQuery.data.addressLine1 ?? "",
      addressLine2: shopProfileQuery.data.addressLine2 ?? "",
      city: shopProfileQuery.data.city ?? "",
      state: shopProfileQuery.data.state ?? "",
      pincode: shopProfileQuery.data.pincode ?? "",
      gstNumber: shopProfileQuery.data.gstNumber ?? "",
      licenseNumber: shopProfileQuery.data.licenseNumber ?? "",
      invoicePrefix: shopProfileQuery.data.invoicePrefix ?? "",
    });
  }, [form, shopProfileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: updateShopProfile,
    onSuccess: async (updatedProfile) => {
      queryClient.setQueryData(shopQueryKeys.profile, updatedProfile);
      pushToast({
        title: "Shop profile updated",
        description: "Your shop setup changes were saved successfully.",
        variant: "success",
      });
    },
  });

  if (shopProfileQuery.isLoading) {
    return <LoadingState title="Loading shop profile" />;
  }

  if (shopProfileQuery.error) {
    return (
      <LoadingState
        description={
          shopProfileQuery.error instanceof ApiError
            ? shopProfileQuery.error.message
            : "We could not load the shop profile right now."
        }
        title={
          shopProfileQuery.error instanceof ApiError &&
          ![401, 403].includes(shopProfileQuery.error.status)
            ? "Unable to load profile"
            : "Checking access"
        }
      />
    );
  }

  const shopProfile = shopProfileQuery.data;

  if (!shopProfile) {
    return (
      <LoadingState
        description="We could not load the shop profile right now."
        title="Profile unavailable"
      />
    );
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = form;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<StatusBadge label={shopProfile.status} tone={shopProfile.status} />}
        description="Keep your store identity, billing details, and contact information up to date in one place."
        eyebrow="Admin settings"
        title="Shop Setup"
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          description="These details are used across admin workflows, invoices, and communication screens."
          title="Shop profile"
        >
          <form
            className="grid gap-5"
            onSubmit={handleSubmit(async (values) => {
              await updateMutation.mutateAsync(toPayload(values));
            })}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Shop name
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                  placeholder="CarePoint Diagnostics"
                  {...register("name")}
                />
                {errors.name ? <span className="text-sm text-rose-600">{errors.name.message}</span> : null}
              </label>

              {[
                ["phone", "Phone"],
                ["email", "Email"],
                ["addressLine1", "Address line 1"],
                ["addressLine2", "Address line 2"],
                ["city", "City"],
                ["state", "State"],
                ["pincode", "Pincode"],
                ["gstNumber", "GST number"],
                ["licenseNumber", "License number"],
                ["invoicePrefix", "Invoice prefix"],
              ].map(([field, label]) => {
                const error = errors[field as keyof ShopProfileFormValues];

                return (
                  <label className="grid gap-2 text-sm font-medium text-slate-700" key={field}>
                    {label}
                    <input
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                      {...register(field as keyof ShopProfileFormValues)}
                    />
                    {error ? <span className="text-sm text-rose-600">{error.message}</span> : null}
                  </label>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Save only after reviewing the business information carefully.
              </p>
              <button
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={updateMutation.isPending || !isDirty}
                type="submit"
              >
                {updateMutation.isPending ? "Saving..." : "Save profile"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          description="A quick reference for verification and account state."
          title="Setup summary"
        >
          <div className="grid gap-4">
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Shop slug
              </p>
              <p className="mt-2 text-base font-semibold text-slate-950">{shopProfile.slug}</p>
            </article>
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Created
              </p>
              <p className="mt-2 text-base font-semibold text-slate-950">
                {formatDateTime(shopProfile.createdAt)}
              </p>
            </article>
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Last updated
              </p>
              <p className="mt-2 text-base font-semibold text-slate-950">
                {formatDateTime(shopProfile.updatedAt)}
              </p>
            </article>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
