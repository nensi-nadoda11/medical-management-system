import {
  BadgeIndianRupee,
  PauseCircle,
  ShoppingBag,
  WalletCards,
} from "lucide-react";
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
        label="Grand total"
        icon={<WalletCards className="h-5 w-5" />}
        value={formatCurrency(grandTotal)}
      />
      <SummaryCard
        label="Items in cart"
        icon={<ShoppingBag className="h-5 w-5" />}
        tone={itemCount ? "accent" : "default"}
        value={itemCount}
      />
      <SummaryCard
        label="Held bills"
        icon={<PauseCircle className="h-5 w-5" />}
        tone={heldBillsCount ? "warning" : "default"}
        value={heldBillsCount}
      />
      <SummaryCard
        label="Due amount"
        icon={<BadgeIndianRupee className="h-5 w-5" />}
        tone={dueAmount > 0 ? "warning" : "default"}
        value={formatCurrency(dueAmount)}
      />
    </div>
  );
};
