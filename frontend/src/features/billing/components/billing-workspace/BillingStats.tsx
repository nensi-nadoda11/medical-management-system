import { SummaryCard } from "../../../../components/ui/SummaryCard";
import { formatCurrency } from "../../../../lib/utils";

interface BillingStatsProps {
  grandTotal: number;
  itemCount: number;
  heldBillsCount: number;
  dueAmount: number;
}

export const BillingStats = ({
  grandTotal,
  itemCount,
  heldBillsCount,
  dueAmount,
}: BillingStatsProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        hint="Live estimate from the current cart"
        label="Grand total"
        value={formatCurrency(grandTotal)}
      />
      <SummaryCard
        hint="Stock-safe lines ready for this bill"
        label="Items in cart"
        tone={itemCount ? "accent" : "default"}
        value={itemCount}
      />
      <SummaryCard
        hint="Visible held bills ready to reopen"
        label="Held bills"
        tone={heldBillsCount ? "warning" : "default"}
        value={heldBillsCount}
      />
      <SummaryCard
        hint="Remaining collection after paid amount"
        label="Due amount"
        tone={dueAmount > 0 ? "warning" : "default"}
        value={formatCurrency(dueAmount)}
      />
    </div>
  );
};
