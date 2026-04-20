import { useId } from "react";

import { cn, formatCurrency, formatNumber } from "../../../lib/utils";

export interface TrendPoint {
  label: string;
  value: number;
}

interface TrendChartProps {
  points: TrendPoint[];
  emptyLabel?: string;
  color?: "teal" | "amber";
  valueFormat?: "currency" | "number";
}

const WIDTH = 320;
const HEIGHT = 144;
const PADDING = 16;

export const TrendChart = ({
  points,
  emptyLabel = "No trend data available for this period.",
  color = "teal",
  valueFormat = "currency",
}: TrendChartProps) => {
  const gradientId = useId();

  if (!points.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const stepX =
    points.length > 1 ? (WIDTH - PADDING * 2) / (points.length - 1) : 0;

  const coordinates = points.map((point, index) => ({
    ...point,
    x: PADDING + index * stepX,
    y:
      HEIGHT -
      PADDING -
      ((point.value - minimum) / range) * (HEIGHT - PADDING * 2),
  }));
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1]!.x} ${HEIGHT - PADDING} L ${coordinates[0]!.x} ${HEIGHT - PADDING} Z`;
  const latest = values[values.length - 1] ?? 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const formatValue = (value: number) =>
    valueFormat === "currency" ? formatCurrency(value) : formatNumber(value);
  const markerIndexes = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]))
    .filter((index) => index >= 0 && index < points.length);

  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Latest
          </p>
          <p className="mt-1 text-base font-semibold text-slate-950">
            {formatValue(latest)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Average
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            {formatValue(average)}
          </p>
        </div>
      </div>

      <svg
        className="mt-4 h-40 w-full overflow-visible"
        preserveAspectRatio="none"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop
              offset="0%"
              stopColor={color === "teal" ? "#0f766e" : "#d97706"}
              stopOpacity="0.24"
            />
            <stop
              offset="100%"
              stopColor={color === "teal" ? "#0f766e" : "#d97706"}
              stopOpacity="0.02"
            />
          </linearGradient>
        </defs>

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color === "teal" ? "#0f766e" : "#d97706"}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />

        {coordinates.map((point) => (
          <circle
            cx={point.x}
            cy={point.y}
            fill="#ffffff"
            key={`${point.label}-${point.x}`}
            r="3.5"
            stroke={color === "teal" ? "#0f766e" : "#d97706"}
            strokeWidth="2"
          />
        ))}
      </svg>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
        {markerIndexes.map((index) => (
          <span
            className={cn(index === markerIndexes[markerIndexes.length - 1] ? "text-right" : "")}
            key={`${points[index]!.label}-${index}`}
          >
            {points[index]!.label}
          </span>
        ))}
      </div>
    </div>
  );
};
