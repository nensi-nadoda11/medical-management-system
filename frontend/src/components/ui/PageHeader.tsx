import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export const PageHeader = ({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) => (
  <div className="relative overflow-hidden rounded-[30px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94)_58%,rgba(236,253,250,0.72))] px-5 py-5 shadow-[0_30px_70px_-46px_rgba(15,23,42,0.45)] md:px-6 md:py-6">
    <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(15,23,42,0.12),transparent)]" />
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="space-y-2.5">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-2">
          <h1 className="text-[1.55rem] font-semibold tracking-tight text-slate-950 md:text-[1.85rem]">
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-[0.96rem]">
            {description}
          </p>
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
