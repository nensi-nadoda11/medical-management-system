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
  <div className="flex flex-col gap-4 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,252,0.92))] px-4 py-4 shadow-sm shadow-slate-200/60 md:px-5 md:py-4.5 md:flex-row md:items-start md:justify-between">
    <div className="space-y-2">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-700">
          {eyebrow}
        </p>
      ) : null}
      <div className="space-y-1.5">
        <h1 className="text-[1.45rem] font-semibold tracking-tight text-slate-950 md:text-[1.6rem]">
          {title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
    {actions ? (
      <div className="flex flex-wrap items-center gap-2.5 md:justify-end">{actions}</div>
    ) : null}
  </div>
);
