import type { ReactNode } from "react";

interface SummaryCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "accent" | "danger" | "warning";
}

const toneClassNames: Record<NonNullable<SummaryCardProps["tone"]>, string> = {
  default: "border-slate-200 bg-white",
  accent: "border-teal-200/80 bg-teal-50/70",
  danger: "border-rose-200/80 bg-rose-50/70",
  warning: "border-amber-200/80 bg-amber-50/70",
};

export const SummaryCard = ({
  label,
  value,
  hint,
  tone = "default",
}: SummaryCardProps) => (
  <article
    className={`rounded-[20px] border p-4 shadow-sm shadow-slate-200/60 ${toneClassNames[tone]}`}
  >
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
    </p>
    <p className="mt-2 text-[1.45rem] font-semibold tracking-tight text-slate-950 md:text-[1.6rem]">
      {value}
    </p>
    {hint ? <p className="mt-1.5 text-sm leading-5 text-slate-600">{hint}</p> : null}
  </article>
);
