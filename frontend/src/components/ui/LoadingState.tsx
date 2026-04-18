interface LoadingStateProps {
  title?: string;
  description?: string;
}

export const LoadingState = ({
  title = "Loading workspace",
  description = "Please wait while we fetch the latest information.",
}: LoadingStateProps) => (
  <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm shadow-slate-200/60">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600" />
    </div>
    <h2 className="mt-5 text-lg font-semibold text-slate-950">{title}</h2>
    <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
  </div>
);
