import { Link } from "react-router-dom";

import { cn } from "../../../lib/utils";

interface QuickLinkCardProps {
  title: string;
  description: string;
  to: string;
  metric?: string;
  hideDescription?: boolean;
  compact?: boolean;
  tone?: "default" | "accent" | "warning" | "danger";
}

const toneClassNames: Record<NonNullable<QuickLinkCardProps["tone"]>, string> = {
  default:
    "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))]",
  accent:
    "border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,250,0.96),rgba(255,255,255,0.92))]",
  warning:
    "border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.92))]",
  danger:
    "border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,241,242,0.96),rgba(255,255,255,0.92))]",
};

export const QuickLinkCard = ({
  title,
  description,
  to,
  metric,
  hideDescription = false,
  compact = false,
  tone = "default",
}: QuickLinkCardProps) => (
  <Link
    className={cn(
      compact
        ? "group min-w-0 rounded-[24px] border p-3.5 shadow-[0_24px_56px_-42px_rgba(15,23,42,0.34)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_28px_60px_-40px_rgba(15,23,42,0.36)]"
        : "group min-w-0 rounded-[24px] border p-4 shadow-[0_24px_56px_-42px_rgba(15,23,42,0.34)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_28px_60px_-40px_rgba(15,23,42,0.36)]",
      toneClassNames[tone],
    )}
    to={to}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        {!hideDescription ? (
          <p className="mt-1.5 text-sm leading-6 text-slate-600">{description}</p>
        ) : null}
      </div>
      <span className="text-slate-400 transition group-hover:text-slate-700" aria-hidden="true">
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      </span>
    </div>
    {metric ? (
      <p
        className={cn(
          compact ? "mt-2.5" : "mt-3",
          "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500",
        )}
      >
        {metric}
      </p>
    ) : null}
  </Link>
);
