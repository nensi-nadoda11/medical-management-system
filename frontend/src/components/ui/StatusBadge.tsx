import { cn } from "../../lib/utils";

const toneMap: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  inactive: "bg-slate-100 text-slate-600 ring-slate-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  accepted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  revoked: "bg-rose-50 text-rose-700 ring-rose-200",
  expired: "bg-slate-100 text-slate-600 ring-slate-200",
  admin: "bg-sky-50 text-sky-700 ring-sky-200",
  staff: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  accountant: "bg-violet-50 text-violet-700 ring-violet-200",
  suspended: "bg-rose-50 text-rose-700 ring-rose-200",
};

interface StatusBadgeProps {
  label: string;
  tone?: string;
}

export const StatusBadge = ({ label, tone = label.toLowerCase() }: StatusBadgeProps) => (
  <span
    className={cn(
      "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset",
      toneMap[tone] ?? "bg-slate-100 text-slate-700 ring-slate-200",
    )}
  >
    {label}
  </span>
);
