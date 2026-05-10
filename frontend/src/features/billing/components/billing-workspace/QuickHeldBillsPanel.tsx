import { Link } from "react-router-dom";
import { SectionCard } from "../../../../components/ui/SectionCard";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { formatCurrency, formatDate } from "../../../../lib/utils";
import type { BillListItem } from "../../api/billing";

interface QuickHeldBillsPanelProps {
  heldBills: BillListItem[];
  isLoading: boolean;
}

export const QuickHeldBillsPanel = ({
  heldBills,
  isLoading,
}: QuickHeldBillsPanelProps) => {
  return (
    <SectionCard
      description="Recent held bills stay close to the POS so billing can resume with minimal clicks."
      title="Quick held bills"
    >
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-[16px] border border-slate-100 bg-slate-50/50 p-3.5" />
          ))}
        </div>
      ) : heldBills.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {heldBills.map((bill) => (
            <article
              className="rounded-[16px] border border-slate-200 bg-slate-50 p-3.5"
              key={bill.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{bill.billNumber}</p>
                  <p className="mt-1 text-sm text-slate-600">{bill.customerLabel}</p>
                </div>
                <StatusBadge label={bill.paymentStatus} />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-950">
                {formatCurrency(bill.grandTotal)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Created {formatDate(bill.createdAt)}
              </p>
              <Link
                className="mt-3 inline-flex rounded-[6px] border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                to={`/app/billing?heldBillId=${bill.id}`}
              >
                Resume
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[18px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,251,0.96))] px-5 py-7 text-center shadow-[0_18px_40px_-40px_rgba(15,23,42,0.18)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm shadow-slate-200/80">
            <span className="text-base font-semibold text-slate-500">i</span>
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900">No held bills yet</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
            Held bills will appear here as soon as you park one from the POS.
          </p>
        </div>
      )}
    </SectionCard>
  );
};
