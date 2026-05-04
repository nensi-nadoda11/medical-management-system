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
  <section className="min-w-0 rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.92))] p-4 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.24)]">
    <div className="mb-3 space-y-1.5">
      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-700">
        {title}
      </h4>
      {description ? (
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      ) : null}
    </div>
    {children}
  </section>
);
