import { EmptyState } from "../../../../components/ui/EmptyState";
import { SectionCard } from "../../../../components/ui/SectionCard";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import {
  formatDate,
  formatNumber,
  humanizeLabel,
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
}: MedicineSearchPanelProps) => {
  const handleAdd = async (medicine: BillingMedicineSearchItem) => {
    await onAddMedicine(medicine);
    playSuccessFeedback();
  };

  return (
    <SectionCard
      title="Medicine search"
      action={
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={isFefoEnabled}
            onChange={onToggleFefo}
            className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Auto FEFO
        </label>
      }
    >
      <div className="space-y-4">
        <input
          className={inputClassName}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search medicine, generic, or barcode"
          value={search}
        />

        {isLoading ? (
          <div className="grid gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-[20px] border border-slate-100 bg-slate-50/50 p-4 h-24" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3">
            {medicines.map((record) => (
              <button
                className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/50"
                key={record.medicine.id}
                onClick={() => handleAdd(record)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">
                      {record.medicine.medicineName}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {record.medicine.genericName} / {humanizeLabel(record.medicine.form)} / {humanizeLabel(record.medicine.unit)}
                    </p>
                  </div>
                  {record.medicine.prescriptionRequired ? (
                    <StatusBadge label="prescription required" tone="pending" />
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700">
                    Qty {formatNumber(record.availableQuantity)}
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700">
                    Batches {record.activeBatchCount}
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700">
                    Next expiry {formatDate(record.nextExpiryDate)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {!isLoading && !medicines.length ? (
          <EmptyState
            description="No sellable medicines match the current search. Try another term or review inventory."
            title="No medicines found"
          />
        ) : null}
      </div>
    </SectionCard>
  );
};
