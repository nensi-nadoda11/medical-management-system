import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  theme?: "light" | "dark";
}

export const PageHeader = ({
  eyebrow,
  title,
  description,
  actions,
  className,
  titleClassName,
  theme = "light",
}: PageHeaderProps) => (
  <div
    className={cn(
      "relative overflow-hidden rounded-[28px] border px-5 py-5 shadow-[0_26px_60px_-46px_rgba(15,23,42,0.26)] md:px-6 md:py-5",
      theme === "dark"
        ? "border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(109,61,245,0.18),transparent_32%),linear-gradient(180deg,#10182d_0%,#0d1424_100%)]"
        : "border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(109,61,245,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,255,0.95)_62%,rgba(235,255,245,0.7))]",
      className,
    )}
  >
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="space-y-2.5">
        {eyebrow ? (
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.24em]",
              theme === "dark" ? "text-violet-200" : "text-violet-700",
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-2">
          <h1
            className={cn(
              "text-[1.55rem] font-semibold tracking-tight md:text-[1.82rem]",
              theme === "dark" ? "text-white" : "text-slate-950",
              titleClassName,
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "max-w-3xl text-sm leading-6 md:text-[0.95rem]",
                theme === "dark" ? "text-slate-300" : "text-slate-600",
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="print-hidden flex flex-wrap items-center gap-2.5 md:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  </div>
);
