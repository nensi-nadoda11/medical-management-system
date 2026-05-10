import type { ReportPeriodMode } from "../lib/report-period";
import { cn } from "../../../lib/utils";

const buttonClassName =
  "inline-flex min-h-[2.5rem] items-center justify-center rounded-full border px-3.5 py-2 text-sm font-semibold transition";

interface ReportPeriodControlProps {
  mode: ReportPeriodMode;
  selectedDate: string;
  selectedMonth: string;
  customDateFrom: string;
  customDateTo: string;
  onModeChange: (value: ReportPeriodMode) => void;
  onSelectedDateChange: (value: string) => void;
  onSelectedMonthChange: (value: string) => void;
  onCustomDateFromChange: (value: string) => void;
  onCustomDateToChange: (value: string) => void;
  inputClassName: string;
  wrapperClassName?: string;
}

export const ReportPeriodControl = ({
  mode,
  selectedDate,
  selectedMonth,
  customDateFrom,
  customDateTo,
  onModeChange,
  onSelectedDateChange,
  onSelectedMonthChange,
  onCustomDateFromChange,
  onCustomDateToChange,
  inputClassName,
  wrapperClassName,
}: ReportPeriodControlProps) => (
  <div className={cn("grid gap-3", wrapperClassName)}>
    <div className="flex flex-wrap gap-2">
      {[
        ["daily", "Daily"],
        ["monthly", "Monthly"],
        ["custom", "Custom"],
      ].map(([value, label]) => (
        <button
          className={cn(
            buttonClassName,
            mode === value
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
          )}
          key={value}
          onClick={() => onModeChange(value as ReportPeriodMode)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>

    {mode === "daily" ? (
      <label className="grid gap-2 text-sm font-medium text-slate-700 md:max-w-xs">
        Report date
        <input
          className={inputClassName}
          onChange={(event) => onSelectedDateChange(event.target.value)}
          type="date"
          value={selectedDate}
        />
      </label>
    ) : null}

    {mode === "monthly" ? (
      <label className="grid gap-2 text-sm font-medium text-slate-700 md:max-w-xs">
        Report month
        <input
          className={inputClassName}
          onChange={(event) => onSelectedMonthChange(event.target.value)}
          type="month"
          value={selectedMonth}
        />
      </label>
    ) : null}

    {mode === "custom" ? (
      <div className="grid gap-3 md:grid-cols-2 xl:max-w-[34rem]">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Date from
          <input
            className={inputClassName}
            onChange={(event) => onCustomDateFromChange(event.target.value)}
            type="date"
            value={customDateFrom}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Date to
          <input
            className={inputClassName}
            onChange={(event) => onCustomDateToChange(event.target.value)}
            type="date"
            value={customDateTo}
          />
        </label>
      </div>
    ) : null}
  </div>
);
