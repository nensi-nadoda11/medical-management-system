import type { ReactNode } from "react";

interface ErrorStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onRetry?: () => void;
  action?: ReactNode;
}

export const ErrorState = ({
  title,
  description,
  actionLabel = "Retry",
  onRetry,
  action,
}: ErrorStateProps) => (
  <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[24px] border border-rose-200 bg-[linear-gradient(180deg,#fff7f8_0%,#fff2f4_100%)] px-6 py-12 text-center shadow-sm shadow-rose-200/60">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 shadow-sm">
      <span className="text-xl font-semibold">!</span>
    </div>
    <h2 className="mt-5 text-lg font-semibold text-slate-950">{title}</h2>
    <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
      {description}
    </p>
    {action ? (
      <div className="mt-5">{action}</div>
    ) : onRetry ? (
      <button
        className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        onClick={onRetry}
        type="button"
      >
        {actionLabel}
      </button>
    ) : null}
  </div>
);
