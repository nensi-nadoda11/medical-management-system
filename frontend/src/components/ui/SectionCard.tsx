import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "../../lib/utils";

interface SectionCardProps extends PropsWithChildren {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export const SectionCard = ({
  title,
  description,
  action,
  className,
  contentClassName,
  children,
}: SectionCardProps) => (
  <section className={cn("flex flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-4 shadow-[0_26px_60px_-42px_rgba(15,23,42,0.35)] md:p-5", className)}>
    <div className="mb-4 flex shrink-0 flex-col gap-3 border-b border-slate-200/70 pb-4 md:flex-row md:items-start md:justify-between">
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold text-slate-950 md:text-[1.08rem]">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
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
