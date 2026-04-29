import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { FilterBar } from "../../../components/ui/FilterBar";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { useToast } from "../../../hooks/use-toast";
import { cn, formatDateTime } from "../../../lib/utils";
import type { NotificationsParams } from "../../../types/notification";
import {
  acknowledgeNotification,
  bulkMarkNotificationsRead,
  getNotificationSummary,
  listNotifications,
  markNotificationAsRead,
  notificationsQueryKeys,
} from "../api/notifications";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

export const NotificationCenterPage = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [type, setType] = useState<NotificationsParams["type"]>();
  const [severity, setSeverity] = useState<NotificationsParams["severity"]>();
  const [status, setStatus] = useState<"all" | "unread" | "read">("unread");
  const [ackState, setAckState] = useState<"all" | "pending" | "acknowledged">(
    "all",
  );
  const [activeOnly, setActiveOnly] = useState(true);
  const [page, setPage] = useState(1);

  const params: NotificationsParams = {
    page,
    pageSize: 10,
    activeOnly,
    ...(type ? { type } : {}),
    ...(severity ? { severity } : {}),
    ...(status === "unread" ? { isRead: false } : {}),
    ...(status === "read" ? { isRead: true } : {}),
    ...(ackState === "pending" ? { isAcknowledged: false } : {}),
    ...(ackState === "acknowledged" ? { isAcknowledged: true } : {}),
  };

  const notificationsQuery = useQuery({
    queryKey: notificationsQueryKeys.list(params),
    queryFn: () => listNotifications(params),
  });

  const summaryQuery = useQuery({
    queryKey: notificationsQueryKeys.summary,
    queryFn: getNotificationSummary,
  });

  const invalidateNotifications = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.all }),
    ]);

  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: async () => {
      await invalidateNotifications();
    },
    onError: (error: Error) => {
      pushToast({
        title: "Unable to mark notification as read",
        description: error.message,
        variant: "error",
      });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeNotification,
    onSuccess: async () => {
      await invalidateNotifications();
      pushToast({
        title: "Notification acknowledged",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      pushToast({
        title: "Unable to acknowledge notification",
        description: error.message,
        variant: "error",
      });
    },
  });

  const bulkReadMutation = useMutation({
    mutationFn: () => bulkMarkNotificationsRead(),
    onSuccess: async (result) => {
      await invalidateNotifications();
      pushToast({
        title: "Notifications updated",
        description: `${result.updatedCount} notification(s) marked as read.`,
        variant: "success",
      });
    },
    onError: (error: Error) => {
      pushToast({
        title: "Unable to update notifications",
        description: error.message,
        variant: "error",
      });
    },
  });

  if (notificationsQuery.isLoading || summaryQuery.isLoading) {
    return <LoadingState title="Loading notification center" />;
  }

  const activeError = notificationsQuery.error ?? summaryQuery.error;

  if (activeError) {
    return (
      <ErrorState
        title="Unable to load notifications"
        description={activeError.message}
        onRetry={() => {
          notificationsQuery.refetch();
          summaryQuery.refetch();
        }}
      />
    );
  }

  const items = notificationsQuery.data?.items ?? [];
  const pagination = notificationsQuery.data?.pagination;
  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Notification center"
        title="Alerts & notifications"
        description="Stay on top of stock pressure, expiry exposure, and financial follow-up from one compact operational queue."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!summary?.unreadCount || bulkReadMutation.isPending}
              onClick={() => bulkReadMutation.mutate()}
              type="button"
            >
              {bulkReadMutation.isPending ? "Updating..." : "Mark all read"}
            </button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Unread alerts"
          value={summary?.unreadCount ?? 0}
          tone={summary?.unreadCount ? "accent" : "default"}
          hint="Unread items across your accessible queue"
        />
        <SummaryCard
          label="Critical active"
          value={summary?.criticalCount ?? 0}
          tone={summary?.criticalCount ? "danger" : "default"}
          hint="High-priority conditions still needing attention"
        />
        <SummaryCard
          label="Visible items"
          value={pagination?.total ?? 0}
          hint="Notifications matching the active filters"
        />
        <SummaryCard
          label="Pending action"
          value={items.filter((item) => item.isActive && !item.isAcknowledged).length}
          tone="warning"
          hint="Active notifications on this page not yet acknowledged"
        />
      </div>

      <FilterBar
        title="Filter notifications"
        description="Narrow the queue by alert type, severity, and current handling state."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Type
            <select
              className={inputClassName}
              onChange={(event) => {
                setType(
                  event.target.value
                    ? (event.target.value as NotificationsParams["type"])
                    : undefined,
                );
                setPage(1);
              }}
              value={type ?? ""}
            >
              <option value="">All types</option>
              <option value="low_stock">Low stock</option>
              <option value="supplier_reorder">Supplier reorder</option>
              <option value="near_expiry">Near expiry</option>
              <option value="expired_stock">Expired stock</option>
              <option value="customer_due">Customer due</option>
              <option value="supplier_payable">Supplier payable</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Severity
            <select
              className={inputClassName}
              onChange={(event) => {
                setSeverity(
                  event.target.value
                    ? (event.target.value as NotificationsParams["severity"])
                    : undefined,
                );
                setPage(1);
              }}
              value={severity ?? ""}
            >
              <option value="">All severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Read state
            <select
              className={inputClassName}
              onChange={(event) => {
                setStatus(event.target.value as typeof status);
                setPage(1);
              }}
              value={status}
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Acknowledgement
            <select
              className={inputClassName}
              onChange={(event) => {
                setAckState(event.target.value as typeof ackState);
                setPage(1);
              }}
              value={ackState}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="acknowledged">Acknowledged</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Activity
            <select
              className={inputClassName}
              onChange={(event) => {
                setActiveOnly(event.target.value === "active");
                setPage(1);
              }}
              value={activeOnly ? "active" : "all"}
            >
              <option value="active">Active only</option>
              <option value="all">Include resolved</option>
            </select>
          </label>
        </div>
      </FilterBar>

      <SectionCard
        title="Operational queue"
        description="Unread items stay visually elevated so the most important alerts remain easy to scan."
      >
        {items.length ? (
          <div className="space-y-3">
            {items.map((item) => (
              <article
                className={cn(
                  "rounded-[24px] border p-4 shadow-sm transition",
                  item.isRead
                    ? "border-slate-200 bg-white"
                    : "border-teal-200 bg-teal-50/40 shadow-teal-100/60",
                )}
                key={item.id}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={item.type} tone={item.type} />
                      <StatusBadge label={item.severity} tone={item.severity} />
                      {!item.isRead ? (
                        <span className="inline-flex items-center rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-semibold text-white">
                          Unread
                        </span>
                      ) : null}
                      {item.isAcknowledged ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                          Acknowledged
                        </span>
                      ) : null}
                      {!item.isActive ? (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                          Resolved
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <h2 className="text-base font-semibold text-slate-950">
                        {item.title}
                      </h2>
                      <p className="max-w-3xl text-sm leading-6 text-slate-600">
                        {item.message}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
                      <span>Created {formatDateTime(item.createdAt)}</span>
                      {item.readAt ? <span>Read {formatDateTime(item.readAt)}</span> : null}
                      {item.acknowledgedAt ? (
                        <span>Acknowledged {formatDateTime(item.acknowledgedAt)}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {!item.isRead ? (
                      <button
                        className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={markReadMutation.isPending}
                        onClick={() => markReadMutation.mutate(item.id)}
                        type="button"
                      >
                        Mark read
                      </button>
                    ) : null}

                    {item.isActive && !item.isAcknowledged ? (
                      <button
                        className="rounded-2xl bg-slate-950 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={acknowledgeMutation.isPending}
                        onClick={() => acknowledgeMutation.mutate(item.id)}
                        type="button"
                      >
                        Acknowledge
                      </button>
                    ) : null}

                    {item.actionPath ? (
                      <Link
                        className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        to={item.actionPath}
                      >
                        {item.actionLabel ?? "Open"}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}

            {pagination ? (
              <Pagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                totalItems={pagination.total}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
              />
            ) : null}
          </div>
        ) : (
          <EmptyState
            title="Notification queue is clear"
            description="No notifications match the current filters right now."
          />
        )}
      </SectionCard>
    </div>
  );
};
