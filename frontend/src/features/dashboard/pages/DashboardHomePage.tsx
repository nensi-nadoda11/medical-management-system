import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { useSessionQuery } from "../../auth/hooks/use-session";
import {
  getNotificationSummary,
  notificationsQueryKeys,
} from "../../notifications/api/notifications";

export const DashboardHomePage = () => {
  const sessionQuery = useSessionQuery();
  const notificationsSummaryQuery = useQuery({
    queryKey: notificationsQueryKeys.summary,
    queryFn: getNotificationSummary,
    enabled: Boolean(sessionQuery.data),
  });

  if (!sessionQuery.data) {
    return null;
  }

  const { user, shop } = sessionQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Monitor your workspace, role access, and core business setup from one professional dashboard."
        eyebrow="Workspace"
        title={`Welcome, ${user.fullName}`}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          description="A quick summary of the authenticated account and connected shop."
          title="Workspace overview"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Current role
              </p>
              <div className="mt-3">
                <StatusBadge label={user.role} tone={user.role} />
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Access stays aligned with your assigned responsibilities.
              </p>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Shop status
              </p>
              <div className="mt-3">
                <StatusBadge label={shop.status} tone={shop.status} />
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Your shop remains active and ready for operations.
              </p>
            </article>
          </div>
        </SectionCard>

        <SectionCard
          description="Essential account details without technical noise."
          title="Account details"
        >
          <dl className="grid gap-4">
            <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Email
              </dt>
              <dd className="mt-2 text-sm font-medium text-slate-900">{user.email}</dd>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Mobile
              </dt>
              <dd className="mt-2 text-sm font-medium text-slate-900">
                {user.mobileNumber || "Not configured"}
              </dd>
            </div>
          </dl>
        </SectionCard>
      </div>

      <SectionCard
        title="Attention queue"
        description="A compact view of the unread and high-priority items currently waiting in the notification center."
        action={
          <Link
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            to="/app/notifications"
          >
            Open notifications
          </Link>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <SummaryCard
              label="Unread"
              value={notificationsSummaryQuery.data?.unreadCount ?? 0}
              tone={notificationsSummaryQuery.data?.unreadCount ? "accent" : "default"}
              hint="Unread notifications in your queue"
            />
            <SummaryCard
              label="Critical active"
              value={notificationsSummaryQuery.data?.criticalCount ?? 0}
              tone={notificationsSummaryQuery.data?.criticalCount ? "danger" : "default"}
              hint="Critical alerts still active"
            />
            <SummaryCard
              label="Latest items"
              value={notificationsSummaryQuery.data?.latest.length ?? 0}
              hint="Recent notifications visible from the dashboard"
            />
          </div>

          <div className="grid gap-3">
            {(notificationsSummaryQuery.data?.latest ?? []).slice(0, 3).map((item) => (
              <article
                className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3.5"
                key={item.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={item.type} tone={item.type} />
                  <StatusBadge label={item.severity} tone={item.severity} />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.message}</p>
              </article>
            ))}

            {!notificationsSummaryQuery.data?.latest.length ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
                No notifications need attention right now.
              </div>
            ) : null}
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
