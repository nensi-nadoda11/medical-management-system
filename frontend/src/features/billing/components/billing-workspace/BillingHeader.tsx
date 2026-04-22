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
        <>
          <BillingModuleNav canCreateBills={canCreateBills} />
          <button
            className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={onNewBill}
            type="button"
          >
            New bill
          </button>
        </>
      }
      description="Fast medicine billing with batch visibility, hold-and-resume support, payment capture, and stock-safe completion."
      eyebrow="Billing / POS"
      title={validHeldBillId ? "Resume held bill" : "Point of sale"}
    />
  );
};
