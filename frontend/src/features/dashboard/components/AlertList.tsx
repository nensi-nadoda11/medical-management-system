import { Link } from "react-router-dom";

import { StatusBadge } from "../../../components/ui/StatusBadge";
import { cn, formatDateTime } from "../../../lib/utils";
import type { NotificationItem } from "../../../types/notification";

interface AlertListProps {
  items: NotificationItem[];
}

export const AlertList = ({ items }: AlertListProps) => {
  if (!items.length) {
    return (
      <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        No active alerts need attention right now.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const className = cn(
          "block rounded-[20px] border p-4 shadow-sm shadow-slate-200/50 transition",
          item.severity === "critical"
            ? "border-rose-200 bg-rose-50/70 hover:border-rose-300"
            : item.severity === "warning"
              ? "border-amber-200 bg-amber-50/70 hover:border-amber-300"
              : "border-slate-200 bg-white hover:border-slate-300",
        );
        const content = (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={item.type} tone={item.type} />
              <StatusBadge label={item.severity} tone={item.severity} />
              {!item.isRead ? (
                <span className="inline-flex items-center rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-semibold text-white">
                  Unread
                </span>
              ) : null}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-950">{item.title}</h3>
            <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-slate-600">
              {item.message}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
              <span>{formatDateTime(item.createdAt)}</span>
              {item.actionPath ? <span>{item.actionLabel ?? "Open"}</span> : null}
            </div>
          </>
        );

        return item.actionPath ? (
          <Link className={className} key={item.id} to={item.actionPath}>
            {content}
          </Link>
        ) : (
          <article className={className} key={item.id}>
            {content}
          </article>
        );
      })}
    </div>
  );
};
