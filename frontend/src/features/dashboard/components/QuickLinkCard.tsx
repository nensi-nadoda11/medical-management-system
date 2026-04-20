import { Link } from "react-router-dom";

import { cn } from "../../../lib/utils";

interface QuickLinkCardProps {
  title: string;
  description: string;
  to: string;
  metric?: string;
  tone?: "default" | "accent" | "warning" | "danger";
}

const toneClassNames: Record<NonNullable<QuickLinkCardProps["tone"]>, string> = {
  default: "border-slate-200 bg-white",
  accent: "border-teal-200/80 bg-teal-50/60",
  warning: "border-amber-200/80 bg-amber-50/70",
  danger: "border-rose-200/80 bg-rose-50/70",
};

export const QuickLinkCard = ({
  title,
  description,
  to,
  metric,
  tone = "default",
}: QuickLinkCardProps) => (
  <Link
    className={cn(
      "group rounded-[22px] border p-4 shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
      toneClassNames[tone],
    )}
    to={to}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-1.5 text-sm leading-5 text-slate-600">{description}</p>
      </div>
      <span className="text-slate-400 transition group-hover:text-slate-700" aria-hidden="true">
        →
      </span>
    </div>
    {metric ? (
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {metric}
      </p>
    ) : null}
  </Link>
);
