import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatDateTime } from "../../../lib/utils";
import { useSessionQuery } from "../../auth/hooks/use-session";

export const DashboardHomePage = () => {
  const sessionQuery = useSessionQuery();

  if (!sessionQuery.data) {
    return null;
  }

  const { user, shop, sessionExpiresAt } = sessionQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Your authenticated workspace is active. Admin users can manage shop details and staff invitations from the navigation."
        eyebrow="Workspace"
        title={`Welcome, ${user.fullName}`}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          description="A quick summary of the authenticated account and connected shop."
          title="Session overview"
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
                Permissions are automatically driven by the authenticated role.
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
                Session-linked shop details are available across the dashboard.
              </p>
            </article>
          </div>
        </SectionCard>

        <SectionCard
          description="Useful details for current sign-in and support checks."
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
            <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Session expires
              </dt>
              <dd className="mt-2 text-sm font-medium text-slate-900">
                {formatDateTime(sessionExpiresAt)}
              </dd>
            </div>
          </dl>
        </SectionCard>
      </div>
    </div>
  );
};
