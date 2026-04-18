import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export const EmptyState = ({ title, description, action }: EmptyStateProps) => (
  <div className="rounded-[24px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,#fbfcfd_0%,#f6f9fb_100%)] px-6 py-12 text-center">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm shadow-slate-200/80">
      <span className="text-lg font-semibold text-slate-500">i</span>
    </div>
    <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
    {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
  </div>
);
