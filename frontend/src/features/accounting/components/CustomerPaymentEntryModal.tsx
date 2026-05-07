import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Modal } from "../../../components/ui/Modal";
import { formatCurrency, formatDate, toDateInputValue } from "../../../lib/utils";
import type {
  AccountingPaymentMethod,
  SaveCustomerAccountingPaymentPayload,
} from "../../../types/accounting";
import { customersQueryKeys, listCustomerOptions } from "../../customers/api/customers";
import { accountingQueryKeys, getCustomerDueSummary } from "../api/accounting";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

const paymentMethods: Array<{ value: AccountingPaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
];

interface CustomerPaymentEntryModalProps {
  open: boolean;
  isSubmitting: boolean;
  errorMessage?: string;
  preset?: {
    customerId: string;
    customerLabel: string;
    saleId?: string;
    saleLabel?: string;
    lockCustomer?: boolean;
    lockSale?: boolean;
  } | null;
  onClose: () => void;
  onSubmit: (payload: SaveCustomerAccountingPaymentPayload) => Promise<void>;
}

export const CustomerPaymentEntryModal = ({
  open,
  isSubmitting,
  errorMessage,
  preset,
  onClose,
  onSubmit,
}: CustomerPaymentEntryModalProps) => {
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [saleId, setSaleId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<AccountingPaymentMethod>("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentDate, setPaymentDate] = useState(toDateInputValue(new Date()));
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const customerOptionsQuery = useQuery({
    enabled: open,
    queryKey: customersQueryKeys.options(deferredSearch, 8),
    queryFn: () => listCustomerOptions(deferredSearch || undefined),
  });

  const dueSummaryQuery = useQuery({
    enabled: open && Boolean(customerId),
    queryKey: accountingQueryKeys.customerSummary(customerId),
    queryFn: () => getCustomerDueSummary(customerId),
  });

  const resetState = () => {
    setSearch("");
    setCustomerId(preset?.customerId ?? "");
    setSaleId(preset?.saleId ?? "");
    setAmount("");
    setPaymentMethod("cash");
    setReferenceNumber("");
    setPaymentDate(toDateInputValue(new Date()));
    setNotes("");
    setLocalError(null);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    resetState();
  }, [open, preset?.customerId, preset?.saleId]);

  const customerOptions = useMemo(() => {
    const items = customerOptionsQuery.data?.items ?? [];

    if (!preset?.customerId) {
      return items;
    }

    const exists = items.some((item) => item.id === preset.customerId);

    if (exists) {
      return items;
    }

    return [
      {
        id: preset.customerId,
        fullName: preset.customerLabel,
        customerCode: "",
        mobileNumber: "",
        city: null,
        status: "active" as const,
        totalDueAmount: "0.00",
        lastPurchaseDate: null,
      },
      ...items,
    ];
  }, [customerOptionsQuery.data?.items, preset?.customerId, preset?.customerLabel]);

  const selectedCustomer = useMemo(
    () => customerOptions.find((item) => item.id === customerId) ?? null,
    [customerId, customerOptions],
  );

  const selectedSale = dueSummaryQuery.data?.openSales.find((sale) => sale.id === saleId);
  const selectedSaleLabel =
    preset?.saleLabel ||
    (selectedSale
      ? `${selectedSale.billNumber} / Due ${formatCurrency(selectedSale.dueAmount)} / ${formatDate(selectedSale.billDate)}`
      : "");

  return (
    <Modal
      description="Record a bill-wise receipt or a general payment that can become customer advance when it exceeds current dues."
      footer={
        <>
          <button
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => {
              resetState();
              onClose();
            }}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            onClick={async () => {
              if (!customerId) {
                setLocalError("Select a customer first.");
                return;
              }

              if (!(Number(amount) > 0)) {
                setLocalError("Enter a valid payment amount.");
                return;
              }

              setLocalError(null);
              await onSubmit({
                customerId,
                saleId: saleId || undefined,
                amount: Number(amount),
                paymentMethod,
                referenceNumber: referenceNumber.trim() || null,
                paymentDate,
                notes: notes.trim() || null,
              });
              resetState();
            }}
            type="button"
          >
            {isSubmitting ? "Saving..." : "Record payment"}
          </button>
        </>
      }
      onClose={() => {
        resetState();
        onClose();
      }}
      open={open}
      panelClassName="max-w-4xl"
      title="Record customer payment"
    >
      <div className="grid gap-4">
        {preset?.lockCustomer ? (
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Customer
            <input className={inputClassName} readOnly value={preset.customerLabel} />
          </label>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Search customer
              <input
                className={inputClassName}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, code, or mobile"
                value={search}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Customer
              <select
                className={inputClassName}
                onChange={(event) => {
                  setCustomerId(event.target.value);
                  setSaleId("");
                }}
                value={customerId}
              >
                <option value="">Select customer</option>
                {customerOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fullName} / {item.customerCode || "No code"} / {item.mobileNumber || "No mobile"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {selectedCustomer && dueSummaryQuery.data ? (
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Outstanding", formatCurrency(dueSummaryQuery.data.summary.outstandingAmount)],
              ["Advance", formatCurrency(dueSummaryQuery.data.summary.advanceAmount)],
              ["Open bills", dueSummaryQuery.data.summary.openBillCount.toString()],
            ].map(([label, value]) => (
              <div
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                key={label}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {label}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {preset?.lockSale && preset?.saleId ? (
            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              Apply to bill
              <input
                className={inputClassName}
                readOnly
                value={selectedSaleLabel || "Selected bill"}
              />
            </label>
          ) : (
            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              Apply to bill
              <select
                className={inputClassName}
                disabled={!customerId}
                onChange={(event) => setSaleId(event.target.value)}
                value={saleId}
              >
                <option value="">General / auto allocation / advance</option>
                {dueSummaryQuery.data?.openSales.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    {sale.billNumber} / Due {formatCurrency(sale.dueAmount)} / {formatDate(sale.billDate)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Amount
            <input
              className={inputClassName}
              min="0"
              onChange={(event) => setAmount(event.target.value)}
              step="0.01"
              type="number"
              value={amount}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Payment method
            <select
              className={inputClassName}
              onChange={(event) =>
                setPaymentMethod(event.target.value as AccountingPaymentMethod)
              }
              value={paymentMethod}
            >
              {paymentMethods.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Reference number
            <input
              className={inputClassName}
              onChange={(event) => setReferenceNumber(event.target.value)}
              value={referenceNumber}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Payment date
            <input
              className={inputClassName}
              onChange={(event) => setPaymentDate(event.target.value)}
              type="date"
              value={paymentDate}
            />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Notes
          <textarea
            className={`${inputClassName} min-h-24 resize-none`}
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
        </label>

        {localError || errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {localError || errorMessage}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};
