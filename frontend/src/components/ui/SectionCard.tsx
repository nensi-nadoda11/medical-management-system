import type { PropsWithChildren, ReactNode } from "react";

interface SectionCardProps extends PropsWithChildren {
  title: string;
  description?: string;
  action?: ReactNode;
}

export const SectionCard = ({
  title,
  description,
  action,
  children,
}: SectionCardProps) => (
  <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/60">
    <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-3">{action}</div> : null}
    </div>
    {children}
  </section>
);
