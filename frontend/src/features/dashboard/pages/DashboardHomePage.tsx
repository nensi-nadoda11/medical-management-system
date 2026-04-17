import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useSessionQuery } from "../../auth/hooks/use-session";

export const DashboardHomePage = () => {
  const sessionQuery = useSessionQuery();

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
    </div>
  );
};
