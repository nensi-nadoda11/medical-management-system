import { EmptyState } from "../../../../components/ui/EmptyState";
import { SectionCard } from "../../../../components/ui/SectionCard";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  humanizeLabel,
} from "../../../../lib/utils";
import type { BillingEditorItem } from "../../hooks/useBillingWorkspace";

interface BillingCartPanelProps {
  items: BillingEditorItem[];
  onUpdateItem: (itemId: string, updater: (item: BillingEditorItem) => BillingEditorItem) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
}

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

export const BillingCartPanel = ({
  items,
  onUpdateItem,
  onRemoveItem,
  onClearCart,
}: BillingCartPanelProps) => {
  return (
    <SectionCard
      title="Bill cart"
      action={
        items.length ? (
          <button
            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={onClearCart}
            type="button"
          >
            Clear cart
          </button>
        ) : null
      }
    >
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => {
            const selectedBatch = item.batchOptions.find((batch) => batch.id === item.selectedBatchId) ?? item.batchOptions[0];
            const maxQuantity = selectedBatch?.quantityAvailable ?? item.quantity;
            const rate = Number(selectedBatch?.saleRate ?? 0);
            const lineGross = rate * item.quantity;
            const lineDiscount = (lineGross * item.discountPercent) / 100;
            const lineSubtotal = lineGross - lineDiscount;
            const lineTax = (lineSubtotal * Number(selectedBatch?.gstPercent ?? 0)) / 100;
            const lineTotal = lineSubtotal + lineTax;

            return (
              <article
                className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                key={item.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">
                      {item.medicineName}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.genericName} / {humanizeLabel(item.form)} / {humanizeLabel(item.unit)}
                    </p>
                  </div>
                  <button
                    className="rounded-2xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                    onClick={() => onRemoveItem(item.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Batch
                    <select
                      className={inputClassName}
                      onChange={(event) =>
                        onUpdateItem(item.id, (current) => {
                          const nextBatch = current.batchOptions.find(
                            (batch) => batch.id === event.target.value,
                          );
                          const nextMax = nextBatch?.quantityAvailable ?? current.quantity;

                          return {
                            ...current,
                            selectedBatchId: event.target.value,
                            quantity: Math.min(current.quantity, nextMax),
                          };
                        })
                      }
                      value={item.selectedBatchId}
                    >
                      {item.batchOptions.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.batchNumber} / Qty {batch.quantityAvailable} / Exp{" "}
                          {formatDate(batch.expiryDate)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      Qty
                      <input
                        className={inputClassName}
                        max={maxQuantity}
                        min={1}
                        onChange={(event) =>
                          onUpdateItem(item.id, (current) => ({
                            ...current,
                            quantity: Math.max(
                              1,
                              Math.min(Number(event.target.value || 1), maxQuantity),
                            ),
                          }))
                        }
                        type="number"
                        value={item.quantity}
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      Discount %
                      <input
                        className={inputClassName}
                        max={100}
                        min={0}
                        onChange={(event) =>
                          onUpdateItem(item.id, (current) => ({
                            ...current,
                            discountPercent: Math.max(
                              0,
                              Math.min(Number(event.target.value || 0), 100),
                            ),
                          }))
                        }
                        step="0.01"
                        type="number"
                        value={item.discountPercent}
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  {[
                    ["Rate", formatCurrency(selectedBatch?.saleRate)],
                    ["GST", `${selectedBatch?.gstPercent ?? 0}%`],
                    ["Stock", formatNumber(selectedBatch?.quantityAvailable ?? 0)],
                    ["Line total", formatCurrency(lineTotal)],
                  ].map(([label, value]) => (
                    <div
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                      key={label}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {label}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                {selectedBatch?.isNearExpiry ? (
                  <p className="mt-3 text-xs font-medium text-amber-700">
                    Near expiry batch selected for faster FEFO billing.
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          description="Search medicines on the left and start building the bill."
          title="Your bill is empty"
        />
      )}
    </SectionCard>
  );
};
