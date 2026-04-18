import type { PropsWithChildren, ReactNode } from "react";

interface FilterBarProps extends PropsWithChildren {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export const FilterBar = ({
  title,
  description,
  actions,
  children,
}: FilterBarProps) => (
  <section className="rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-4 shadow-sm shadow-slate-200/60">
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-5 text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
    <div className="rounded-[20px] border border-slate-200 bg-white p-3.5 md:p-4">{children}</div>
  </section>
);
