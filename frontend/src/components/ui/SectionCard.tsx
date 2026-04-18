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
  <section className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/60 md:p-4.5">
    <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-3.5 md:flex-row md:items-start md:justify-between">
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold text-slate-950 md:text-[1.02rem]">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-5 text-slate-600">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2.5">{action}</div> : null}
    </div>
    {children}
  </section>
);
