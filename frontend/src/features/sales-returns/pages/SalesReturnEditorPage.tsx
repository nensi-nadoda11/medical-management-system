import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { useToast } from "../../../hooks/use-toast";
import { formatCurrency, formatDate, formatDateTime, humanizeLabel } from "../../../lib/utils";
import { hasPermission } from "../../../types/auth";
import { billingQueryKeys, listBills, type BillListItem } from "../../billing/api/billing";
import { BillingModuleNav } from "../../billing/components/BillingModuleNav";
import { useSessionQuery } from "../../auth/hooks/use-session";
import {
  completeSalesReturn,
  createSalesReturn,
  getReturnableSale,
  getSalesReturn,
  salesReturnsQueryKeys,
  updateSalesReturn,
} from "../api/salesReturns";
import type {
  CreateSalesReturnPayload,
  ReturnableSaleDetailItem,
  SalesReturnDetail,
  SalesReturnRefundMethod,
  SalesReturnRefundStatus,
  UpdateSalesReturnPayload,
} from "../../../types/sales-return";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

type ItemDraft = {
  quantity: string;
  reason: string;
  notes: string;
};

const toMinorUnits = (value: number | string) => Math.round(Number(value) * 100);
const fromMinorUnits = (value: number) => value / 100;

const calculateLineReturnAmount = (
  item: ReturnableSaleDetailItem,
  quantity: number,
) => {
  const rateMinorUnits = toMinorUnits(item.rate);
  const grossMinorUnits = rateMinorUnits * quantity;
  const discountMinorUnits = Math.round(
    (grossMinorUnits * Number(item.discountPercent)) / 100,
  );
  const lineSubtotalMinorUnits = grossMinorUnits - discountMinorUnits;
  const lineTaxMinorUnits = Math.round(
    (lineSubtotalMinorUnits * item.taxPercent) / 100,
  );

  return {
    discountMinorUnits,
    lineReturnAmountMinorUnits: lineSubtotalMinorUnits + lineTaxMinorUnits,
  };
};

const normalizeRefundFields = (
  refundAmount: number,
  refundMethod: SalesReturnRefundMethod | "",
  refundStatus: SalesReturnRefundStatus,
) => {
  if (refundAmount <= 0) {
    return {
      refundAmount: 0,
      refundStatus: "not_required" as const,
    };
  }

  return {
    refundAmount,
    refundMethod: refundMethod || undefined,
    refundStatus,
  };
};

