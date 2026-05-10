import { SectionCard } from "../../../../components/ui/SectionCard";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "../../../../lib/utils";
import type { BillingEditorItem } from "../../hooks/useBillingWorkspace";

interface BillingCartPanelProps {
  items: BillingEditorItem[];
  onUpdateItem: (itemId: string, updater: (item: BillingEditorItem) => BillingEditorItem) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  embedded?: boolean;
}

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

export const BillingCartPanel = ({
  items,
  onUpdateItem,
  onRemoveItem,
  onClearCart,
  embedded = false,
}: BillingCartPanelProps) => {
  const content = (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-3">
        <h2 className="text-base font-semibold text-slate-950">Bill cart</h2>
        {items.length ? (
          <button
            className="rounded-[6px] border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            onClick={onClearCart}
            type="button"
          >
            Clear cart
          </button>
        ) : null}
      </div>

      {items.length ? (
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1 ui-subtle-scrollbar">
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
                className="rounded-[16px] border border-slate-200 bg-slate-50 p-3"
                key={item.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">
                      {item.medicineName}
                    </h3>
                  </div>
                  <button
                    className="rounded-[6px] border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                    onClick={() => onRemoveItem(item.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_6.5rem_8rem]">
                  <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
                    Batch
                    <select
                      className={`${inputClassName} min-w-0`}
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

                  <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
                    Qty
                    <input
                      className={`${inputClassName} min-w-0`}
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

                  <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
                    Discount %
                    <input
                      className={`${inputClassName} min-w-0`}
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

                <div className="mt-3 grid gap-2 grid-cols-2 sm:grid-cols-4">
                  {[
                    ["Rate", formatCurrency(selectedBatch?.saleRate)],
                    ["GST", `${selectedBatch?.gstPercent ?? 0}%`],
                    ["Stock", formatNumber(selectedBatch?.quantityAvailable ?? 0)],
                    ["Line total", formatCurrency(lineTotal)],
                  ].map(([label, value]) => (
                    <div
                      className="rounded-[12px] border border-slate-200 bg-white px-2.5 py-2"
                      key={label}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {label}
                      </p>
                      <p className="mt-1 text-[0.95rem] font-semibold text-slate-950">
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
        <div className="rounded-[18px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,251,0.96))] px-5 py-6 text-center shadow-[0_18px_40px_-40px_rgba(15,23,42,0.22)]">
          <h3 className="text-base font-semibold text-slate-900">Your bill is empty</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Search medicines above and add them to the cart.
          </p>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return <SectionCard title="Bill cart">{content}</SectionCard>;
};
