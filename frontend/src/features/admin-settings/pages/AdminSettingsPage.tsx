import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { useToast } from "../../../hooks/use-toast";
import { formatDateTime, humanizeLabel } from "../../../lib/utils";
import { ApiError } from "../../../lib/api";
import { authQueryKeys } from "../../auth/hooks/use-session";
import {
  adminSettingsQueryKeys,
  getAdminAuditLogs,
  getAdminShopSettings,
  getPermissionCatalog,
  getRolePermissions,
  getUserPermissionDetail,
  updateAdminShopSettings,
  updateRolePermissions,
  updateUserPermissionOverrides,
} from "../api/adminSettings";
import { getUsers, staffQueryKeys } from "../../staff/api/staff";
import type {
  AdminAuditLogItem,
  AdminPermissionKey,
  AdminRole,
  AdminShopSettings,
  PermissionCatalogItem,
  UpdateAdminShopSettingsPayload,
} from "../../../types/admin-settings";

type SettingsTab = "permissions" | "operations" | "audit";
type OverrideMode = "allow" | "deny";

const roleOrder: AdminRole[] = ["admin", "staff", "accountant"];
const groupOrder: PermissionCatalogItem["group"][] = [
  "medicines",
  "suppliers",
  "purchases",
  "purchaseReturns",
  "inventory",
  "billing",
  "reports",
  "customers",
  "payments",
  "shop",
  "users",
  "settings",
];

const emptyRoleDraft = () =>
  ({
    admin: [] as AdminPermissionKey[],
    staff: [] as AdminPermissionKey[],
    accountant: [] as AdminPermissionKey[],
  }) satisfies Record<AdminRole, AdminPermissionKey[]>;

const sameItems = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const toSettingsDraft = (
  settings: AdminShopSettings,
): UpdateAdminShopSettingsPayload => ({
  defaultLowStockThreshold: settings.defaultLowStockThreshold,
  lowStockAlertsEnabled: settings.lowStockAlertsEnabled,
  lowStockEmailAlertsEnabled: settings.lowStockEmailAlertsEnabled,
  nearExpiryAlertDays: settings.nearExpiryAlertDays,
  expiryAlertsEnabled: settings.expiryAlertsEnabled,
  expiryEmailAlertsEnabled: settings.expiryEmailAlertsEnabled,
  invoicePrefix: settings.invoicePrefix,
  allowPartialPayments: settings.allowPartialPayments,
  allowHeldBills: settings.allowHeldBills,
  allowStaffSalesReturn: settings.allowStaffSalesReturn,
  allowInventoryAdjustment: settings.allowInventoryAdjustment,
  allowDraftPurchases: settings.allowDraftPurchases,
  preferFefo: settings.preferFefo,
});

const summarizeAuditLog = (log: AdminAuditLogItem) => {
  if (log.targetType === "role_permission") {
    const previousCount = Array.isArray(log.oldValue?.permissions)
      ? log.oldValue.permissions.length
      : 0;
    const nextCount = Array.isArray(log.newValue?.permissions)
      ? log.newValue.permissions.length
      : 0;

    return `${previousCount} to ${nextCount} permissions`;
  }

  if (log.targetType === "user_permission_override") {
    const allowCount = Array.isArray(log.newValue?.allow) ? log.newValue.allow.length : 0;
    const denyCount = Array.isArray(log.newValue?.deny) ? log.newValue.deny.length : 0;

    return `${allowCount} allow and ${denyCount} deny overrides`;
  }

  return `${Object.keys(log.newValue ?? {}).length} settings updated`;
};

