interface LoadingStateProps {
  title?: string;
  description?: string;
}

export const LoadingState = ({
  title = "Loading workspace",
  description = "Please wait while we fetch the latest information.",
}: LoadingStateProps) => (
  <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm shadow-slate-200/60">
    <div className="h-12 w-12 animate-pulse rounded-full bg-gradient-to-br from-teal-500 to-cyan-700" />
    <h2 className="mt-5 text-lg font-semibold text-slate-950">{title}</h2>
    <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
  </div>
);
