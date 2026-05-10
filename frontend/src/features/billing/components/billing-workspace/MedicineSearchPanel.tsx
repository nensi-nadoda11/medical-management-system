import { SectionCard } from "../../../../components/ui/SectionCard";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import {
  formatDate,
  formatNumber,
} from "../../../../lib/utils";
import { playSuccessFeedback } from "../../../../lib/feedback";
import type { BillingMedicineSearchItem } from "../../../../types/billing";

interface MedicineSearchPanelProps {
  search: string;
  onSearchChange: (value: string) => void;
  isLoading: boolean;
  medicines: BillingMedicineSearchItem[];
  onAddMedicine: (medicine: BillingMedicineSearchItem) => Promise<void>;
  isFefoEnabled: boolean;
  onToggleFefo: () => void;
  embedded?: boolean;
}

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

export const MedicineSearchPanel = ({
  search,
  onSearchChange,
  isLoading,
  medicines,
  onAddMedicine,
  isFefoEnabled,
  onToggleFefo,
  embedded = false,
}: MedicineSearchPanelProps) => {
  const handleAdd = async (medicine: BillingMedicineSearchItem) => {
    await onAddMedicine(medicine);
    playSuccessFeedback();
  };

  const content = (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-3">
        <h2 className="text-base font-semibold text-slate-950">Medicine search</h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={isFefoEnabled}
            onChange={onToggleFefo}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Auto FEFO
        </label>
      </div>

      <input
        className={inputClassName}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search medicine, generic, or barcode"
        value={search}
      />

      {isLoading ? (
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto pr-1 ui-subtle-scrollbar">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-[16px] border border-slate-100 bg-slate-50/50 p-3" />
          ))}
        </div>
      ) : medicines.length ? (
        <div className="grid min-h-0 flex-1 gap-2.5 overflow-y-auto pr-1 ui-subtle-scrollbar">
          {medicines.map((record) => (
            <article
              className="rounded-[16px] border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-teal-300 hover:bg-teal-50/50"
              key={record.medicine.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-950">
                    {record.medicine.medicineName}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                    <span className="rounded-full bg-white px-2 py-1 font-semibold text-slate-700">
                      Qty {formatNumber(record.availableQuantity)}
                    </span>
                    <span className="rounded-full bg-white px-2 py-1 font-semibold text-slate-700">
                      Batches {record.activeBatchCount}
                    </span>
                    <span className="rounded-full bg-white px-2 py-1 font-semibold text-slate-700">
                      Next expiry {formatDate(record.nextExpiryDate)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {record.medicine.prescriptionRequired ? (
                    <StatusBadge label="prescription required" tone="pending" />
                  ) : null}
                  <button
                    className="ui-btn ui-btn--primary !min-h-[2rem] !rounded-[6px] !px-3 !text-xs"
                    onClick={() => handleAdd(record)}
                    type="button"
                  >
                    Add to cart
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[18px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,251,0.96))] px-5 py-6 text-center shadow-[0_18px_40px_-40px_rgba(15,23,42,0.22)]">
          <h3 className="text-sm font-semibold text-slate-900">No medicines found</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            No sellable medicines match the current search. Try another term or review inventory.
          </p>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return <SectionCard title="Medicine search">{content}</SectionCard>;
};
