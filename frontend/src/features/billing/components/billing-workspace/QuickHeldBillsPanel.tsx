import { Link } from "react-router-dom";
import { EmptyState } from "../../../../components/ui/EmptyState";
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
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-[20px] border border-slate-100 bg-slate-50/50 p-4 h-32" />
          ))}
        </div>
      ) : heldBills.length ? (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
          {heldBills.map((bill) => (
            <article
              className="rounded-[20px] border border-slate-200 bg-slate-50 p-4"
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
                className="mt-4 inline-flex rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                to={`/app/billing?heldBillId=${bill.id}`}
              >
                Resume
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Held bills will appear here as soon as you park one from the POS."
          title="No held bills yet"
        />
      )}
    </SectionCard>
  );
};