export const AdminSettingsPage = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>("permissions");
  const [roleDraft, setRoleDraft] = useState<Record<AdminRole, AdminPermissionKey[]>>(
    emptyRoleDraft,
  );
  const [selectedUserId, setSelectedUserId] = useState("");
  const [overrideDraft, setOverrideDraft] = useState<{
    allow: AdminPermissionKey[];
    deny: AdminPermissionKey[];
  }>({ allow: [], deny: [] });
  const [settingsDraft, setSettingsDraft] =
    useState<UpdateAdminShopSettingsPayload | null>(null);
  const [showRoleConfirm, setShowRoleConfirm] = useState(false);

  const catalogQuery = useQuery({
    queryKey: adminSettingsQueryKeys.catalog,
    queryFn: getPermissionCatalog,
  });
  const rolePermissionsQuery = useQuery({
    queryKey: adminSettingsQueryKeys.roles,
    queryFn: getRolePermissions,
  });
  const settingsQuery = useQuery({
    queryKey: adminSettingsQueryKeys.shopSettings,
    queryFn: getAdminShopSettings,
  });
  const usersQuery = useQuery({
    queryKey: staffQueryKeys.users,
    queryFn: getUsers,
  });
  const userDetailQuery = useQuery({
    queryKey: adminSettingsQueryKeys.userDetail(selectedUserId),
    queryFn: () => getUserPermissionDetail(selectedUserId),
    enabled: Boolean(selectedUserId),
  });
  const auditLogsQuery = useQuery({
    queryKey: adminSettingsQueryKeys.auditLogs,
    queryFn: getAdminAuditLogs,
  });

  useEffect(() => {
    if (!rolePermissionsQuery.data) {
      return;
    }

    setRoleDraft({
      admin:
        rolePermissionsQuery.data.find((entry) => entry.role === "admin")?.permissions ?? [],
      staff:
        rolePermissionsQuery.data.find((entry) => entry.role === "staff")?.permissions ?? [],
      accountant:
        rolePermissionsQuery.data.find((entry) => entry.role === "accountant")?.permissions ?? [],
    });
  }, [rolePermissionsQuery.data]);

  const eligibleUsers = useMemo(
    () => (usersQuery.data ?? []).filter((user) => user.role !== "admin"),
    [usersQuery.data],
  );

  useEffect(() => {
    if (selectedUserId || !eligibleUsers.length) {
      return;
    }

    setSelectedUserId(eligibleUsers[0].id);
  }, [eligibleUsers, selectedUserId]);

  useEffect(() => {
    if (!userDetailQuery.data) {
      return;
    }

    setOverrideDraft({
      allow: userDetailQuery.data.overrides.allow,
      deny: userDetailQuery.data.overrides.deny,
    });
  }, [userDetailQuery.data]);

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }

    setSettingsDraft(toSettingsDraft(settingsQuery.data));
  }, [settingsQuery.data]);

  const saveRolePermissionsMutation = useMutation({
    mutationFn: async () => {
      const updates = roleOrder.filter((role) => {
        const current =
          rolePermissionsQuery.data?.find((entry) => entry.role === role)?.permissions ?? [];
        return !sameItems(current, roleDraft[role]);
      });

      await Promise.all(
        updates.map((role) =>
          updateRolePermissions(role, {
            permissions: roleDraft[role],
          }),
        ),
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.roles }),
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.auditLogs }),
        queryClient.invalidateQueries({ queryKey: authQueryKeys.session }),
      ]);
      pushToast({
        title: "Permissions saved",
        description: "Role permissions were updated successfully.",
        variant: "success",
      });
      setShowRoleConfirm(false);
    },
  });

  const saveOverrideMutation = useMutation({
    mutationFn: () =>
      updateUserPermissionOverrides(selectedUserId, {
        allow: overrideDraft.allow,
        deny: overrideDraft.deny,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminSettingsQueryKeys.userDetail(selectedUserId),
        }),
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.auditLogs }),
        queryClient.invalidateQueries({ queryKey: authQueryKeys.session }),
      ]);
      pushToast({
        title: "Overrides saved",
        description: "User-specific overrides were updated successfully.",
        variant: "success",
      });
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: (payload: UpdateAdminShopSettingsPayload) =>
      updateAdminShopSettings(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.shopSettings }),
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.auditLogs }),
      ]);
      pushToast({
        title: "Settings saved",
        description: "Operational settings were updated successfully.",
        variant: "success",
      });
    },
  });

  const groupedCatalog = useMemo(() => {
    const permissions = catalogQuery.data?.permissions ?? [];

    return groupOrder
      .map((group) => ({
        group,
        items: permissions.filter((permission) => permission.group === group),
      }))
      .filter((entry) => entry.items.length > 0);
  }, [catalogQuery.data]);

  const roleDraftDirty = roleOrder.some((role) => {
    const current =
      rolePermissionsQuery.data?.find((entry) => entry.role === role)?.permissions ?? [];
    return !sameItems(current, roleDraft[role]);
  });

  const adminRoleChanged = !sameItems(
    rolePermissionsQuery.data?.find((entry) => entry.role === "admin")?.permissions ?? [],
    roleDraft.admin,
  );

  const overrideDirty = Boolean(
    userDetailQuery.data &&
      (!sameItems(userDetailQuery.data.overrides.allow, overrideDraft.allow) ||
        !sameItems(userDetailQuery.data.overrides.deny, overrideDraft.deny)),
  );

  const settingsDirty = Boolean(
    settingsDraft &&
      settingsQuery.data &&
      JSON.stringify(settingsDraft) !== JSON.stringify(toSettingsDraft(settingsQuery.data)),
  );

  const baseError =
    catalogQuery.error ??
    rolePermissionsQuery.error ??
    settingsQuery.error ??
    usersQuery.error ??
    auditLogsQuery.error;

  if (
    catalogQuery.isLoading ||
    rolePermissionsQuery.isLoading ||
    settingsQuery.isLoading ||
    usersQuery.isLoading ||
    auditLogsQuery.isLoading
  ) {
    return <LoadingState title="Loading admin settings" />;
  }

  if (baseError) {
    return (
      <LoadingState
        title="Unable to load admin settings"
        description={
          baseError instanceof ApiError
            ? baseError.message
            : "We could not load the admin settings workspace right now."
        }
      />
    );
  }

  const toggleRolePermission = (role: AdminRole, permission: AdminPermissionKey) => {
    setRoleDraft((current) => {
      const exists = current[role].includes(permission);

      return {
        ...current,
        [role]: exists
          ? current[role].filter((item) => item !== permission)
          : [...current[role], permission].sort(),
      };
    });
  };

  const toggleOverridePermission = (
    permission: AdminPermissionKey,
    mode: OverrideMode,
  ) => {
    setOverrideDraft((current) => {
      const target = current[mode];
      const opposite = mode === "allow" ? current.deny : current.allow;
      const exists = target.includes(permission);

      return {
        allow:
          mode === "allow"
            ? exists
              ? current.allow.filter((item) => item !== permission)
              : [...current.allow, permission].sort()
            : current.allow.filter((item) => item !== permission),
        deny:
          mode === "deny"
            ? exists
              ? current.deny.filter((item) => item !== permission)
              : [...current.deny, permission].sort()
            : current.deny.filter((item) => item !== permission),
        ...(opposite.includes(permission) ? {} : {}),
      };
    });
  };

  const setBooleanSetting = (
    field: keyof UpdateAdminShopSettingsPayload,
    value: boolean,
  ) => {
    setSettingsDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const setNumericSetting = (
    field:
      | "defaultLowStockThreshold"
      | "nearExpiryAlertDays",
    value: number,
  ) => {
    setSettingsDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const setTextSetting = (field: "invoicePrefix", value: string) => {
    setSettingsDraft((current) =>
      current ? { ...current, [field]: value.toUpperCase() } : current,
    );
  };

  const operationsContent = settingsDraft && settingsQuery.data && (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <SectionCard
        title="Alerts and inventory"
        description="Tune alert thresholds and operational stock behavior without changing master data."
        action={
          <div className="flex gap-2">
            <button
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => setSettingsDraft(toSettingsDraft(settingsQuery.data))}
              type="button"
            >
              Reset
            </button>
            <button
              className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!settingsDirty || saveSettingsMutation.isPending}
              onClick={() => saveSettingsMutation.mutate(settingsDraft)}
              type="button"
            >
              {saveSettingsMutation.isPending ? "Saving..." : "Save settings"}
            </button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              key: "defaultLowStockThreshold" as const,
              label: "Default low stock threshold",
              hint: "Used when a medicine-level reorder value is not set.",
            },
            {
              key: "nearExpiryAlertDays" as const,
              label: "Near-expiry alert days",
              hint: "Controls near-expiry highlighting in billing and alerts.",
            },
          ].map((field) => (
            <label className="grid gap-2 text-sm font-medium text-slate-700" key={field.key}>
              {field.label}
              <input
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                min={0}
                onChange={(event) =>
                  setNumericSetting(field.key, Number(event.target.value || 0))
                }
                type="number"
                value={settingsDraft[field.key]}
              />
              <span className="text-xs text-slate-500">{field.hint}</span>
            </label>
          ))}
        </div>

        <div className="mt-5 grid gap-3">
          {[
            [
              "lowStockAlertsEnabled",
              "Low stock alerts",
              "Turn low stock alert generation on or off for this shop.",
            ],
            [
              "lowStockEmailAlertsEnabled",
              "Low stock email delivery",
              "Send low stock alerts by email to active admins.",
            ],
            [
              "expiryAlertsEnabled",
              "Near-expiry alerts",
              "Keep expiry alert logic enabled for upcoming stock expiry.",
            ],
            [
              "expiryEmailAlertsEnabled",
              "Expiry email delivery",
              "Keep email delivery ready for near-expiry notifications.",
            ],
            [
              "allowInventoryAdjustment",
              "Allow inventory adjustments",
              "Permit manual stock adjustments from inventory screens.",
            ],
            [
              "preferFefo",
              "Prefer FEFO billing suggestions",
              "Keep expiry-first batch suggestions enabled in POS.",
            ],
          ].map(([field, label, description]) => (
            <div
              className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              key={field}
            >
              <div>
                <p className="text-sm font-semibold text-slate-950">{label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
              </div>
              <button
                aria-pressed={settingsDraft[field as keyof UpdateAdminShopSettingsPayload] as boolean}
                className={
                  settingsDraft[field as keyof UpdateAdminShopSettingsPayload]
                    ? "inline-flex h-7 w-12 items-center rounded-full bg-teal-600 px-1"
                    : "inline-flex h-7 w-12 items-center rounded-full bg-slate-300 px-1"
                }
                onClick={() =>
                  setBooleanSetting(
                    field as keyof UpdateAdminShopSettingsPayload,
                    !(settingsDraft[field as keyof UpdateAdminShopSettingsPayload] as boolean),
                  )
                }
                type="button"
              >
                <span
                  className={
                    settingsDraft[field as keyof UpdateAdminShopSettingsPayload]
                      ? "h-5 w-5 translate-x-5 rounded-full bg-white transition"
                      : "h-5 w-5 translate-x-0 rounded-full bg-white transition"
                  }
                />
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Billing and notification behavior"
        description="Control invoice behavior, billing flexibility, and future-ready notification defaults."
      >
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Invoice prefix
            <input
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 uppercase outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              maxLength={20}
              onChange={(event) => setTextSetting("invoicePrefix", event.target.value)}
              value={settingsDraft.invoicePrefix}
            />
          </label>

          {[
            [
              "allowPartialPayments",
              "Allow partial payments",
              "When off, completed bills must be fully paid.",
            ],
            [
              "allowHeldBills",
              "Allow held bills",
              "When off, new held bills and edits to held drafts are blocked.",
            ],
            [
              "allowStaffSalesReturn",
              "Allow staff sales returns",
              "When off, only admins can create or finish sales returns.",
            ],
            [
              "allowDraftPurchases",
              "Allow draft purchases",
              "When off, purchase drafting is blocked until re-enabled.",
            ],
          ].map(([field, label, description]) => (
            <div
              className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              key={field}
            >
              <div>
                <p className="text-sm font-semibold text-slate-950">{label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
              </div>
              <button
                aria-pressed={settingsDraft[field as keyof UpdateAdminShopSettingsPayload] as boolean}
                className={
                  settingsDraft[field as keyof UpdateAdminShopSettingsPayload]
                    ? "inline-flex h-7 w-12 items-center rounded-full bg-teal-600 px-1"
                    : "inline-flex h-7 w-12 items-center rounded-full bg-slate-300 px-1"
                }
                onClick={() =>
                  setBooleanSetting(
                    field as keyof UpdateAdminShopSettingsPayload,
                    !(settingsDraft[field as keyof UpdateAdminShopSettingsPayload] as boolean),
                  )
                }
                type="button"
              >
                <span
                  className={
                    settingsDraft[field as keyof UpdateAdminShopSettingsPayload]
                      ? "h-5 w-5 translate-x-5 rounded-full bg-white transition"
                      : "h-5 w-5 translate-x-0 rounded-full bg-white transition"
                  }
                />
              </button>
            </div>
          ))}

          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Notification channels</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Email is active now. WhatsApp remains reserved for a future integration.
                </p>
              </div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                WhatsApp future-ready
              </span>
            </div>
            <div className="mt-4 grid gap-2">
              {(settingsQuery.data.primaryAlertRecipients.length
                ? settingsQuery.data.primaryAlertRecipients
                : [{ id: "none", fullName: "No active admin recipients", email: "" }]
              ).map((recipient) => (
                <div
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  key={recipient.id}
                >
                  <p className="text-sm font-medium text-slate-950">{recipient.fullName}</p>
                  {recipient.email ? (
                    <p className="text-xs text-slate-500">{recipient.email}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );

  const permissionsContent = (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <SectionCard
        title="Role permission matrix"
        description="Update role defaults in one place. Admin role changes are protected by self-lockout rules."
        action={
          <div className="flex gap-2">
            <button
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() =>
                setRoleDraft({
                  admin:
                    rolePermissionsQuery.data?.find((entry) => entry.role === "admin")
                      ?.permissions ?? [],
                  staff:
                    rolePermissionsQuery.data?.find((entry) => entry.role === "staff")
                      ?.permissions ?? [],
                  accountant:
                    rolePermissionsQuery.data?.find((entry) => entry.role === "accountant")
                      ?.permissions ?? [],
                })
              }
              type="button"
            >
              Reset
            </button>
            <button
              className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!roleDraftDirty || saveRolePermissionsMutation.isPending}
              onClick={() =>
                adminRoleChanged ? setShowRoleConfirm(true) : saveRolePermissionsMutation.mutate()
              }
              type="button"
            >
              {saveRolePermissionsMutation.isPending ? "Saving..." : "Save roles"}
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <th className="px-4">Permission</th>
                {roleOrder.map((role) => (
                  <th className="px-4 text-center" key={role}>
                    {humanizeLabel(role)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedCatalog.map((group) => (
                <tr key={group.group}>
                  <td colSpan={4}>
                    <div className="mb-1 mt-3 px-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {humanizeLabel(group.group)}
                    </div>
                    {group.items.map((permission) => (
                      <div
                        className="mb-2 grid min-w-[760px] grid-cols-[minmax(260px,1fr)_120px_120px_120px] items-center rounded-3xl border border-slate-200 bg-slate-50"
                        key={permission.key}
                      >
                        <div className="px-4 py-3">
                          <p className="text-sm font-semibold text-slate-950">{permission.label}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {permission.description}
                          </p>
                        </div>
                        {roleOrder.map((role) => (
                          <div className="flex justify-center px-4 py-3" key={`${permission.key}-${role}`}>
                            <input
                              checked={roleDraft[role].includes(permission.key)}
                              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              onChange={() => toggleRolePermission(role, permission.key)}
                              type="checkbox"
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="User-specific overrides"
        description="Grant extra access or block selected permissions for an individual user."
      >
        {eligibleUsers.length ? (
          <div className="space-y-4">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Select team member
              <select
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                onChange={(event) => setSelectedUserId(event.target.value)}
                value={selectedUserId}
              >
                {eligibleUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName} ({humanizeLabel(user.role)})
                  </option>
                ))}
              </select>
            </label>

            {userDetailQuery.isLoading ? (
              <LoadingState title="Loading permission detail" />
            ) : userDetailQuery.data ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Inherited", userDetailQuery.data.inheritedPermissions.length],
                    ["Allow overrides", overrideDraft.allow.length],
                    ["Effective", userDetailQuery.data.effectivePermissions.length],
                  ].map(([label, value]) => (
                    <article
                      className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                      key={label}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {label}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
                    </article>
                  ))}
                </div>

                <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                  {groupedCatalog.map((group) => (
                    <div key={group.group}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {humanizeLabel(group.group)}
                      </p>
                      <div className="space-y-2">
                        {group.items.map((permission) => {
                          const inherited = userDetailQuery.data.inheritedPermissions.includes(
                            permission.key,
                          );

                          return (
                            <div
                              className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                              key={permission.key}
                            >
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-slate-950">
                                    {permission.label}
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-slate-500">
                                    {permission.description}
                                  </p>
                                  <p className="mt-2 text-xs font-medium text-slate-600">
                                    {inherited ? "Inherited from role" : "Not granted by role"}
                                  </p>
                                </div>
                                <div className="flex gap-3">
                                  {[
                                    ["allow", "Allow"],
                                    ["deny", "Deny"],
                                  ].map(([mode, label]) => (
                                    <label
                                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                                      key={`${permission.key}-${mode}`}
                                    >
                                      <input
                                        checked={overrideDraft[mode as OverrideMode].includes(
                                          permission.key,
                                        )}
                                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                        onChange={() =>
                                          toggleOverridePermission(
                                            permission.key,
                                            mode as OverrideMode,
                                          )
                                        }
                                        type="checkbox"
                                      />
                                      {label}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    onClick={() =>
                      setOverrideDraft({
                        allow: userDetailQuery.data.overrides.allow,
                        deny: userDetailQuery.data.overrides.deny,
                      })
                    }
                    type="button"
                  >
                    Reset
                  </button>
                  <button
                    className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!overrideDirty || saveOverrideMutation.isPending}
                    onClick={() => saveOverrideMutation.mutate()}
                    type="button"
                  >
                    {saveOverrideMutation.isPending ? "Saving..." : "Save overrides"}
                  </button>
                </div>
              </>
            ) : (
              <EmptyState title="User unavailable" description="Select another team member." />
            )}
          </div>
        ) : (
          <EmptyState
            title="No eligible users"
            description="Invite staff or accountant users before applying individual overrides."
          />
        )}
      </SectionCard>
    </div>
  );

  const auditContent =
    auditLogsQuery.data?.items.length ? (
      <SectionCard
        title="Audit history"
        description="Recent changes to permissions and operational settings across this shop."
      >
        <div className="space-y-3">
          {auditLogsQuery.data.items.map((log) => (
            <article
              className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4"
              key={log.id}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {humanizeLabel(log.action)}: {log.targetLabel ?? "Unknown target"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {summarizeAuditLog(log)}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    By {log.actor?.fullName ?? "Unknown user"} on {formatDateTime(log.createdAt)}
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  {humanizeLabel(log.targetType)}
                </span>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    ) : (
      <EmptyState
        title="No audit activity yet"
        description="Permission and settings changes will appear here once admins start making updates."
      />
    );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin settings"
        title="Admin Settings and Permissions"
        description="Control role access, user overrides, operational rules, and change history from one compact admin workspace."
        actions={
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {[
              { id: "permissions", label: "Permissions" },
              { id: "operations", label: "Operations" },
              { id: "audit", label: "Audit trail" },
            ].map((tab) => (
              <button
                className={
                  activeTab === tab.id
                    ? "rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm"
                    : "rounded-2xl px-4 py-2 text-sm font-semibold text-slate-500"
                }
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      />

      {activeTab === "permissions"
        ? permissionsContent
        : activeTab === "operations"
          ? operationsContent
          : auditContent}

      <ConfirmDialog
        confirmLabel="Save admin role changes"
        description="Changing admin role permissions affects core control access. Self-lockout protection will still block unsafe combinations."
        isLoading={saveRolePermissionsMutation.isPending}
        onClose={() => setShowRoleConfirm(false)}
        onConfirm={() => saveRolePermissionsMutation.mutate()}
        open={showRoleConfirm}
        title="Confirm admin role update"
      />
    </div>
  );
};
