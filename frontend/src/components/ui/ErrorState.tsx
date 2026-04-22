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
  <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[28px] border border-rose-200 bg-[linear-gradient(180deg,rgba(255,247,248,0.98),rgba(255,242,244,0.96))] px-6 py-12 text-center shadow-[0_26px_58px_-44px_rgba(190,24,93,0.28)]">
    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 shadow-sm">
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
        className="ui-btn ui-btn--primary mt-5"
        onClick={onRetry}
        type="button"
      >
        {actionLabel}
      </button>
    ) : null}
  </div>
);
