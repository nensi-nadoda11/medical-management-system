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
}

export const ActivityList = ({ items }: ActivityListProps) => {
  if (!items.length) {
    return (
      <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        No recent operational activity is available for your current access.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const content = (
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
              <p className={cn("shrink-0 text-sm font-semibold text-slate-950")}>
                {item.amount}
              </p>
            ) : null}
          </div>
        );

        return item.to ? (
          <Link
            className="block rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 transition hover:border-slate-300"
            key={item.id}
            to={item.to}
          >
            {content}
          </Link>
        ) : (
          <article
            className="block rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 transition hover:border-slate-300"
            key={item.id}
          >
            {content}
          </article>
        );
      })}
    </div>
  );
};
