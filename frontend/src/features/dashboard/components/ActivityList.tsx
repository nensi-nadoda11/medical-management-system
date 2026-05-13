import { Link } from "react-router-dom";

import { StatusBadge } from "../../../components/ui/StatusBadge";
import { cn, formatDateTime } from "../../../lib/utils";

export interface DashboardActivityItem {
  id: string;
  label: string;
  title: string;
  description: string;
  amount?: string;
  occurredAt: string | null;
  to?: string;
  tone?: string;
}

interface ActivityListProps {
  items: DashboardActivityItem[];
  className?: string;
  compact?: boolean;
  emptyMessage?: string;
  inlineDescription?: boolean;
}

export const ActivityList = ({
  items,
  className,
  compact = false,
  emptyMessage = "No recent operational activity is available for your current access.",
  inlineDescription = false,
}: ActivityListProps) => {
  if (!items.length) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.92))] px-4 py-8 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("ui-feed-list", compact ? "gap-3" : "", className)}>
      {items.map((item) => {
        const content = compact ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={item.label} tone={item.tone ?? item.label} />
              <span className="text-xs font-medium text-slate-500">
                {formatDateTime(item.occurredAt)}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {inlineDescription ? (
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className="shrink-0 text-sm font-semibold text-slate-950">
                      {item.title}
                    </h3>
                    {item.description ? (
                      <p className="min-w-0 truncate text-sm text-slate-500">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-slate-950">{item.title}</h3>
                    {item.description ? (
                      <p className="mt-1 text-sm leading-5 text-slate-600">{item.description}</p>
                    ) : null}
                  </>
                )}
              </div>
              {item.amount ? (
                <p className="shrink-0 text-sm font-semibold text-slate-950">{item.amount}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={item.label} tone={item.tone ?? item.label} />
                <span className="text-xs font-medium text-slate-500">
                  {formatDateTime(item.occurredAt)}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.description}</p>
            </div>
            {item.amount ? (
              <p className="shrink-0 text-sm font-semibold text-slate-950">{item.amount}</p>
            ) : null}
          </div>
        );

        return item.to ? (
          <Link
            className={cn(
              "block rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] shadow-[0_20px_48px_-38px_rgba(15,23,42,0.28)] transition hover:border-slate-300 hover:bg-white",
              compact ? "p-3.5" : "p-4",
            )}
            key={item.id}
            to={item.to}
          >
            {content}
          </Link>
        ) : (
          <article
            className={cn(
              "block rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] shadow-[0_20px_48px_-38px_rgba(15,23,42,0.28)] transition hover:border-slate-300 hover:bg-white",
              compact ? "p-3.5" : "p-4",
            )}
            key={item.id}
          >
            {content}
          </article>
        );
      })}
    </div>
  );
};
