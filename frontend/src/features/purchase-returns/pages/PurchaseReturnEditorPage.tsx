import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  humanizeLabel,
} from "../../../lib/utils";
import { accountingQueryKeys } from "../../accounting/api/accounting";
import { useSessionQuery } from "../../auth/hooks/use-session";
import { inventoryQueryKeys } from "../../inventory/api/inventory";
import { listPurchases, purchasesQueryKeys } from "../../purchases/api/purchases";
import { hasPermission } from "../../../types/auth";
import {
  completePurchaseReturn,
  createPurchaseReturn,
  getPurchaseReturn,
  getReturnablePurchase,
  purchaseReturnsQueryKeys,
  updatePurchaseReturn,
} from "../api/purchaseReturns";
import type {
  CreatePurchaseReturnPayload,
  PurchaseReturnDetail,
  PurchaseReturnReason,
  PurchaseReturnRefundMethod,
  PurchaseReturnRefundStatus,
  ReturnablePurchaseDetailItem,
  UpdatePurchaseReturnPayload,
} from "../../../types/purchase-return";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

type ItemDraft = {
  quantity: string;
  reason: PurchaseReturnReason | "";
  notes: string;
};

const toMinorUnits = (value: number | string) => Math.round(Number(value) * 100);
const fromMinorUnits = (value: number) => value / 100;

