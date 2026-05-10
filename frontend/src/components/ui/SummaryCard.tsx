import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface SummaryCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "accent" | "danger" | "warning";
  icon?: ReactNode;
  theme?: "light" | "dark";
}

const toneClassNames: Record<NonNullable<SummaryCardProps["tone"]>, string> = {
  default:
    "border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,255,0.94))]",
  accent:
    "border-emerald-100 bg-[linear-gradient(180deg,rgba(240,253,246,0.98),rgba(255,255,255,0.94))]",
  danger:
    "border-rose-100 bg-[linear-gradient(180deg,rgba(255,241,242,0.98),rgba(255,255,255,0.94))]",
  warning:
    "border-amber-100 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,255,255,0.94))]",
};

export const SummaryCard = ({
  label,
  value,
  hint,
  tone = "default",
  icon,
  theme = "light",
}: SummaryCardProps) => (
  <article
    className={cn(
      "min-w-0 rounded-[24px] border p-4 shadow-[0_20px_48px_-40px_rgba(15,23,42,0.22)]",
      theme === "dark"
        ? "border-white/10 bg-[linear-gradient(180deg,rgba(19,27,47,0.98),rgba(12,18,33,0.98))]"
        : toneClassNames[tone],
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.22em]",
            theme === "dark" ? "text-slate-400" : "text-slate-500",
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "mt-2 break-words text-[1.45rem] font-semibold tracking-tight md:text-[1.68rem]",
            theme === "dark" ? "text-white" : "text-slate-950",
          )}
        >
          {value}
        </p>
        {hint ? (
          <p
            className={cn(
              "mt-2 text-sm leading-5",
              theme === "dark" ? "text-slate-300" : "text-slate-600",
            )}
          >
            {hint}
          </p>
        ) : null}
      </div>
      {icon ? (
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]",
            theme === "dark"
              ? "bg-white/[0.08] text-emerald-300"
              : tone === "danger"
                ? "bg-rose-50 text-rose-500"
                : tone === "warning"
                  ? "bg-amber-50 text-amber-500"
                  : tone === "accent"
                    ? "bg-emerald-50 text-emerald-500"
                    : "bg-violet-50 text-violet-500",
          )}
        >
          {icon}
        </div>
      ) : null}
    </div>
  </article>
);
