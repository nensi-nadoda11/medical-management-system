interface LoadingStateProps {
  title?: string;
  description?: string;
}

export const LoadingState = ({
  title = "Loading workspace",
  description = "Please wait while we fetch the latest information.",
}: LoadingStateProps) => (
  <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] px-6 py-12 text-center shadow-[0_28px_62px_-46px_rgba(15,23,42,0.38)]">
    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
    </div>
    <h2 className="mt-5 text-lg font-semibold text-slate-950">{title}</h2>
    <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
  </div>
);