export const SalesReturnEditorPage = () => {
  const { id = "" } = useParams();
  const isEditing = Boolean(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const user = sessionQuery.data?.user;
  const canCreateBills = hasPermission(user, "billing.create");
  const [saleSearch, setSaleSearch] = useState(searchParams.get("saleId") ? "" : "");
  const [selectedSaleId, setSelectedSaleId] = useState(searchParams.get("saleId") ?? "");
  const [refundAmount, setRefundAmount] = useState("0");
  const [refundMethod, setRefundMethod] = useState<SalesReturnRefundMethod | "">("");
  const [refundStatus, setRefundStatus] =
    useState<SalesReturnRefundStatus>("not_required");
  const [notes, setNotes] = useState("");
  const [itemDrafts, setItemDrafts] = useState<Record<string, ItemDraft>>({});
  const initializedKeyRef = useRef<string>("");

  const existingReturnQuery = useQuery({
    enabled: isEditing,
    queryKey: salesReturnsQueryKeys.detail(id),
    queryFn: () => getSalesReturn(id),
  });

  const activeSaleId = isEditing
    ? existingReturnQuery.data?.saleId ?? ""
    : selectedSaleId;

  const returnableSaleQuery = useQuery({
    enabled: Boolean(activeSaleId),
    queryKey: salesReturnsQueryKeys.returnableSale(activeSaleId),
    queryFn: () => getReturnableSale(activeSaleId),
  });

  const completedBillsQuery = useQuery({
    enabled: !activeSaleId && !isEditing,
    queryKey: billingQueryKeys.list({
      search: saleSearch || undefined,
      status: "completed",
      page: 1,
      pageSize: 8,
      sortBy: "completedAt",
      sortOrder: "desc",
    }),
    queryFn: () =>
      listBills({
        search: saleSearch || undefined,
        status: "completed",
        page: 1,
        pageSize: 8,
        sortBy: "completedAt",
        sortOrder: "desc",
      }),
  });

  useEffect(() => {
    const existingReturn = existingReturnQuery.data;
    const returnableSale = returnableSaleQuery.data;

    if (!returnableSale) {
      return;
    }

    const initKey = `${activeSaleId}:${existingReturn?.id ?? "new"}`;

    if (initializedKeyRef.current === initKey) {
      return;
    }

    initializedKeyRef.current = initKey;

    Promise.resolve().then(() => {
      if (existingReturn) {
        setRefundAmount(existingReturn.refundAmount);
        setRefundMethod(existingReturn.refundMethod ?? "");
        setRefundStatus(existingReturn.refundStatus);
        setNotes(existingReturn.notes ?? "");
        setItemDrafts(
          Object.fromEntries(
            returnableSale.items.map((item) => {
              const existingItem = existingReturn.items.find(
                (current) => current.saleItemId === item.saleItemId,
              );
              const quantity = existingItem
                ? Math.min(existingItem.quantity, item.remainingReturnableQuantity)
                : 0;

              return [
                item.saleItemId,
                {
                  quantity: quantity ? String(quantity) : "",
                  reason: existingItem?.reason ?? "",
                  notes: existingItem?.notes ?? "",
                },
              ];
            }),
          ),
        );
        return;
      }

      setRefundAmount("0");
      setRefundMethod("");
      setRefundStatus("not_required");
      setNotes("");
      setItemDrafts(
        Object.fromEntries(
          returnableSale.items.map((item) => [
            item.saleItemId,
            {
              quantity: "",
              reason: "",
              notes: "",
            },
          ]),
        ),
      );
    });
  }, [activeSaleId, existingReturnQuery.data, returnableSaleQuery.data]);

  const activeItems = useMemo(
    () => returnableSaleQuery.data?.items ?? [],
    [returnableSaleQuery.data],
  );
  const selectedItems = useMemo(() => {
    return activeItems
      .map((item) => {
        const draft = itemDrafts[item.saleItemId];
        const quantity = Number.parseInt(draft?.quantity ?? "", 10);

        if (!Number.isFinite(quantity) || quantity <= 0) {
          return null;
        }

        const totals = calculateLineReturnAmount(item, quantity);

        return {
          item,
          quantity,
          reason: draft.reason.trim(),
          notes: draft.notes.trim(),
          ...totals,
        };
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
  }, [activeItems, itemDrafts]);

  const previewTotal = useMemo(
    () =>
      fromMinorUnits(
        selectedItems.reduce(
          (sum, item) => sum + item.lineReturnAmountMinorUnits,
          0,
        ),
      ),
    [selectedItems],
  );

  const invalidateRelatedData = async (saleId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: salesReturnsQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.detail(saleId) }),
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.lists() }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: createSalesReturn,
  });

  const updateMutation = useMutation({
    mutationFn: ({ returnId, payload }: { returnId: string; payload: UpdateSalesReturnPayload }) =>
      updateSalesReturn(returnId, payload),
  });

  const completeMutation = useMutation({
    mutationFn: completeSalesReturn,
  });

  const handleItemChange = (
    saleItemId: string,
    field: keyof ItemDraft,
    value: string,
    maxQuantity?: number,
  ) => {
    setItemDrafts((current) => {
      const existing = current[saleItemId] ?? {
        quantity: "",
        reason: "",
        notes: "",
      };
      const nextValue =
        field === "quantity" && value
          ? String(
              Math.max(
                0,
                Math.min(
                  Number.parseInt(value.replace(/\D/g, "") || "0", 10),
                  maxQuantity ?? Number.MAX_SAFE_INTEGER,
                ),
              ),
            )
          : value;

      return {
        ...current,
        [saleItemId]: {
          ...existing,
          [field]: field === "quantity" && nextValue === "0" ? "" : nextValue,
        },
      };
    });
  };

  const submit = async (mode: "draft" | "complete") => {
    if (!activeSaleId) {
      pushToast({
        title: "Select a completed bill",
        description: "Choose the original completed bill before creating a return.",
        variant: "error",
      });
      return;
    }

    if (!selectedItems.length) {
      pushToast({
        title: "No items selected",
        description: "Add at least one return quantity before saving.",
        variant: "error",
      });
      return;
    }

    if (selectedItems.some((item) => !item.reason)) {
      pushToast({
        title: "Reason required",
        description: "Every selected return item needs a reason.",
        variant: "error",
      });
      return;
    }

    const parsedRefundAmount = Number.parseFloat(refundAmount || "0");
    const currentSaleDueAmount = Number.parseFloat(
      returnableSaleQuery.data?.sale.dueAmount ?? "0",
    );
    const maxRefundAmount = Math.max(previewTotal - currentSaleDueAmount, 0);

    if (!Number.isFinite(parsedRefundAmount) || parsedRefundAmount < 0) {
      pushToast({
        title: "Invalid refund amount",
        description: "Enter a valid non-negative refund amount.",
        variant: "error",
      });
      return;
    }

    if (parsedRefundAmount > previewTotal) {
      pushToast({
        title: "Refund exceeds return total",
        description: "Refund amount cannot be greater than the return amount.",
        variant: "error",
      });
      return;
    }

    if (parsedRefundAmount > maxRefundAmount) {
      pushToast({
        title: "Refund exceeds net return",
        description:
          "Return amount first adjusts the bill due. Refund can only use the remaining return balance.",
        variant: "error",
      });
      return;
    }

    const payloadBase = {
      ...normalizeRefundFields(parsedRefundAmount, refundMethod, refundStatus),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      items: selectedItems.map((item) => ({
        saleItemId: item.item.saleItemId,
        quantity: item.quantity,
        reason: item.reason,
        ...(item.notes ? { notes: item.notes } : {}),
      })),
    };

    try {
      let savedReturn: SalesReturnDetail;

      if (isEditing) {
        savedReturn = await updateMutation.mutateAsync({
          returnId: id,
          payload: payloadBase,
        });
      } else {
        savedReturn = await createMutation.mutateAsync({
          saleId: activeSaleId,
          ...payloadBase,
        } as CreateSalesReturnPayload);
      }

      if (mode === "complete") {
        savedReturn = await completeMutation.mutateAsync(savedReturn.id);
      }

      await invalidateRelatedData(savedReturn.saleId);
      pushToast({
        title: mode === "complete" ? "Sales return completed" : "Draft saved",
        description:
          mode === "complete"
            ? `${savedReturn.returnNumber} has been completed successfully.`
            : `${savedReturn.returnNumber} is ready for review.`,
        variant: "success",
      });
      navigate(`/app/billing/returns/${savedReturn.id}`);
    } catch (error) {
      pushToast({
        title: mode === "complete" ? "Unable to complete return" : "Unable to save draft",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    }
  };

  if (isEditing && existingReturnQuery.isLoading) {
    return <LoadingState title="Loading draft return" />;
  }

  if (isEditing && existingReturnQuery.error) {
    return (
      <ErrorState
        description={existingReturnQuery.error.message}
        onRetry={() => existingReturnQuery.refetch()}
        title="Unable to load draft return"
      />
    );
  }

  if (isEditing && existingReturnQuery.data?.status !== "draft") {
    return (
      <ErrorState
        description="Only draft sales returns can be edited."
        title="Return is no longer editable"
      />
    );
  }

  const isBusy =
    createMutation.isPending || updateMutation.isPending || completeMutation.isPending;
  const currentSaleDueAmount = Number.parseFloat(
    returnableSaleQuery.data?.sale.dueAmount ?? "0",
  );
  const maxRefundAmount = Math.max(previewTotal - currentSaleDueAmount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <BillingModuleNav canCreateBills={canCreateBills} />
            {activeSaleId ? (
              <Link
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                to={`/app/billing/${activeSaleId}`}
              >
                View bill
              </Link>
            ) : null}
            {!isEditing && activeSaleId ? (
              <button
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => {
                  initializedKeyRef.current = "";
                  setSelectedSaleId("");
                  setSearchParams({});
                }}
                type="button"
              >
                Change bill
              </button>
            ) : null}
          </>
        }
        description="Create a compact item-wise return against a completed bill, with backend-safe quantity checks and refund capture."
        eyebrow="Billing / Sales Returns"
        title={isEditing ? "Edit draft return" : "Create sales return"}
      />

      {!activeSaleId && !isEditing ? (
        <SectionCard
          description="Search a completed bill first. Returns can only be created against completed sales."
          title="Select completed bill"
        >
          <div className="space-y-4">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Search bill
              <input
                className={inputClassName}
                onChange={(event) => setSaleSearch(event.target.value)}
                placeholder="Search bill number, customer, or phone"
                value={saleSearch}
              />
            </label>

            {completedBillsQuery.isLoading ? (
              <LoadingState title="Loading completed bills" />
            ) : completedBillsQuery.error ? (
              <ErrorState
                description={completedBillsQuery.error.message}
                onRetry={() => completedBillsQuery.refetch()}
                title="Unable to load completed bills"
              />
            ) : completedBillsQuery.data?.items.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {completedBillsQuery.data.items.map((bill: BillListItem) => (
                  <article
                    className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                    key={bill.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-950">
                          {bill.billNumber}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {bill.customerLabel} · {formatDateTime(bill.completedAt)}
                        </p>
                      </div>
                      <StatusBadge label={bill.paymentStatus} />
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-950">
                        {formatCurrency(bill.grandTotal)}
                      </p>
                      <button
                        className="rounded-2xl bg-slate-950 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        onClick={() => {
                          initializedKeyRef.current = "";
                          setSelectedSaleId(bill.id);
                          setSearchParams({ saleId: bill.id });
                        }}
                        type="button"
                      >
                        Use bill
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                description="No completed bills match your current search."
                title="No completed bills found"
              />
            )}
          </div>
        </SectionCard>
      ) : null}

      {activeSaleId ? (
        returnableSaleQuery.isLoading ? (
          <LoadingState title="Loading returnable sale detail" />
        ) : returnableSaleQuery.error ? (
          <ErrorState
            description={returnableSaleQuery.error.message}
            onRetry={() => returnableSaleQuery.refetch()}
            title="Unable to load returnable items"
          />
        ) : returnableSaleQuery.data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard hint="Original bill number" label="Bill" value={returnableSaleQuery.data.sale.billNumber} />
              <SummaryCard hint="Customer on bill" label="Customer" value={returnableSaleQuery.data.sale.customerLabel} />
              <SummaryCard hint="Original sale value" label="Bill total" value={formatCurrency(returnableSaleQuery.data.sale.grandTotal)} />
              <SummaryCard hint="Preview from selected items" label="Return preview" value={formatCurrency(previewTotal)} />
            </div>

            <SectionCard description="Review the original bill context before posting the return." title="Original bill summary">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Completed at", formatDateTime(returnableSaleQuery.data.sale.completedAt)],
                  ["Payment status", humanizeLabel(returnableSaleQuery.data.sale.paymentStatus)],
                  ["Payment method", humanizeLabel(returnableSaleQuery.data.sale.paymentMethod)],
                  ["Created by", returnableSaleQuery.data.sale.createdBy.fullName],
                ].map(([label, value]) => (
                  <div
                    className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3"
                    key={label}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {label}
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-slate-950">{value}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard description="Choose only the lines and quantities being returned. Remaining quantity is protected by the backend." title="Return items">
              {activeItems.some((item) => item.remainingReturnableQuantity > 0) ? (
                <div className="space-y-4">
                  <div className="grid gap-3 xl:hidden">
                    {activeItems.map((item) => {
                      const draft = itemDrafts[item.saleItemId] ?? {
                        quantity: "",
                        reason: "",
                        notes: "",
                      };
                      const quantity = Number.parseInt(draft.quantity || "0", 10) || 0;
                      const preview =
                        quantity > 0
                          ? calculateLineReturnAmount(item, quantity)
                          : null;

                      return (
                        <article
                          className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                          key={item.saleItemId}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-950">
                                {item.medicine.medicineName}
                              </h3>
                              <p className="mt-1 text-sm text-slate-600">
                                Batch {item.batch.batchNumber} · Exp {formatDate(item.batch.expiryDate)}
                              </p>
                            </div>
                            <StatusBadge
                              label={
                                item.remainingReturnableQuantity > 0
                                  ? "returnable"
                                  : "not_returnable"
                              }
                              tone={
                                item.remainingReturnableQuantity > 0
                                  ? "completed"
                                  : "cancelled"
                              }
                            />
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            {[
                              ["Sold", item.quantitySold.toString()],
                              ["Returned", item.alreadyReturnedQuantity.toString()],
                              ["Remaining", item.remainingReturnableQuantity.toString()],
                            ].map(([label, value]) => (
                              <div
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                                key={label}
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                  {label}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 grid gap-3">
                            <label className="grid gap-2 text-sm font-medium text-slate-700">
                              Return quantity
                              <input
                                className={inputClassName}
                                disabled={item.remainingReturnableQuantity <= 0}
                                inputMode="numeric"
                                onChange={(event) =>
                                  handleItemChange(
                                    item.saleItemId,
                                    "quantity",
                                    event.target.value,
                                    item.remainingReturnableQuantity,
                                  )
                                }
                                placeholder="0"
                                value={draft.quantity}
                              />
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-slate-700">
                              Reason
                              <input
                                className={inputClassName}
                                disabled={item.remainingReturnableQuantity <= 0}
                                onChange={(event) =>
                                  handleItemChange(item.saleItemId, "reason", event.target.value)
                                }
                                placeholder="Reason for return"
                                value={draft.reason}
                              />
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-slate-700">
                              Notes
                              <textarea
                                className={`${inputClassName} min-h-20 resize-y`}
                                disabled={item.remainingReturnableQuantity <= 0}
                                onChange={(event) =>
                                  handleItemChange(item.saleItemId, "notes", event.target.value)
                                }
                                placeholder="Optional notes"
                                value={draft.notes}
                              />
                            </label>
                          </div>
                          <div className="mt-4 flex items-center justify-between text-sm">
                            <span className="text-slate-500">
                              Rate {formatCurrency(item.rate)}
                            </span>
                            <span className="font-semibold text-slate-950">
                              {preview
                                ? formatCurrency(fromMinorUnits(preview.lineReturnAmountMinorUnits))
                                : formatCurrency(0)}
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="hidden overflow-x-auto xl:block">
                    <table className="min-w-[1320px] w-full border-separate border-spacing-y-3">
                      <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          <th className="px-4">Medicine</th>
                          <th className="px-4">Batch</th>
                          <th className="px-4">Sold</th>
                          <th className="px-4">Returned</th>
                          <th className="px-4">Remaining</th>
                          <th className="px-4">Qty</th>
                          <th className="px-4">Reason</th>
                          <th className="px-4">Notes</th>
                          <th className="px-4">Preview</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeItems.map((item) => {
                          const draft = itemDrafts[item.saleItemId] ?? {
                            quantity: "",
                            reason: "",
                            notes: "",
                          };
                          const quantity = Number.parseInt(draft.quantity || "0", 10) || 0;
                          const preview =
                            quantity > 0
                              ? calculateLineReturnAmount(item, quantity)
                              : null;

                          return (
                            <tr className="rounded-3xl bg-slate-50" key={item.saleItemId}>
                              <td className="rounded-l-3xl px-4 py-4">
                                <div>
                                  <p className="font-semibold text-slate-950">
                                    {item.medicine.medicineName}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    {item.medicine.genericName}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-700">
                                <div>
                                  <p>{item.batch.batchNumber}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {formatDate(item.batch.expiryDate)}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-700">
                                {item.quantitySold}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-700">
                                {item.alreadyReturnedQuantity}
                              </td>
                              <td className="px-4 py-4 text-sm font-semibold text-slate-950">
                                {item.remainingReturnableQuantity}
                              </td>
                              <td className="px-4 py-4">
                                <input
                                  className={inputClassName}
                                  disabled={item.remainingReturnableQuantity <= 0}
                                  inputMode="numeric"
                                  onChange={(event) =>
                                    handleItemChange(
                                      item.saleItemId,
                                      "quantity",
                                      event.target.value,
                                      item.remainingReturnableQuantity,
                                    )
                                  }
                                  placeholder="0"
                                  value={draft.quantity}
                                />
                              </td>
                              <td className="px-4 py-4">
                                <input
                                  className={inputClassName}
                                  disabled={item.remainingReturnableQuantity <= 0}
                                  onChange={(event) =>
                                    handleItemChange(item.saleItemId, "reason", event.target.value)
                                  }
                                  placeholder="Reason"
                                  value={draft.reason}
                                />
                              </td>
                              <td className="px-4 py-4">
                                <input
                                  className={inputClassName}
                                  disabled={item.remainingReturnableQuantity <= 0}
                                  onChange={(event) =>
                                    handleItemChange(item.saleItemId, "notes", event.target.value)
                                  }
                                  placeholder="Optional notes"
                                  value={draft.notes}
                                />
                              </td>
                              <td className="rounded-r-3xl px-4 py-4 text-sm font-semibold text-slate-950">
                                {preview
                                  ? formatCurrency(fromMinorUnits(preview.lineReturnAmountMinorUnits))
                                  : formatCurrency(0)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <EmptyState
                  description="All items on this bill have already been fully returned."
                  title="No returnable quantity left"
                />
              )}
            </SectionCard>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
              <SectionCard description="Capture how the refund should be recorded for this return." title="Refund details">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Refund amount
                    <input
                      className={inputClassName}
                      min="0"
                      onChange={(event) => {
                        const value = event.target.value;
                        setRefundAmount(value);
                        if (Number.parseFloat(value || "0") <= 0) {
                          setRefundMethod("");
                          setRefundStatus("not_required");
                        } else if (refundStatus === "not_required") {
                          setRefundStatus("pending");
                        }
                      }}
                      step="0.01"
                      type="number"
                      value={refundAmount}
                    />
                    <span className="text-xs text-slate-500">
                      Bill due adjusts first. Maximum refundable amount is {formatCurrency(maxRefundAmount)}.
                    </span>
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Refund method
                    <select
                      className={inputClassName}
                      disabled={Number.parseFloat(refundAmount || "0") <= 0}
                      onChange={(event) =>
                        setRefundMethod(event.target.value as SalesReturnRefundMethod | "")
                      }
                      value={refundMethod}
                    >
                      <option value="">Select method</option>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="adjustment">Adjustment</option>
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Refund status
                    <select
                      className={inputClassName}
                      disabled={Number.parseFloat(refundAmount || "0") <= 0}
                      onChange={(event) =>
                        setRefundStatus(event.target.value as SalesReturnRefundStatus)
                      }
                      value={
                        Number.parseFloat(refundAmount || "0") <= 0
                          ? "not_required"
                          : refundStatus
                      }
                    >
                      <option value="pending">Pending</option>
                      <option value="processed">Processed</option>
                      <option value="not_required">Not required</option>
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                    Notes
                    <textarea
                      className={`${inputClassName} min-h-28 resize-y`}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Optional return notes"
                      value={notes}
                    />
                  </label>
                </div>
              </SectionCard>

              <SectionCard description="Preview totals before saving the draft or posting the stock reversal." title="Return totals">
                <div className="space-y-3">
                  {[
                    ["Selected items", selectedItems.length.toString()],
                    ["Return amount", formatCurrency(previewTotal)],
                    ["Bill due adjustment", formatCurrency(Math.min(currentSaleDueAmount, previewTotal))],
                    ["Max refund", formatCurrency(maxRefundAmount)],
                    ["Refund amount", formatCurrency(refundAmount || 0)],
                    ["Refund status", humanizeLabel(normalizeRefundFields(Number.parseFloat(refundAmount || "0"), refundMethod, refundStatus).refundStatus)],
                  ].map(([label, value]) => (
                    <div
                      className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3"
                      key={label}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {label}
                      </p>
                      <p className="mt-1.5 text-sm font-semibold text-slate-950">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isBusy}
                    onClick={() => submit("draft")}
                    type="button"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Saving..."
                      : "Save draft"}
                  </button>
                  <button
                    className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isBusy}
                    onClick={() => submit("complete")}
                    type="button"
                  >
                    {completeMutation.isPending ? "Completing..." : "Complete return"}
                  </button>
                </div>
              </SectionCard>
            </div>
          </>
        ) : null
      ) : null}
    </div>
  );
};
