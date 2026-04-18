interface ReportExportButtonsProps {
  onExport: (format: "xlsx" | "pdf") => void;
  isLoading?: boolean;
}

export const ReportExportButtons = ({
  onExport,
  isLoading = false,
}: ReportExportButtonsProps) => (
  <div className="flex flex-wrap items-center gap-2">
    <button
      className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isLoading}
      onClick={() => onExport("xlsx")}
      type="button"
    >
      Export Excel
    </button>
    <button
      className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isLoading}
      onClick={() => onExport("pdf")}
      type="button"
    >
      Export PDF
    </button>
  </div>
);
