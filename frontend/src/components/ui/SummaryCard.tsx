import type { ReactNode } from "react";

interface SummaryCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "accent" | "danger" | "warning";
}

const toneClassNames: Record<NonNullable<SummaryCardProps["tone"]>, string> = {
  default:
    "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))]",
  accent:
    "border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,250,0.95),rgba(255,255,255,0.92))]",
  danger:
    "border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,241,242,0.95),rgba(255,255,255,0.92))]",
  warning:
    "border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,255,255,0.92))]",
};

export const SummaryCard = ({
  label,
  value,
  hint,
  tone = "default",
}: SummaryCardProps) => (
  <article
    className={`min-w-0 rounded-[24px] border p-4 shadow-[0_24px_54px_-42px_rgba(15,23,42,0.34)] ${toneClassNames[tone]}`}
  >
    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
      {label}
    </p>
    <p className="mt-2 break-words text-[1.5rem] font-semibold tracking-tight text-slate-950 md:text-[1.7rem]">
      {value}
    </p>
    {hint ? <p className="mt-2 text-sm leading-5 text-slate-600">{hint}</p> : null}
  </article>
);
