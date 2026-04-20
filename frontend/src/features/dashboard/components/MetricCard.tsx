import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "../../../lib/utils";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "accent" | "warning" | "danger";
  to?: string;
}

const toneClassNames: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "border-slate-200/80 bg-white",
  accent: "border-teal-200/80 bg-teal-50/70",
  warning: "border-amber-200/80 bg-amber-50/75",
  danger: "border-rose-200/80 bg-rose-50/75",
};

const content = ({ label, value, hint, tone = "default" }: Omit<MetricCardProps, "to">) => (
  <>
    <div
      className={cn(
        "inline-flex h-2.5 w-2.5 rounded-full",
        tone === "accent"
          ? "bg-teal-500"
          : tone === "warning"
            ? "bg-amber-500"
            : tone === "danger"
              ? "bg-rose-500"
              : "bg-slate-300",
      )}
    />
    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
      {label}
    </p>
    <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
      {value}
    </p>
    {hint ? <p className="mt-1.5 text-sm leading-5 text-slate-600">{hint}</p> : null}
  </>
);

export const MetricCard = ({ to, ...props }: MetricCardProps) => {
  const className = cn(
    "rounded-[22px] border p-4 shadow-sm shadow-slate-200/60 transition",
    toneClassNames[props.tone ?? "default"],
    to ? "block hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md" : "",
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
