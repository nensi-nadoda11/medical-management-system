import type { PropsWithChildren, ReactNode } from "react";

interface FilterBarProps extends PropsWithChildren {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export const FilterBar = ({
  title,
  description,
  actions,
  className,
  children,
}: FilterBarProps) => (
  <section
    className={`rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.94))] p-4 shadow-[0_24px_58px_-42px_rgba(15,23,42,0.3)] md:p-5 ${className ?? ""}`}
  >
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold text-slate-950 md:text-[1.02rem]">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
    <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] md:p-[1.125rem]">
      {children}
    </div>
  </section>
);
