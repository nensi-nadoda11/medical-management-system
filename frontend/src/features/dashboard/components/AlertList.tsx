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
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.92))] px-4 py-8 text-center text-sm text-slate-500">
        No active alerts need attention right now.
      </div>
    );
  }

  return (
    <div className="ui-feed-list !max-h-[28rem]">
      {items.map((item) => {
        const className = cn(
          "block rounded-[22px] border p-4 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.28)] transition",
          item.severity === "critical"
            ? "border-rose-200 bg-[linear-gradient(180deg,rgba(255,241,242,0.96),rgba(255,255,255,0.94))] hover:border-rose-300"
            : item.severity === "warning"
              ? "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.94))] hover:border-amber-300"
              : "border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] hover:border-slate-300 hover:bg-white",
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
