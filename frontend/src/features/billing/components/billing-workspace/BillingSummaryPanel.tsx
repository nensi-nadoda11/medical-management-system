import { SectionCard } from "../../../../components/ui/SectionCard";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import {
  cn,
  formatCurrency,
  formatDate,
} from "../../../../lib/utils";
import type { BillingDraftState } from "../../hooks/useBillingWorkspace";
import type { CustomerOption } from "../../../../types/customer";

interface BillingSummaryPanelProps {
  draft: BillingDraftState;
  onDraftChange: (updater: (current: BillingDraftState) => BillingDraftState) => void;
  customerSearch: string;
  onCustomerSearchChange: (value: string) => void;
  customerOptions: CustomerOption[];
  onSelectCustomer: (customer: CustomerOption) => void;
  onQuickAddCustomer: () => void;
  totals: {
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    roundOff: number;
    grandTotal: number;
    paidAmount: number;
    availableAdvance: number;
    previewAdvanceApplied: number;
    effectivePaidAmount: number;
    newAdvanceAmount: number;
    dueAmount: number;
  };
  isSubmitting: boolean;
  validHeldBillId: string | null;
  onSaveHeld: () => Promise<void>;
  onFinalize: () => Promise<void>;
}

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

export const BillingSummaryPanel = ({
  draft,
  onDraftChange,
  customerSearch,
  onCustomerSearchChange,
  customerOptions,
  onSelectCustomer,
  onQuickAddCustomer,
  totals,
  isSubmitting,
  validHeldBillId,
  onSaveHeld,
  onFinalize,
}: BillingSummaryPanelProps) => {
  return (
    <SectionCard
      title="Bill summary"
    >
      <div className="space-y-4">
        <div className="grid gap-3">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Customer selection
                </p>
              </div>
              <button
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                onClick={onQuickAddCustomer}
                type="button"
              >
                Quick add
              </button>
            </div>

            {draft.selectedCustomer ? (
              <div className="mt-4 rounded-[20px] border border-teal-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-950">
                        {draft.selectedCustomer.fullName}
                      </h3>
                      {draft.selectedCustomer.customerCode ? (
                        <StatusBadge label={draft.selectedCustomer.customerCode} tone="default" />
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {draft.selectedCustomer.mobileNumber}
                      {draft.selectedCustomer.city
                        ? ` • ${draft.selectedCustomer.city}`
                        : ""}
                    </p>
                  </div>
                  <button
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    onClick={() =>
                      onDraftChange((current) => ({
                        ...current,
                        selectedCustomer: null,
                        customerName: "",
                        customerPhone: "",
                      }))
                    }
                    type="button"
                  >
                    Use walk-in instead
                  </button>
                </div>

                <div className="mt-4 grid gap-3 2xl:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Outstanding due
                    </p>
                    <p className="mt-1 text-sm font-semibold text-amber-700">
                      {formatCurrency(draft.selectedCustomer.totalDueAmount ?? "0.00")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Available advance
                    </p>
                    <p className="mt-1 text-sm font-semibold text-emerald-700">
                      {formatCurrency(totals.availableAdvance)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Last purchase
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatDate(draft.selectedCustomer.lastPurchaseDate)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Search customer
                  <input
                    className={inputClassName}
                    onChange={(event) => onCustomerSearchChange(event.target.value)}
                    placeholder="Search by name, code, or mobile"
                    value={customerSearch}
                  />
                </label>

                {customerOptions.length ? (
                  <div className="grid gap-2">
                    {customerOptions.map((customer) => (
                      <button
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-teal-300 hover:bg-teal-50/40"
                        key={customer.id}
                        onClick={() => onSelectCustomer(customer)}
                        type="button"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              {customer.fullName}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {customer.customerCode} • {customer.mobileNumber}
                            </p>
                          </div>
                          <div className="text-xs text-slate-500 sm:text-right">
                            <p>Due {formatCurrency(customer.totalDueAmount)}</p>
                            <p>{formatDate(customer.lastPurchaseDate)}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-3">
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Walk-in customer name
                    <input
                      className={inputClassName}
                      onChange={(event) =>
                        onDraftChange((current) => ({
                          ...current,
                          customerName: event.target.value,
                        }))
                      }
                      placeholder="Optional walk-in customer"
                      value={draft.customerName}
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Walk-in customer phone
                    <input
                      className={inputClassName}
                      onChange={(event) =>
                        onDraftChange((current) => ({
                          ...current,
                          customerPhone: event.target.value,
                        }))
                      }
                      placeholder="Optional mobile number"
                      value={draft.customerPhone}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Payment method
            <select
              className={inputClassName}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  paymentMethod: event.target.value as typeof current.paymentMethod,
                }))
              }
              value={draft.paymentMethod}
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="split">Split</option>
            </select>
          </label>

          <div className="grid gap-3 2xl:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Paid amount
              <input
                className={inputClassName}
                min={0}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    paidAmount: event.target.value,
                  }))
                }
                step="0.01"
                type="number"
                value={draft.paidAmount}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Round off
              <input
                className={inputClassName}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    roundOffAmount: event.target.value,
                  }))
                }
                step="0.01"
                type="number"
                value={draft.roundOffAmount}
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Notes
            <textarea
              className="min-h-24 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Optional billing notes"
              value={draft.notes}
            />
          </label>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
          <div className="space-y-3 text-sm text-slate-700">
            {[
              ["Subtotal", formatCurrency(totals.subtotal)],
              ["Discount", formatCurrency(totals.discountAmount)],
              ["Tax", formatCurrency(totals.taxAmount)],
              ["Round off", formatCurrency(totals.roundOff)],
            ].map(([label, value]) => (
              <div className="flex items-center justify-between" key={label}>
                <span>{label}</span>
                <span className="font-semibold text-slate-950">{value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-950">
              <span>Grand total</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
            {draft.selectedCustomer ? (
              <div className="flex items-center justify-between">
                <span>Advance used</span>
                <span className="font-semibold text-emerald-700">
                  {formatCurrency(totals.previewAdvanceApplied)}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span>Paid entered</span>
              <span className="font-semibold text-slate-950">
                {formatCurrency(totals.paidAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Effective paid</span>
              <span className="font-semibold text-slate-950">
                {formatCurrency(totals.effectivePaidAmount)}
              </span>
            </div>
            {totals.newAdvanceAmount > 0 ? (
              <div className="flex items-center justify-between">
                <span>New advance</span>
                <span className="font-semibold text-emerald-700">
                  {formatCurrency(totals.newAdvanceAmount)}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span>Due</span>
              <span
                className={cn(
                  "font-semibold",
                  totals.dueAmount > 0 ? "text-amber-700" : "text-emerald-700",
                )}
              >
                {formatCurrency(totals.dueAmount)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <button
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting || !draft.items.length}
            onClick={onSaveHeld}
            type="button"
          >
            {isSubmitting ? "Saving..." : validHeldBillId ? "Update held bill" : "Hold bill"}
          </button>
          <button
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting || !draft.items.length}
            onClick={onFinalize}
            type="button"
          >
            {isSubmitting ? "Completing..." : validHeldBillId ? "Update and complete" : "Complete bill"}
          </button>
        </div>
      </div>
    </SectionCard>
  );
};
