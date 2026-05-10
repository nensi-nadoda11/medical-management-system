import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "../../lib/utils";

interface FilterBarProps extends PropsWithChildren {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  theme?: "light" | "dark";
}

export const FilterBar = ({
  title,
  description,
  actions,
  className,
  contentClassName,
  theme = "light",
  children,
}: FilterBarProps) => (
  <section
    className={cn(
      "rounded-[26px] border p-4 shadow-[0_22px_52px_-42px_rgba(15,23,42,0.22)] md:p-5",
      theme === "dark"
        ? "border-white/10 bg-[linear-gradient(180deg,rgba(16,24,45,0.98),rgba(11,17,31,0.98))]"
        : "border-white/75 bg-[linear-gradient(180deg,rgba(248,250,255,0.96),rgba(255,255,255,0.98))]",
      className,
    )}
  >
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="space-y-1.5">
        <h2
          className={cn(
            "text-base font-semibold md:text-[1.02rem]",
            theme === "dark" ? "text-white" : "text-slate-950",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              "max-w-2xl text-sm leading-6",
              theme === "dark" ? "text-slate-300" : "text-slate-600",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
    <div
      className={cn(
        "rounded-[22px] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] md:p-4",
        theme === "dark"
          ? "border-white/10 bg-white/[0.03]"
          : "border-slate-200/75 bg-white/92",
        contentClassName,
      )}
    >
      {children}
    </div>
  </section>
);
