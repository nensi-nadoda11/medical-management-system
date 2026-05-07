import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Modal } from "../../../components/ui/Modal";
import { formatCurrency, formatDate, toDateInputValue } from "../../../lib/utils";
import type {
  AccountingPaymentMethod,
  SaveSupplierAccountingPaymentPayload,
} from "../../../types/accounting";
import {
  accountingQueryKeys,
  getSupplierDueSummary,
  listAccountingSupplierOptions,
} from "../api/accounting";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

const paymentMethods: Array<{ value: AccountingPaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
];

interface SupplierPaymentEntryModalProps {
  open: boolean;
  isSubmitting: boolean;
  errorMessage?: string;
  preset?: {
    supplierId: string;
    supplierLabel: string;
    purchaseId?: string;
    purchaseLabel?: string;
    lockSupplier?: boolean;
    lockPurchase?: boolean;
  } | null;
  onClose: () => void;
  onSubmit: (payload: SaveSupplierAccountingPaymentPayload) => Promise<void>;
}

export const SupplierPaymentEntryModal = ({
  open,
  isSubmitting,
  errorMessage,
  preset,
  onClose,
  onSubmit,
}: SupplierPaymentEntryModalProps) => {
  const [search, setSearch] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [purchaseId, setPurchaseId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<AccountingPaymentMethod>("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentDate, setPaymentDate] = useState(toDateInputValue(new Date()));
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const supplierOptionsQuery = useQuery({
    enabled: open,
    queryKey: accountingQueryKeys.supplierOptions(deferredSearch, 8),
    queryFn: () => listAccountingSupplierOptions(deferredSearch || undefined),
  });

  const dueSummaryQuery = useQuery({
    enabled: open && Boolean(supplierId),
    queryKey: accountingQueryKeys.supplierSummary(supplierId),
    queryFn: () => getSupplierDueSummary(supplierId),
  });

  const resetState = () => {
    setSearch("");
    setSupplierId(preset?.supplierId ?? "");
    setPurchaseId(preset?.purchaseId ?? "");
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
  }, [open, preset?.supplierId, preset?.purchaseId]);

  const supplierOptions = useMemo(() => {
    const items = supplierOptionsQuery.data?.items ?? [];

    if (!preset?.supplierId) {
      return items;
    }

    const exists = items.some((item) => item.id === preset.supplierId);

    if (exists) {
      return items;
    }

    return [
      {
        id: preset.supplierId,
        supplierName: preset.supplierLabel,
        companyName: null,
        mobileNumber: "",
        status: "active" as const,
        openingBalance: "0.00",
      },
      ...items,
    ];
  }, [preset?.supplierId, preset?.supplierLabel, supplierOptionsQuery.data?.items]);

  const selectedSupplier = useMemo(
    () => supplierOptions.find((item) => item.id === supplierId) ?? null,
    [supplierId, supplierOptions],
  );

  const selectedPurchase = dueSummaryQuery.data?.openPurchases.find(
    (purchase) => purchase.id === purchaseId,
  );
  const selectedPurchaseLabel =
    preset?.purchaseLabel ||
    (selectedPurchase
      ? `${selectedPurchase.purchaseNumber} / Due ${formatCurrency(selectedPurchase.dueAmount)} / ${formatDate(selectedPurchase.purchaseDate)}`
      : "");

  return (
    <Modal
      description="Record a purchase-wise payment or a general supplier payment that can remain as advance when it exceeds current payables."
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
              if (!supplierId) {
                setLocalError("Select a supplier first.");
                return;
              }

              if (!(Number(amount) > 0)) {
                setLocalError("Enter a valid payment amount.");
                return;
              }

              setLocalError(null);
              await onSubmit({
                supplierId,
                purchaseId: purchaseId || undefined,
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
      title="Record supplier payment"
    >
      <div className="grid gap-4">
        {preset?.lockSupplier ? (
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Supplier
            <input className={inputClassName} readOnly value={preset.supplierLabel} />
          </label>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Search supplier
              <input
                className={inputClassName}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by supplier name or mobile"
                value={search}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Supplier
              <select
                className={inputClassName}
                onChange={(event) => {
                  setSupplierId(event.target.value);
                  setPurchaseId("");
                }}
                value={supplierId}
              >
                <option value="">Select supplier</option>
                {supplierOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.supplierName} / {item.companyName || "Independent"} / {item.mobileNumber || "No mobile"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {selectedSupplier && dueSummaryQuery.data ? (
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Outstanding", formatCurrency(dueSummaryQuery.data.summary.outstandingAmount)],
              ["Advance", formatCurrency(dueSummaryQuery.data.summary.advanceAmount)],
              ["Open purchases", dueSummaryQuery.data.summary.openPurchaseCount.toString()],
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
          {preset?.lockPurchase && preset?.purchaseId ? (
            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              Apply to purchase
              <input
                className={inputClassName}
                readOnly
                value={selectedPurchaseLabel || "Selected purchase"}
              />
            </label>
          ) : (
            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              Apply to purchase
              <select
                className={inputClassName}
                disabled={!supplierId}
                onChange={(event) => setPurchaseId(event.target.value)}
                value={purchaseId}
              >
                <option value="">General / auto allocation / advance</option>
                {dueSummaryQuery.data?.openPurchases.map((purchase) => (
                  <option key={purchase.id} value={purchase.id}>
                    {purchase.purchaseNumber} / Due {formatCurrency(purchase.dueAmount)} / {formatDate(purchase.purchaseDate)}
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
