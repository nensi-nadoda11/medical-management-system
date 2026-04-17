import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "../../../lib/api";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useToast } from "../../../hooks/use-toast";
import { formatDateTime, formatRelativeStatusDate } from "../../../lib/utils";
import type { StaffUser, UserInvitation } from "../../../types/staff";
import { getInvitationStatus } from "../../../types/staff";
import {
  getInvitations,
  getUsers,
  resendInvitation,
  revokeInvitation,
  staffQueryKeys,
  updateUserStatus,
} from "../api/staff";
import { EditUserDialog } from "../components/EditUserDialog";
import { InviteUserDialog } from "../components/InviteUserDialog";

type StaffTab = "users" | "invitations";
type UserFilter = "active" | "all" | "inactive";
type PendingAction =
  | { kind: "toggle-user"; user: StaffUser }
  | { kind: "resend-invitation"; invitation: UserInvitation }
  | { kind: "revoke-invitation"; invitation: UserInvitation }
  | null;

export const StaffManagementPage = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [activeTab, setActiveTab] = useState<StaffTab>("users");
  const [userFilter, setUserFilter] = useState<UserFilter>("active");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const usersQuery = useQuery({
    queryKey: staffQueryKeys.users,
    queryFn: getUsers,
  });

  const invitationsQuery = useQuery({
    queryKey: staffQueryKeys.invitations,
    queryFn: getInvitations,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      updateUserStatus(userId, { isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: staffQueryKeys.users });
      pushToast({
        title: "Status updated",
        description: "The user status has been updated successfully.",
        variant: "success",
      });
      setPendingAction(null);
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: resendInvitation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: staffQueryKeys.invitations });
      pushToast({
        title: "Invitation resent",
        description: "A fresh invite link has been sent to the user.",
        variant: "success",
      });
      setPendingAction(null);
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: revokeInvitation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: staffQueryKeys.invitations });
      pushToast({
        title: "Invitation revoked",
        description: "The invitation has been revoked successfully.",
        variant: "success",
      });
      setPendingAction(null);
    },
  });

  const summary = useMemo(() => {
    const users = usersQuery.data ?? [];
    const invitations = invitationsQuery.data ?? [];

    return {
      totalUsers: users.length,
      activeUsers: users.filter((user) => user.isActive).length,
      inactiveUsers: users.filter((user) => !user.isActive).length,
      pendingInvitations: invitations.filter(
        (invitation) => getInvitationStatus(invitation) === "pending",
      ).length,
    };
  }, [invitationsQuery.data, usersQuery.data]);

  if (usersQuery.isLoading || invitationsQuery.isLoading) {
    return <LoadingState title="Loading staff workspace" />;
  }

  if (usersQuery.error || invitationsQuery.error) {
    const activeError = usersQuery.error ?? invitationsQuery.error;

    return (
      <LoadingState
        description={
          activeError instanceof ApiError
            ? activeError.message
            : "We could not load the staff management data right now."
        }
        title={
          activeError instanceof ApiError && ![401, 403].includes(activeError.status)
            ? "Unable to load staff data"
            : "Checking access"
        }
      />
    );
  }

  const users = usersQuery.data ?? [];
  const invitations = invitationsQuery.data ?? [];
  const visibleUsers = users.filter((user) => {
    if (userFilter === "active") {
      return user.isActive;
    }

    if (userFilter === "inactive") {
      return !user.isActive;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <button
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            onClick={() => setIsInviteOpen(true)}
            type="button"
          >
            Invite user
          </button>
        }
        description="Manage active team members, pending invitations, and account access from one admin-friendly view."
        eyebrow="Admin workspace"
        title="Staff Management"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total users", summary.totalUsers],
          ["Active users", summary.activeUsers],
          ["Inactive users", summary.inactiveUsers],
          ["Pending invites", summary.pendingInvitations],
        ].map(([label, value]) => (
          <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60" key={label}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
          </article>
        ))}
      </div>

      <SectionCard
        action={
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {[
              { id: "users", label: "Active Users" },
              { id: "invitations", label: "Invitations" },
            ].map((tab) => (
              <button
                className={
                  activeTab === tab.id
                    ? "rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm"
                    : "rounded-2xl px-4 py-2 text-sm font-semibold text-slate-500"
                }
                key={tab.id}
                onClick={() => setActiveTab(tab.id as StaffTab)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
        description="Switch between live team members and invitation activity without leaving the page."
        title="Team operations"
      >
        {activeTab === "users" ? (
          users.length ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "active", label: "Active users" },
                  { id: "all", label: "All users" },
                  { id: "inactive", label: "Inactive users" },
                ].map((filter) => (
                  <button
                    className={
                      userFilter === filter.id
                        ? "rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                        : "rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                    }
                    key={filter.id}
                    onClick={() => setUserFilter(filter.id as UserFilter)}
                    type="button"
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {visibleUsers.length ? (
                <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">User</th>
                    <th className="px-4">Role</th>
                    <th className="px-4">Status</th>
                    <th className="px-4">Last login</th>
                    <th className="px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((user) => (
                    <tr className="rounded-3xl bg-slate-50" key={user.id}>
                      <td className="rounded-l-3xl px-4 py-4">
                        <div>
                          <p className="font-semibold text-slate-950">{user.fullName}</p>
                          <p className="mt-1 text-sm text-slate-600">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={user.role} tone={user.role} />
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={user.isActive ? "active" : "inactive"} />
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {formatDateTime(user.lastLoginAt)}
                      </td>
                      <td className="rounded-r-3xl px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={user.role === "admin"}
                            onClick={() => setEditingUser(user)}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={user.role === "admin"}
                            onClick={() => setPendingAction({ kind: "toggle-user", user })}
                            type="button"
                          >
                            {user.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
              ) : (
                <EmptyState
                  description="No users match the selected filter right now."
                  title="No matching users"
                />
              )}
            </div>
          ) : (
            <EmptyState
              description="Invite your first team member to start managing staff access."
              title="No staff users yet"
            />
          )
        ) : invitations.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4">Invitee</th>
                  <th className="px-4">Role</th>
                  <th className="px-4">Sent</th>
                  <th className="px-4">Expiry</th>
                  <th className="px-4">Status</th>
                  <th className="px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => {
                  const status = getInvitationStatus(invitation);
                  const allowResend = !invitation.acceptedAt && !invitation.revokedAt;
                  const allowRevoke = !invitation.acceptedAt && !invitation.revokedAt;

                  return (
                    <tr className="rounded-3xl bg-slate-50" key={invitation.id}>
                      <td className="rounded-l-3xl px-4 py-4">
                        <div>
                          <p className="font-semibold text-slate-950">{invitation.fullName}</p>
                          <p className="mt-1 text-sm text-slate-600">{invitation.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={invitation.role} tone={invitation.role} />
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {formatRelativeStatusDate(invitation.lastSentAt)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {formatRelativeStatusDate(invitation.expiresAt)}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={status} tone={status} />
                      </td>
                      <td className="rounded-r-3xl px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={!allowResend}
                            onClick={() => setPendingAction({ kind: "resend-invitation", invitation })}
                            type="button"
                          >
                            Resend
                          </button>
                          <button
                            className="rounded-2xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={!allowRevoke}
                            onClick={() => setPendingAction({ kind: "revoke-invitation", invitation })}
                            type="button"
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            description="No invitation history exists yet. Use the Invite User button to start onboarding your team."
            title="No invitations yet"
          />
        )}
      </SectionCard>

      <InviteUserDialog onClose={() => setIsInviteOpen(false)} open={isInviteOpen} />
      <EditUserDialog
        onClose={() => setEditingUser(null)}
        open={Boolean(editingUser)}
        user={editingUser}
      />

      <ConfirmDialog
        confirmLabel={
          pendingAction?.kind === "toggle-user"
            ? pendingAction.user.isActive
              ? "Deactivate user"
              : "Activate user"
            : pendingAction?.kind === "resend-invitation"
              ? "Resend invitation"
              : "Revoke invitation"
        }
        description={
          pendingAction?.kind === "toggle-user"
            ? "This updates the user's access immediately. Use it carefully to avoid locking someone out during active work."
            : pendingAction?.kind === "resend-invitation"
              ? "A fresh invite link will be issued and emailed to this user."
              : "The invite link will stop working after revocation."
        }
        isLoading={
          updateStatusMutation.isPending ||
          resendInvitationMutation.isPending ||
          revokeInvitationMutation.isPending
        }
        onClose={() => setPendingAction(null)}
        onConfirm={() => {
          if (!pendingAction) {
            return;
          }

          if (pendingAction.kind === "toggle-user") {
            updateStatusMutation.mutate({
              userId: pendingAction.user.id,
              isActive: !pendingAction.user.isActive,
            });
            return;
          }

          if (pendingAction.kind === "resend-invitation") {
            resendInvitationMutation.mutate(pendingAction.invitation.id);
            return;
          }

          revokeInvitationMutation.mutate(pendingAction.invitation.id);
        }}
        open={Boolean(pendingAction)}
        title={
          pendingAction?.kind === "toggle-user"
            ? "Confirm status change"
            : pendingAction?.kind === "resend-invitation"
              ? "Resend invitation"
              : "Revoke invitation"
        }
        tone={pendingAction?.kind === "revoke-invitation" ? "danger" : "default"}
      />
    </div>
  );
};
