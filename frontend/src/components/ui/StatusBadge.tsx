import { cn, humanizeLabel } from "../../lib/utils";

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
  draft: "bg-sky-50 text-sky-700 ring-sky-200",
  finalized: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
  processed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  not_required: "bg-slate-100 text-slate-700 ring-slate-200",
  adjustment: "bg-sky-50 text-sky-700 ring-sky-200",
  cash: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  upi: "bg-sky-50 text-sky-700 ring-sky-200",
  card: "bg-violet-50 text-violet-700 ring-violet-200",
  bank_transfer: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  cheque: "bg-amber-50 text-amber-700 ring-amber-200",
  unpaid: "bg-slate-100 text-slate-700 ring-slate-200",
  partial: "bg-amber-50 text-amber-700 ring-amber-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  opening_balance: "bg-slate-100 text-slate-700 ring-slate-200",
  sale: "bg-rose-50 text-rose-700 ring-rose-200",
  sale_return: "bg-sky-50 text-sky-700 ring-sky-200",
  payment_received: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  purchase: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  purchase_return: "bg-amber-50 text-amber-700 ring-amber-200",
  payment_made: "bg-slate-100 text-slate-700 ring-slate-200",
  low_stock: "bg-rose-50 text-rose-700 ring-rose-200",
  expired_stock: "bg-rose-50 text-rose-700 ring-rose-200",
  customer_due: "bg-amber-50 text-amber-700 ring-amber-200",
  supplier_payable: "bg-sky-50 text-sky-700 ring-sky-200",
  system_alert: "bg-slate-100 text-slate-700 ring-slate-200",
  safe: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  near_expiry: "bg-amber-50 text-amber-700 ring-amber-200",
  next_30_days: "bg-amber-50 text-amber-700 ring-amber-200",
  next_60_days: "bg-amber-50 text-amber-700 ring-amber-200",
  next_90_days: "bg-amber-50 text-amber-700 ring-amber-200",
  purchase_in: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  purchase_return_out: "bg-amber-50 text-amber-700 ring-amber-200",
  sale_out: "bg-rose-50 text-rose-700 ring-rose-200",
  sales_return_in: "bg-sky-50 text-sky-700 ring-sky-200",
  adjustment_in: "bg-sky-50 text-sky-700 ring-sky-200",
  adjustment_out: "bg-amber-50 text-amber-700 ring-amber-200",
  held: "bg-amber-50 text-amber-700 ring-amber-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  returnable: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  not_returnable: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-slate-100 text-slate-700 ring-slate-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  critical: "bg-rose-50 text-rose-700 ring-rose-200",
};

interface StatusBadgeProps {
  label: string;
  tone?: string;
}

export const StatusBadge = ({ label, tone = label.toLowerCase() }: StatusBadgeProps) => (
  <span
    className={cn(
      "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
      toneMap[tone] ?? "bg-slate-100 text-slate-700 ring-slate-200",
    )}
  >
    {humanizeLabel(label)}
  </span>
);
