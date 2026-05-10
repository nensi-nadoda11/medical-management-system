import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "../../lib/utils";

interface SectionCardProps extends PropsWithChildren {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
  theme?: "light" | "dark";
}

export const SectionCard = ({
  title,
  description,
  action,
  className,
  contentClassName,
  theme = "light",
  children,
}: SectionCardProps) => (
  <section
    className={cn(
      "flex flex-col overflow-hidden rounded-[26px] border p-4 shadow-[0_24px_54px_-42px_rgba(15,23,42,0.24)] md:p-5",
      theme === "dark"
        ? "border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(109,61,245,0.12),transparent_30%),linear-gradient(180deg,#10182d_0%,#0d1424_100%)]"
        : "border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,255,0.94))]",
      className,
    )}
  >
    <div
      className={cn(
        "mb-4 flex shrink-0 flex-col gap-3 pb-4 md:flex-row md:items-start md:justify-between",
        theme === "dark" ? "border-b border-white/10" : "border-b border-slate-200/70",
      )}
    >
      <div className="space-y-1.5">
        <h2
          className={cn(
            "text-base font-semibold md:text-[1.04rem]",
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
      {action ? <div className="flex shrink-0 items-center gap-2.5">{action}</div> : null}
    </div>
    <div className={cn("flex-1", contentClassName)}>
      {children}
    </div>
  </section>
);
