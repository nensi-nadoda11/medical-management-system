import { PageHeader } from "../../../../components/ui/PageHeader";
import { BillingModuleNav } from "../../components/BillingModuleNav";

interface BillingHeaderProps {
  canCreateBills: boolean;
  validHeldBillId: string | null;
  onNewBill: () => void;
}

export const BillingHeader = ({
  canCreateBills,
  validHeldBillId,
  onNewBill,
}: BillingHeaderProps) => {
  return (
    <PageHeader
      actions={
        <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
          <BillingModuleNav canCreateBills={canCreateBills} />
          <button
            className="ui-btn ui-btn--primary !rounded-[6px]"
            onClick={onNewBill}
            type="button"
          >
            New bill
          </button>
        </div>
      }
      eyebrow="Billing / POS"
      title={validHeldBillId ? "Resume held bill" : "Point of sale"}
    />
  );
};
