import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ErrorState } from "../../../components/ui/ErrorState";
import { FilterBar } from "../../../components/ui/FilterBar";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { useToast } from "../../../hooks/use-toast";
import { formatCurrency, formatNumber } from "../../../lib/utils";
import { useSessionQuery } from "../../auth/hooks/use-session";
import {
  exportDashboardReport,
  getReportsDashboardSummary,
  reportsQueryKeys,
} from "../api/reports";
import { BranchScopeControl } from "../components/BranchScopeControl";
import { ReportExportButtons } from "../components/ReportExportButtons";
import { ReportsNav } from "../components/ReportsNav";

export const ReportsDashboardPage = () => {
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const role = sessionQuery.data?.user.role;
  const [branchId, setBranchId] = useState("");
  const [combineBranches, setCombineBranches] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const params = useMemo(
    () => ({
      branchId: branchId || undefined,
      combineBranches: combineBranches || undefined,
    }),
    [branchId, combineBranches],
  );

  const dashboardQuery = useQuery({
    queryKey: reportsQueryKeys.dashboard(params),
    queryFn: () => getReportsDashboardSummary(params),
    enabled: Boolean(role),
    refetchInterval: 300000,
  });

  if (!role || dashboardQuery.isLoading) {
    return <LoadingState title="Loading reports dashboard" />;
  }

  if (dashboardQuery.error) {
    return (
      <ErrorState
        description={dashboardQuery.error.message}
        onRetry={() => dashboardQuery.refetch()}
        title="Unable to load reports dashboard"
      />
    );
  }

  const summary = dashboardQuery.data!;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <ReportsNav role={role} />
            <ReportExportButtons
              isLoading={isExporting}
              onExport={(format) => {
                setIsExporting(true);
                void exportDashboardReport(params, format)
                  .then(() => {
                    pushToast({
                      title: "Export ready",
                      description: `Dashboard ${format.toUpperCase()} download started.`,
                      variant: "success",
                    });
                  })
                  .catch((error: Error) => {
                    pushToast({
                      title: "Export failed",
                      description: error.message,
                      variant: "error",
                    });
                  })
                  .finally(() => setIsExporting(false));
              }}
            />
          </>
        }
        eyebrow="Reports & Analytics"
        title="Reports dashboard"
      />

      <FilterBar title="Report scope">
        <div className="grid gap-4 md:grid-cols-2 xl:max-w-4xl">
          <BranchScopeControl
            branchId={branchId}
            combineBranches={combineBranches}
            onBranchIdChange={setBranchId}
            onCombineBranchesChange={setCombineBranches}
          />
        </div>
      </FilterBar>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          hint={`Bills ${formatNumber(summary.todaySales.totalBills)} today`}
          label="Today sales"
          tone="accent"
          value={formatCurrency(summary.todaySales.totalSales)}
        />
        <SummaryCard
          hint={`Bills ${formatNumber(summary.monthlySales.totalBills)} this month`}
          label="Monthly sales"
          value={formatCurrency(summary.monthlySales.totalSales)}
        />
        <SummaryCard
          hint="Current month gross profit"
          label="Total profit"
          tone="accent"
          value={formatCurrency(summary.totalProfit)}
        />
        <SummaryCard
          hint="Medicines under reorder threshold"
          label="Low stock count"
          tone={summary.lowStockCount ? "warning" : "default"}
          value={formatNumber(summary.lowStockCount)}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard className="h-full" title="Report shortcuts">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["Sales report", "/app/reports/sales", "Track bills, value, and payment mix."],
              ["Profit & loss", "/app/reports/profit", "Review revenue, cost, and margin trend."],
              ["Stock report", "/app/reports/stock", "Monitor valuation and batch-level stock."],
              ["Supplier report", "/app/reports/suppliers", "See purchase totals and outstanding dues."],
              ["Usage report", "/app/reports/usage", "Track medicine-wise daily and monthly consumption."],
            ]
              .filter(([title]) =>
                role === "staff"
                  ? title === "Sales report"
                  : true,
              )
              .map(([title, to, description]) => (
                <Link
                  className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3.5 transition hover:border-slate-300 hover:bg-white"
                  key={to}
                  to={to}
                >
                  <p className="text-sm font-semibold text-slate-950">{title}</p>
                  <p className="mt-1.5 text-sm leading-5 text-slate-600">{description}</p>
                </Link>
              ))}
          </div>
        </SectionCard>

        <SectionCard className="h-full" title="Expiry breakdown">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                label: "Expired",
                value: summary.expiryBreakdown.expired,
                tone: "danger" as const,
              },
              {
                label: "Next 30 days",
                value: summary.expiryBreakdown.next30Days,
                tone: "warning" as const,
              },
              {
                label: "Next 60 days",
                value: summary.expiryBreakdown.next60Days,
                tone: "warning" as const,
              },
              {
                label: "Next 90 days",
                value: summary.expiryBreakdown.next90Days,
                tone: "default" as const,
              },
            ].map((item) => (
              <article
                className={`rounded-[20px] border p-4 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.22)] ${
                  item.tone === "danger"
                    ? "border-rose-100 bg-[linear-gradient(180deg,rgba(255,241,242,0.98),rgba(255,255,255,0.94))]"
                    : item.tone === "warning"
                      ? "border-amber-100 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,255,255,0.94))]"
                      : "border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,255,0.94))]"
                }`}
                key={item.label}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {item.label}
                </p>
                <p className="mt-2 text-[1.45rem] font-semibold tracking-tight text-slate-950">
                  {formatNumber(item.value)}
                </p>
                <p className="mt-2 text-sm text-slate-600">Batch count</p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
