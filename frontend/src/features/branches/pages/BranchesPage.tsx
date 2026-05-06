import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";

import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { useToast } from "../../../hooks/use-toast";
import { formatNumber } from "../../../lib/utils";
import type { BranchFormPayload, BranchRecord } from "../../../types/branch";
import {
  branchesQueryKeys,
  createBranch,
  getBranches,
  updateBranch,
} from "../api/branches";
import { BranchDialog } from "../components/BranchDialog";

export const BranchesPage = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [editingBranch, setEditingBranch] = useState<BranchRecord | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const branchesQuery = useQuery({
    queryKey: branchesQueryKeys.list,
    queryFn: getBranches,
  });

  const createMutation = useMutation({
    mutationFn: createBranch,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: branchesQueryKeys.all });
      pushToast({
        title: "Branch created",
        description: "The new branch is now ready for assignment and operations.",
        variant: "success",
      });
      setIsDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ branchId, payload }: { branchId: string; payload: Partial<BranchFormPayload> }) =>
      updateBranch(branchId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: branchesQueryKeys.all });
      pushToast({
        title: "Branch updated",
        description: "Branch details and overrides were saved successfully.",
        variant: "success",
      });
      setEditingBranch(null);
      setIsDialogOpen(false);
    },
  });

  const summary = useMemo(() => {
    const items = branchesQuery.data?.items ?? [];

    return {
      total: items.length,
      active: items.filter((item) => item.status === "active").length,
      inactive: items.filter((item) => item.status === "inactive").length,
      assignedUsers: items.reduce((sum, item) => sum + item.assignedUsers, 0),
    };
  }, [branchesQuery.data]);

  if (branchesQuery.isLoading) {
    return <LoadingState title="Loading branches" />;
  }

  if (branchesQuery.error) {
    return (
      <ErrorState
        description={branchesQuery.error.message}
        onRetry={() => branchesQuery.refetch()}
        title="Unable to load branches"
      />
    );
  }

  const branches = branchesQuery.data?.items ?? [];
  const activeMutation = createMutation.isPending || updateMutation.isPending;
  const activeError = createMutation.error?.message ?? updateMutation.error?.message;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <button
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            onClick={() => {
              setEditingBranch(null);
              setIsDialogOpen(true);
            }}
            type="button"
          >
            Create branch
          </button>
        }
        eyebrow="Multi-Branch Control"
        title="Branch management"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total branches" value={formatNumber(summary.total)} />
        <SummaryCard label="Active branches" tone="accent" value={formatNumber(summary.active)} />
        <SummaryCard label="Inactive branches" value={formatNumber(summary.inactive)} />
        <SummaryCard label="Assigned users" value={formatNumber(summary.assignedUsers)} />
      </div>

      <SectionCard
        title="Branch register"
      >
        {branches.length ? (
          <div className="space-y-4">
            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-[1180px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Branch</th>
                    <th className="px-4">Status</th>
                    <th className="px-4">Users</th>
                    <th className="px-4">Invoice prefix</th>
                    <th className="px-4">Low stock threshold</th>
                    <th className="px-4">Alerts</th>
                    <th className="px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((branch) => (
                    <tr className="rounded-3xl bg-slate-50" key={branch.id}>
                      <td className="rounded-l-3xl px-4 py-4">
                        <p className="font-semibold text-slate-950">
                          {branch.name} {branch.isDefault ? "(Default)" : ""}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {branch.code}
                          {branch.address ? ` • ${branch.address}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={branch.status} />
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatNumber(branch.assignedUsers)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{branch.settings.invoicePrefix ?? "Shop default"}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {branch.settings.lowStockThreshold ?? "Shop default"}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {branch.settings.lowStockAlertsEnabled ? "Low stock" : "No low stock"}
                        {" / "}
                        {branch.settings.expiryAlertsEnabled ? "Expiry" : "No expiry"}
                      </td>
                      <td className="rounded-r-3xl px-4 py-4 text-right">
                        <button
                          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                          onClick={() => {
                            setEditingBranch(branch);
                            setIsDialogOpen(true);
                          }}
                          type="button"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 xl:hidden">
              {branches.map((branch) => (
                <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-4" key={branch.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {branch.name} {branch.isDefault ? "(Default)" : ""}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{branch.code}</p>
                    </div>
                    <StatusBadge label={branch.status} />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Assigned users", formatNumber(branch.assignedUsers)],
                      ["Invoice prefix", branch.settings.invoicePrefix ?? "Shop default"],
                      ["Low stock threshold", String(branch.settings.lowStockThreshold ?? "Shop default")],
                      ["Contact", branch.contactNumber ?? "Not provided"],
                    ].map(([label, value]) => (
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5" key={label}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    className="mt-3 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                    onClick={() => {
                      setEditingBranch(branch);
                      setIsDialogOpen(true);
                    }}
                    type="button"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            description="Create the first additional branch to enable branch switching and stock transfer workflows."
            title="No branch records available"
          />
        )}
      </SectionCard>

      <BranchDialog
        branch={editingBranch}
        errorMessage={activeError}
        isLoading={activeMutation}
        onClose={() => {
          setEditingBranch(null);
          setIsDialogOpen(false);
        }}
        onSubmit={async (payload) => {
          if (editingBranch) {
            await updateMutation.mutateAsync({ branchId: editingBranch.id, payload });
            return;
          }

          await createMutation.mutateAsync(payload);
        }}
        open={isDialogOpen}
      />
    </div>
  );
};
