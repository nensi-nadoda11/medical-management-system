import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "../../../lib/utils";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  hideHint?: boolean;
  compact?: boolean;
  tone?: "default" | "accent" | "warning" | "danger";
  to?: string;
}

const toneClassNames: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default:
    "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))]",
  accent:
    "border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,250,0.96),rgba(255,255,255,0.92))]",
  warning:
    "border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.92))]",
  danger:
    "border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,241,242,0.96),rgba(255,255,255,0.92))]",
};

const content = ({
  label,
  value,
  hint,
  hideHint = false,
  compact = false,
  tone = "default",
}: Omit<MetricCardProps, "to">) => (
  <>
    <div
      className={cn(
        compact ? "inline-flex h-2 w-2 rounded-full" : "inline-flex h-2.5 w-2.5 rounded-full",
        tone === "accent"
          ? "bg-emerald-500"
          : tone === "warning"
            ? "bg-amber-500"
            : tone === "danger"
              ? "bg-rose-500"
              : "bg-slate-300",
      )}
    />
    <p
      className={cn(
        compact ? "mt-2.5 text-[10px]" : "mt-3 text-[11px]",
        "font-semibold uppercase tracking-[0.22em] text-slate-500",
      )}
    >
      {label}
    </p>
    <p
      className={cn(
        compact ? "mt-1.5 text-[1.45rem]" : "mt-2 text-[1.55rem]",
        "break-words font-semibold tracking-tight text-slate-950",
      )}
    >
      {value}
    </p>
    {hint && !hideHint ? <p className="mt-1.5 text-sm leading-5 text-slate-600">{hint}</p> : null}
  </>
);

export const MetricCard = ({ to, ...props }: MetricCardProps) => {
  const className = cn(
    props.compact
      ? "min-w-0 rounded-[24px] border p-3.5 shadow-[0_24px_56px_-42px_rgba(15,23,42,0.34)] transition"
      : "min-w-0 rounded-[24px] border p-4 shadow-[0_24px_56px_-42px_rgba(15,23,42,0.34)] transition",
    toneClassNames[props.tone ?? "default"],
    to
      ? "block hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_26px_56px_-36px_rgba(15,23,42,0.36)]"
      : "",
  );

  if (to) {
    return (
      <Link className={className} to={to}>
        {content(props)}
      </Link>
    );
  }

  return <article className={className}>{content(props)}</article>;
};