const calculateLineReturnAmount = (
  item: ReturnablePurchaseDetailItem,
  quantity: number,
) => {
  const rateMinorUnits = toMinorUnits(item.purchaseRate);
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
  refundMethod: PurchaseReturnRefundMethod | "",
  refundStatus: PurchaseReturnRefundStatus,
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

export const PurchaseReturnEditorPage = () => {
  const { id = "" } = useParams();
  const isEditing = Boolean(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const canComplete = hasPermission(
    sessionQuery.data?.user,
    "purchaseReturns.complete",
  );
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const deferredPurchaseSearch = useDeferredValue(purchaseSearch);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(
    searchParams.get("purchaseId") ?? "",
  );
  const [refundAmount, setRefundAmount] = useState("0");
  const [refundMethod, setRefundMethod] = useState<PurchaseReturnRefundMethod | "">("");
  const [refundStatus, setRefundStatus] =
    useState<PurchaseReturnRefundStatus>("not_required");
  const [notes, setNotes] = useState("");
  const [itemDrafts, setItemDrafts] = useState<Record<string, ItemDraft>>({});
  const initializedKeyRef = useRef("");

  const existingReturnQuery = useQuery({
    enabled: isEditing,
    queryKey: purchaseReturnsQueryKeys.detail(id),
    queryFn: () => getPurchaseReturn(id),
  });

  const activePurchaseId = isEditing
    ? existingReturnQuery.data?.purchaseId ?? ""
    : selectedPurchaseId;

  const returnablePurchaseQuery = useQuery({
    enabled: Boolean(activePurchaseId),
    queryKey: purchaseReturnsQueryKeys.returnablePurchase(activePurchaseId),
    queryFn: () => getReturnablePurchase(activePurchaseId),
  });

  const finalizedPurchasesQuery = useQuery({
    enabled: !activePurchaseId && !isEditing,
    queryKey: purchasesQueryKeys.list({
      search: deferredPurchaseSearch || undefined,
      status: "finalized",
      page: 1,
      pageSize: 8,
      sortBy: "purchaseDate",
      sortOrder: "desc",
    }),
    queryFn: () =>
      listPurchases({
        search: deferredPurchaseSearch || undefined,
        status: "finalized",
        page: 1,
        pageSize: 8,
        sortBy: "purchaseDate",
        sortOrder: "desc",
      }),
  });

  useEffect(() => {
    const existingReturn = existingReturnQuery.data;
    const returnablePurchase = returnablePurchaseQuery.data;

    if (!returnablePurchase) {
      return;
    }

    const initKey = `${activePurchaseId}:${existingReturn?.id ?? "new"}`;

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
            returnablePurchase.items.map((item) => {
              const existingItem = existingReturn.items.find(
                (current) => current.purchaseItemId === item.purchaseItemId,
              );

              return [
                item.purchaseItemId,
                {
                  quantity: existingItem ? String(existingItem.quantity) : "",
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
          returnablePurchase.items.map((item) => [
            item.purchaseItemId,
            {
              quantity: "",
              reason: "",
              notes: "",
            },
          ]),
        ),
      );
    });
  }, [activePurchaseId, existingReturnQuery.data, returnablePurchaseQuery.data]);

  const activeItems = useMemo(
    () => returnablePurchaseQuery.data?.items ?? [],
    [returnablePurchaseQuery.data],
  );
  const selectedItems = useMemo(
    () =>
      activeItems
        .map((item) => {
          const draft = itemDrafts[item.purchaseItemId];
          const quantity = Number.parseInt(draft?.quantity ?? "", 10);

          if (!Number.isFinite(quantity) || quantity <= 0) {
            return null;
          }

          const totals = calculateLineReturnAmount(item, quantity);

          return {
            item,
            quantity,
            reason: draft.reason,
            notes: draft.notes.trim(),
            ...totals,
          };
        })
        .filter((value): value is NonNullable<typeof value> => Boolean(value)),
    [activeItems, itemDrafts],
  );

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

  const invalidateRelatedData = async (purchaseId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: purchaseReturnsQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.detail(purchaseId) }),
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: accountingQueryKeys.all }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: createPurchaseReturn,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      returnId,
      payload,
    }: {
      returnId: string;
      payload: UpdatePurchaseReturnPayload;
    }) => updatePurchaseReturn(returnId, payload),
  });

  const completeMutation = useMutation({
    mutationFn: completePurchaseReturn,
  });

  const handleItemChange = (
    purchaseItemId: string,
    field: keyof ItemDraft,
    value: string,
    maxQuantity?: number,
  ) => {
    setItemDrafts((current) => {
      const existing = current[purchaseItemId] ?? {
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
        [purchaseItemId]: {
          ...existing,
          [field]: field === "quantity" && nextValue === "0" ? "" : nextValue,
        },
      };
    });
  };

  const submit = async (mode: "draft" | "complete") => {
    if (!activePurchaseId) {
      pushToast({
        title: "Select a finalized purchase",
        description: "Choose the original finalized purchase before creating a return.",
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
    const currentPurchaseDueAmount = Number.parseFloat(
      returnablePurchaseQuery.data?.purchase.dueAmount ?? "0",
    );
    const maxRefundAmount = Math.max(previewTotal - currentPurchaseDueAmount, 0);

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
          "Return amount first adjusts the purchase due. Refund can only use the remaining return balance.",
        variant: "error",
      });
      return;
    }

    const payloadBase = {
      ...normalizeRefundFields(parsedRefundAmount, refundMethod, refundStatus),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      items: selectedItems.map((item) => ({
        purchaseItemId: item.item.purchaseItemId,
        quantity: item.quantity,
        reason: item.reason as PurchaseReturnReason,
        ...(item.notes ? { notes: item.notes } : {}),
      })),
    };

    try {
      let savedReturn: PurchaseReturnDetail;

      if (isEditing) {
        savedReturn = await updateMutation.mutateAsync({
          returnId: id,
          payload: payloadBase,
        });
      } else {
        savedReturn = await createMutation.mutateAsync({
          purchaseId: activePurchaseId,
          ...payloadBase,
        } as CreatePurchaseReturnPayload);
      }

      if (mode === "complete") {
        savedReturn = await completeMutation.mutateAsync(savedReturn.id);
      }

      await invalidateRelatedData(savedReturn.purchaseId);
      pushToast({
        title: mode === "complete" ? "Purchase return completed" : "Draft saved",
        description:
          mode === "complete"
            ? `${savedReturn.returnNumber} has been completed successfully.`
            : `${savedReturn.returnNumber} is ready for review.`,
        variant: "success",
      });
      navigate(`/app/purchase-returns/${savedReturn.id}`);
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
        description="Only draft purchase returns can be edited."
        title="Return is no longer editable"
      />
    );
  }

  const isBusy =
    createMutation.isPending || updateMutation.isPending || completeMutation.isPending;
  const currentPurchaseDueAmount = Number.parseFloat(
    returnablePurchaseQuery.data?.purchase.dueAmount ?? "0",
  );
  const maxRefundAmount = Math.max(previewTotal - currentPurchaseDueAmount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            {activePurchaseId ? (
              <Link
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                to={`/app/purchases/${activePurchaseId}`}
              >
                View purchase
              </Link>
            ) : null}
            {!isEditing && activePurchaseId ? (
              <button
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => {
                  initializedKeyRef.current = "";
                  setSelectedPurchaseId("");
                  setSearchParams({});
                }}
                type="button"
              >
                Change purchase
              </button>
            ) : null}
          </>
        }
        description="Create a compact item-wise supplier return against a finalized purchase, with backend-safe quantity and stock checks."
        eyebrow="Purchase management"
        title={isEditing ? "Edit draft purchase return" : "Create purchase return"}
      />

      {!activePurchaseId && !isEditing ? (
        <SectionCard
          description="Search a finalized purchase first. Returns can only be created against finalized purchase entries."
          title="Select finalized purchase"
        >
          <div className="space-y-4">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Search purchase
              <input
                className={inputClassName}
                onChange={(event) => setPurchaseSearch(event.target.value)}
                placeholder="Search purchase number or supplier"
                value={purchaseSearch}
              />
            </label>

            {finalizedPurchasesQuery.isLoading ? (
              <LoadingState title="Loading finalized purchases" />
            ) : finalizedPurchasesQuery.error ? (
              <ErrorState
                description={finalizedPurchasesQuery.error.message}
                onRetry={() => finalizedPurchasesQuery.refetch()}
                title="Unable to load finalized purchases"
              />
            ) : finalizedPurchasesQuery.data?.items.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {finalizedPurchasesQuery.data.items.map((purchase) => (
                  <article
                    className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                    key={purchase.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-950">
                          {purchase.purchaseNumber}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {purchase.supplier.supplierName} ·{" "}
                          {formatDateTime(purchase.finalizedAt ?? purchase.createdAt)}
                        </p>
                      </div>
                      <StatusBadge label={purchase.paymentStatus} />
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-950">
                        {formatCurrency(purchase.grandTotal)}
                      </p>
                      <button
                        className="rounded-2xl bg-slate-950 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        onClick={() => {
                          initializedKeyRef.current = "";
                          setSelectedPurchaseId(purchase.id);
                          setSearchParams({ purchaseId: purchase.id });
                        }}
                        type="button"
                      >
                        Use purchase
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                description="No finalized purchases match your current search."
                title="No finalized purchases found"
              />
            )}
          </div>
        </SectionCard>
      ) : null}

      {activePurchaseId ? (
        returnablePurchaseQuery.isLoading ? (
          <LoadingState title="Loading returnable purchase detail" />
        ) : returnablePurchaseQuery.error ? (
          <ErrorState
            description={returnablePurchaseQuery.error.message}
            onRetry={() => returnablePurchaseQuery.refetch()}
            title="Unable to load returnable items"
          />
        ) : returnablePurchaseQuery.data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard hint="Original purchase number" label="Purchase" value={returnablePurchaseQuery.data.purchase.purchaseNumber} />
              <SummaryCard hint="Supplier on purchase" label="Supplier" value={returnablePurchaseQuery.data.supplier.supplierName} />
              <SummaryCard hint="Original purchase value" label="Purchase total" value={formatCurrency(returnablePurchaseQuery.data.purchase.grandTotal)} />
              <SummaryCard hint="Preview from selected items" label="Return preview" value={formatCurrency(previewTotal)} />
            </div>

            <SectionCard description="Review the original purchase context before posting the supplier return." title="Original purchase summary">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Finalized at", formatDateTime(returnablePurchaseQuery.data.purchase.finalizedAt)],
                  ["Payment status", humanizeLabel(returnablePurchaseQuery.data.purchase.paymentStatus)],
                  ["Created by", returnablePurchaseQuery.data.purchase.createdBy.fullName],
                  ["Supplier", returnablePurchaseQuery.data.supplier.supplierName],
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
                      const draft = itemDrafts[item.purchaseItemId] ?? {
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
                          key={item.purchaseItemId}
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
                          <div className="mt-4 grid gap-3 sm:grid-cols-4">
                            {[
                              ["Purchased", item.purchasedQuantity.toString()],
                              ["Free", item.freeQuantity.toString()],
                              ["Returned", item.alreadyReturnedQuantity.toString()],
                              ["Remaining", item.remainingReturnableQuantity.toString()],
                              ["In batch", item.availableBatchQuantity.toString()],
                              ["Returnable now", item.maxReturnableQuantity.toString()],
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
                                    item.purchaseItemId,
                                    "quantity",
                                    event.target.value,
                                    item.maxReturnableQuantity,
                                  )
                                }
                                placeholder="0"
                                value={draft.quantity}
                              />
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-slate-700">
                              Reason
                              <select
                                className={inputClassName}
                                disabled={item.remainingReturnableQuantity <= 0}
                                onChange={(event) =>
                                  handleItemChange(
                                    item.purchaseItemId,
                                    "reason",
                                    event.target.value,
                                  )
                                }
                                value={draft.reason}
                              >
                                <option value="">Select reason</option>
                                <option value="damaged_stock">Damaged stock</option>
                                <option value="wrong_item">Wrong item</option>
                                <option value="near_expiry">Near expiry</option>
                                <option value="expired">Expired</option>
                                <option value="excess_stock">Excess stock</option>
                                <option value="purchase_mistake">Purchase mistake</option>
                                <option value="other">Other</option>
                              </select>
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-slate-700">
                              Notes
                              <textarea
                                className={`${inputClassName} min-h-20 resize-y`}
                                disabled={item.remainingReturnableQuantity <= 0}
                                onChange={(event) =>
                                  handleItemChange(item.purchaseItemId, "notes", event.target.value)
                                }
                                placeholder="Optional notes"
                                value={draft.notes}
                              />
                            </label>
                          </div>
                          <div className="mt-4 flex items-center justify-between text-sm">
                            <span className="text-slate-500">
                              Rate {formatCurrency(item.purchaseRate)}
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
                    <table className="min-w-[1380px] w-full border-separate border-spacing-y-3">
                      <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          <th className="px-4">Medicine</th>
                          <th className="px-4">Batch</th>
                          <th className="px-4">Purchased</th>
                          <th className="px-4">Free</th>
                          <th className="px-4">Returned</th>
                          <th className="px-4">Remaining</th>
                          <th className="px-4">In batch</th>
                          <th className="px-4">Qty</th>
                          <th className="px-4">Reason</th>
                          <th className="px-4">Notes</th>
                          <th className="px-4">Preview</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeItems.map((item) => {
                          const draft = itemDrafts[item.purchaseItemId] ?? {
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
                            <tr className="rounded-3xl bg-slate-50" key={item.purchaseItemId}>
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
                                {item.purchasedQuantity}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-700">
                                {item.freeQuantity}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-700">
                                {item.alreadyReturnedQuantity}
                              </td>
                              <td className="px-4 py-4 text-sm font-semibold text-slate-950">
                                {item.remainingReturnableQuantity}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-700">
                                {item.availableBatchQuantity}
                              </td>
                              <td className="px-4 py-4">
                                <input
                                  className={inputClassName}
                                  disabled={item.remainingReturnableQuantity <= 0}
                                  inputMode="numeric"
                                  onChange={(event) =>
                                    handleItemChange(
                                      item.purchaseItemId,
                                      "quantity",
                                      event.target.value,
                                      item.maxReturnableQuantity,
                                    )
                                  }
                                  placeholder="0"
                                  value={draft.quantity}
                                />
                              </td>
                              <td className="px-4 py-4">
                                <select
                                  className={inputClassName}
                                  disabled={item.remainingReturnableQuantity <= 0}
                                  onChange={(event) =>
                                    handleItemChange(
                                      item.purchaseItemId,
                                      "reason",
                                      event.target.value,
                                    )
                                  }
                                  value={draft.reason}
                                >
                                  <option value="">Select reason</option>
                                  <option value="damaged_stock">Damaged stock</option>
                                  <option value="wrong_item">Wrong item</option>
                                  <option value="near_expiry">Near expiry</option>
                                  <option value="expired">Expired</option>
                                  <option value="excess_stock">Excess stock</option>
                                  <option value="purchase_mistake">Purchase mistake</option>
                                  <option value="other">Other</option>
                                </select>
                              </td>
                              <td className="px-4 py-4">
                                <input
                                  className={inputClassName}
                                  disabled={item.remainingReturnableQuantity <= 0}
                                  onChange={(event) =>
                                    handleItemChange(item.purchaseItemId, "notes", event.target.value)
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
                  description="All items on this purchase have already been fully returned."
                  title="No returnable quantity left"
                />
              )}
            </SectionCard>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
              <SectionCard description="Capture how the supplier-side refund should be recorded for this return." title="Refund details">
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
                      Purchase due adjusts first. Maximum refundable amount is {formatCurrency(maxRefundAmount)}.
                    </span>
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Refund method
                    <select
                      className={inputClassName}
                      disabled={Number.parseFloat(refundAmount || "0") <= 0}
                      onChange={(event) =>
                        setRefundMethod(event.target.value as PurchaseReturnRefundMethod | "")
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
                        setRefundStatus(event.target.value as PurchaseReturnRefundStatus)
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

              <SectionCard description="Preview totals before saving the draft or posting the stock deduction." title="Return totals">
                <div className="space-y-3">
                  {[
                    ["Selected items", selectedItems.length.toString()],
                    ["Return amount", formatCurrency(previewTotal)],
                    [
                      "Purchase due",
                      formatCurrency(returnablePurchaseQuery.data.purchase.dueAmount),
                    ],
                    [
                      "Due adjustment",
                      formatCurrency(Math.min(currentPurchaseDueAmount, previewTotal)),
                    ],
                    ["Max refund", formatCurrency(maxRefundAmount)],
                    ["Refund amount", formatCurrency(refundAmount || 0)],
                    [
                      "Refund status",
                      humanizeLabel(
                        normalizeRefundFields(
                          Number.parseFloat(refundAmount || "0"),
                          refundMethod,
                          refundStatus,
                        ).refundStatus,
                      ),
                    ],
                    [
                      "Supplier",
                      returnablePurchaseQuery.data.supplier.supplierName,
                    ],
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
                  {canComplete ? (
                    <button
                      className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isBusy}
                      onClick={() => submit("complete")}
                      type="button"
                    >
                      {completeMutation.isPending ? "Completing..." : "Complete return"}
                    </button>
                  ) : null}
                </div>
              </SectionCard>
            </div>
          </>
        ) : null
      ) : null}
    </div>
  );
};
