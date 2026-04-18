import type { PropsWithChildren } from "react";

interface FormSectionProps extends PropsWithChildren {
  title: string;
  description?: string;
}

export const FormSection = ({
  title,
  description,
  children,
}: FormSectionProps) => (
  <section className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
    <div className="mb-3 space-y-1">
      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">
        {title}
      </h4>
      {description ? (
        <p className="text-sm leading-5 text-slate-600">{description}</p>
      ) : null}
    </div>
    {children}
  </section>
);
