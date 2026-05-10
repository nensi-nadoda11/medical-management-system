import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Pagination } from "../../../components/ui/Pagination";
import { StatusBadge } from "../../../components/ui/StatusBadge";
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

const inputClassName = "ui-input";

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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-white/75 bg-[radial-gradient(circle_at_top_left,rgba(109,61,245,0.1),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,255,0.95))] px-5 py-4 shadow-[0_28px_72px_-48px_rgba(15,23,42,0.24)]">
        <h1 className="text-[1.9rem] font-semibold tracking-tight text-slate-950">
          Alerts & notifications
        </h1>
        <button
          className="ui-btn ui-btn--primary"
          disabled={!summary?.unreadCount || bulkReadMutation.isPending}
          onClick={() => bulkReadMutation.mutate()}
          type="button"
        >
          {bulkReadMutation.isPending ? "Updating..." : "Mark all read"}
        </button>
      </div>

      <div className="rounded-[22px] border border-slate-200/75 bg-white/92 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] md:p-4">
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
      </div>

      <section className="rounded-[26px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,255,0.94))] p-4 shadow-[0_24px_54px_-42px_rgba(15,23,42,0.24)] md:p-5">
        <h2 className="text-[1.1rem] font-semibold text-slate-950">Notifications</h2>
        {items.length ? (
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <article
                className={cn(
                  "rounded-[20px] border px-4 py-3.5 shadow-sm transition",
                  item.isRead
                    ? "border-slate-200 bg-white/92"
                    : "border-violet-100 bg-violet-50/55 shadow-violet-100/70",
                )}
                key={item.id}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={item.type} tone={item.type} />
                      <StatusBadge label={item.severity} tone={item.severity} />
                      {!item.isRead ? (
                        <span className="inline-flex items-center rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white">
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

                    <div className="space-y-1">
                      <h2 className="text-[0.95rem] font-semibold leading-5 text-slate-950">
                        {item.title}
                      </h2>
                      <p className="max-w-3xl text-sm leading-5 text-slate-600">
                        {item.message}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-slate-500">
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
                        className="ui-btn ui-btn--secondary !min-h-[2.1rem] !px-3"
                        disabled={markReadMutation.isPending}
                        onClick={() => markReadMutation.mutate(item.id)}
                        type="button"
                      >
                        Mark read
                      </button>
                    ) : null}

                    {item.isActive && !item.isAcknowledged ? (
                      <button
                        className="ui-btn ui-btn--primary !min-h-[2.1rem] !px-3"
                        disabled={acknowledgeMutation.isPending}
                        onClick={() => acknowledgeMutation.mutate(item.id)}
                        type="button"
                      >
                        Acknowledge
                      </button>
                    ) : null}

                    {item.actionPath ? (
                      <Link
                        className="ui-btn ui-btn--secondary !min-h-[2.1rem] !px-3"
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
          <div className="mt-4 rounded-[22px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,251,0.96))] px-6 py-8 text-center shadow-[0_24px_58px_-46px_rgba(15,23,42,0.18)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm shadow-slate-200/80">
              <span className="text-base font-semibold text-slate-500">i</span>
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              Notification queue is clear
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              No notifications match the current filters right now.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
