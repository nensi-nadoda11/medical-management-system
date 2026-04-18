import { useEffect, useMemo, useState } from "react";
import { useDeferredValue } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { useToast } from "../../../hooks/use-toast";
import {
  cn,
  formatCurrency,
  formatDate,
  formatNumber,
  getDaysUntil,
  humanizeLabel,
} from "../../../lib/utils";
import type {
  BillPaymentMethod,
  BillDetail,
  BillingMedicineBatchOption,
  BillingMedicineOptions,
  BillingMedicineSearchItem,
  SaveBillPayload,
} from "../../../types/billing";
import { useSessionQuery } from "../../auth/hooks/use-session";
import {
  billingQueryKeys,
  completeHeldBill,
  createCompletedBill,
  createHeldBill,
  getBill,
  getSellableMedicineOptions,
  listBills,
  searchSellableMedicines,
  updateHeldBill,
} from "../api/billing";
import { BillingModuleNav } from "../components/BillingModuleNav";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface BillingEditorItem {
  id: string;
  medicineId: string;
  medicineName: string;
  genericName: string;
  form: string;
  unit: string;
  prescriptionRequired: boolean;
  availableQuantity: number;
  selectedBatchId: string;
  quantity: number;
  discountPercent: number;
  batchOptions: BillingMedicineBatchOption[];
}

interface BillingDraftState {
  customerName: string;
  customerPhone: string;
  paymentMethod: BillPaymentMethod;
  paidAmount: string;
  roundOffAmount: string;
  notes: string;
  items: BillingEditorItem[];
}

const emptyDraft = (): BillingDraftState => ({
  customerName: "",
  customerPhone: "",
  paymentMethod: "cash",
  paidAmount: "0",
  roundOffAmount: "0",
  notes: "",
  items: [],
});

const buildEditorItem = (
  options: BillingMedicineOptions,
  overrides?: Partial<BillingEditorItem>,
): BillingEditorItem => ({
  id: `${options.medicine.id}-${Math.random().toString(36).slice(2, 10)}`,
  medicineId: options.medicine.id,
  medicineName: options.medicine.medicineName,
  genericName: options.medicine.genericName,
  form: options.medicine.form,
  unit: options.medicine.unit,
  prescriptionRequired: options.medicine.prescriptionRequired,
  availableQuantity: options.availableQuantity,
  selectedBatchId: options.defaultBatchId ?? options.batches[0]?.id ?? "",
  quantity: 1,
  discountPercent: 0,
  batchOptions: options.batches,
  ...overrides,
});

const getSelectedBatch = (item: BillingEditorItem) =>
  item.batchOptions.find((batch) => batch.id === item.selectedBatchId) ??
  item.batchOptions[0];

const toPayload = (
  draft: BillingDraftState,
  items: BillingEditorItem[],
): SaveBillPayload => ({
  customerName: draft.customerName.trim() || undefined,
  customerPhone: draft.customerPhone.trim() || undefined,
  paymentMethod: draft.paymentMethod,
  paidAmount: Number(draft.paidAmount || 0),
  roundOffAmount: Number(draft.roundOffAmount || 0),
  notes: draft.notes.trim() || undefined,
  items: items.map((item) => ({
    medicineId: item.medicineId,
    batchId: item.selectedBatchId || undefined,
    quantity: item.quantity,
    discountPercent: item.discountPercent,
  })),
});

const loadHeldBillIntoDraft = (
  bill: BillDetail,
  optionMap: Map<string, BillingMedicineOptions>,
) => ({
  customerName: bill.customerName ?? "",
  customerPhone: bill.customerPhone ?? "",
  paymentMethod: bill.paymentMethod,
  paidAmount: bill.paidAmount,
  roundOffAmount: bill.roundOffAmount,
  notes: bill.notes ?? "",
  items: bill.items.map((item, index) => {
    const options = optionMap.get(item.medicine.id);

    if (options) {
      return buildEditorItem(options, {
        id: `${item.id}-${index}`,
        selectedBatchId: item.batch.id,
        quantity: item.quantity,
        discountPercent: Number(item.discountPercent),
      });
    }

    return {
      id: `${item.id}-${index}`,
      medicineId: item.medicine.id,
      medicineName: item.medicine.medicineName,
      genericName: item.medicine.genericName,
      form: item.medicine.form,
      unit: item.medicine.unit,
      prescriptionRequired: item.medicine.prescriptionRequired,
      availableQuantity: item.batch.quantityAvailable + item.quantity,
      selectedBatchId: item.batch.id,
      quantity: item.quantity,
      discountPercent: Number(item.discountPercent),
      batchOptions: [
        {
          id: item.batch.id,
          batchNumber: item.batch.batchNumber,
          expiryDate: item.batch.expiryDate,
          saleRate: item.rate,
          mrp: item.mrp,
          gstPercent: item.gstPercent,
          quantityAvailable: item.batch.quantityAvailable + item.quantity,
          status: item.batch.status,
          daysUntilExpiry: getDaysUntil(item.batch.expiryDate) ?? 0,
          isNearExpiry: item.batch.isNearExpiry,
        },
      ],
    };
  }),
});

export const BillingPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const heldBillId = searchParams.get("heldBillId");
  const validHeldBillId =
    heldBillId && uuidPattern.test(heldBillId) ? heldBillId : null;
  const deferredHeldBillId = useDeferredValue(validHeldBillId);

  const [draft, setDraft] = useState(emptyDraft);
  const [medicineSearch, setMedicineSearch] = useState("");
  const [loadedHeldBillId, setLoadedHeldBillId] = useState<string | null>(null);

  const canCreateBills = sessionQuery.data?.user.role !== "accountant";
  const deferredSearch = useDeferredValue(medicineSearch);

  const heldBillsQuery = useQuery({
    queryKey: billingQueryKeys.list({
      status: "held",
      page: 1,
      pageSize: 5,
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
    queryFn: () =>
      listBills({
        status: "held",
        page: 1,
        pageSize: 5,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
  });

  const medicineSearchQuery = useQuery({
    queryKey: billingQueryKeys.medicineSearch({
      search: deferredSearch || undefined,
      page: 1,
      pageSize: 12,
      sortBy: "medicineName",
      sortOrder: "asc",
    }),
    queryFn: () =>
      searchSellableMedicines({
        search: deferredSearch || undefined,
        page: 1,
        pageSize: 12,
        sortBy: "medicineName",
        sortOrder: "asc",
      }),
  });

  const heldBillQuery = useQuery({
    queryKey: deferredHeldBillId
      ? billingQueryKeys.detail(deferredHeldBillId)
      : [...billingQueryKeys.details(), "empty"],
    queryFn: () => getBill(deferredHeldBillId!),
    enabled: Boolean(deferredHeldBillId),
  });

  const createHeldMutation = useMutation({
    mutationFn: (payload: SaveBillPayload) => createHeldBill(payload),
  });
  const updateHeldMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SaveBillPayload }) =>
      updateHeldBill(id, payload),
  });
  const createCompletedMutation = useMutation({
    mutationFn: (payload: SaveBillPayload) => createCompletedBill(payload),
  });
  const completeHeldMutation = useMutation({
    mutationFn: (id: string) => completeHeldBill(id),
  });

  useEffect(() => {
    if (heldBillId && !validHeldBillId) {
      setSearchParams({});
      setLoadedHeldBillId(null);
      pushToast({
        title: "Invalid held bill link",
        description: "Opening a fresh billing screen instead.",
        variant: "info",
      });
    }
  }, [heldBillId, pushToast, setSearchParams, validHeldBillId]);

  useEffect(() => {
    if (!heldBillId) {
      setLoadedHeldBillId(null);
      setDraft(emptyDraft());
      return;
    }

    if (!heldBillQuery.data || loadedHeldBillId === heldBillId) {
      return;
    }

    void (async () => {
      const medicineIds = [...new Set(heldBillQuery.data.items.map((item) => item.medicine.id))];
      const optionEntries = await Promise.all(
        medicineIds.map(async (medicineId) => [
          medicineId,
          await queryClient.fetchQuery({
            queryKey: billingQueryKeys.medicineOptions(medicineId),
            queryFn: () => getSellableMedicineOptions(medicineId),
            staleTime: 30_000,
          }),
        ] as [string, BillingMedicineOptions]),
      );

      const optionMap = new Map<string, BillingMedicineOptions>(optionEntries);
      setDraft(loadHeldBillIntoDraft(heldBillQuery.data, optionMap));
      setLoadedHeldBillId(heldBillId);
    })().catch((error: Error) => {
      pushToast({
        title: "Unable to load held bill",
        description: error.message,
        variant: "error",
      });
    });
  }, [heldBillId, heldBillQuery.data, loadedHeldBillId, pushToast, queryClient]);

  const totals = useMemo(() => {
    const itemTotals = draft.items.map((item) => {
      const batch = getSelectedBatch(item);
      const rate = Number(batch?.saleRate ?? 0);
      const gross = rate * item.quantity;
      const discountAmount = (gross * item.discountPercent) / 100;
      const lineSubtotal = gross - discountAmount;
      const lineTaxAmount = (lineSubtotal * Number(batch?.gstPercent ?? 0)) / 100;
      const lineTotal = lineSubtotal + lineTaxAmount;

      return {
        gross,
        discountAmount,
        lineSubtotal,
        lineTaxAmount,
        lineTotal,
      };
    });

    const subtotal = itemTotals.reduce((sum, item) => sum + item.lineSubtotal, 0);
    const discountAmount = itemTotals.reduce(
      (sum, item) => sum + item.discountAmount,
      0,
    );
    const taxAmount = itemTotals.reduce((sum, item) => sum + item.lineTaxAmount, 0);
    const roundOff = Number(draft.roundOffAmount || 0);
    const grandTotal = subtotal + taxAmount + roundOff;
    const paidAmount = Number(draft.paidAmount || 0);
    const dueAmount = grandTotal - paidAmount;

    return {
      subtotal,
      discountAmount,
      taxAmount,
      roundOff,
      grandTotal,
      paidAmount,
      dueAmount,
    };
  }, [draft.items, draft.paidAmount, draft.roundOffAmount]);

  const activeError =
    medicineSearchQuery.error ??
    heldBillsQuery.error ??
    (validHeldBillId ? heldBillQuery.error : null);

  const resetDraft = () => {
    setSearchParams({});
    setLoadedHeldBillId(null);
    setDraft(emptyDraft());
  };

  const hydrateMedicine = async (medicine: BillingMedicineSearchItem) => {
    const options = await queryClient.fetchQuery({
      queryKey: billingQueryKeys.medicineOptions(medicine.medicine.id),
      queryFn: () => getSellableMedicineOptions(medicine.medicine.id),
      staleTime: 30_000,
    });

    setDraft((current) => {
      const defaultBatchId = options.defaultBatchId ?? options.batches[0]?.id ?? "";
      const existing = current.items.find(
        (item) =>
          item.medicineId === medicine.medicine.id &&
          item.selectedBatchId === defaultBatchId,
      );

      if (existing) {
        return {
          ...current,
          items: current.items.map((item) => {
            if (item.id !== existing.id) {
              return item;
            }

            const selectedBatch = getSelectedBatch({
              ...item,
              batchOptions: options.batches,
            });
            const maxQuantity = selectedBatch?.quantityAvailable ?? item.quantity;

            return {
              ...item,
              batchOptions: options.batches,
              availableQuantity: options.availableQuantity,
              quantity: Math.min(item.quantity + 1, maxQuantity),
            };
          }),
        };
      }

      return {
        ...current,
        items: [...current.items, buildEditorItem(options)],
      };
    });
  };

  const updateItem = (itemId: string, updater: (item: BillingEditorItem) => BillingEditorItem) =>
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? updater(item) : item)),
    }));

  const removeItem = (itemId: string) =>
    setDraft((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId),
    }));

  const saveHeldBill = async () => {
    if (!draft.items.length) {
      pushToast({
        title: "No items in bill",
        description: "Add at least one medicine before saving the bill.",
        variant: "error",
      });
      return;
    }

    const payload = toPayload(draft, draft.items);
    const result = validHeldBillId
      ? await updateHeldMutation.mutateAsync({ id: validHeldBillId, payload })
      : await createHeldMutation.mutateAsync(payload);

    await queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
    setSearchParams({ heldBillId: result.id });
    setLoadedHeldBillId(result.id);
    pushToast({
      title: validHeldBillId ? "Held bill updated" : "Bill placed on hold",
      description: `${result.billNumber} is ready to reopen anytime.`,
      variant: "success",
    });
  };

  const finalizeBill = async () => {
    if (!draft.items.length) {
      pushToast({
        title: "No items in bill",
        description: "Add at least one medicine before completing the bill.",
        variant: "error",
      });
      return;
    }

    const payload = toPayload(draft, draft.items);
    const result = validHeldBillId
      ? await updateHeldMutation
          .mutateAsync({ id: validHeldBillId, payload })
          .then((savedBill) => completeHeldMutation.mutateAsync(savedBill.id))
      : await createCompletedMutation.mutateAsync(payload);

    await queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
    setLoadedHeldBillId(null);
    setDraft(emptyDraft());
    navigate(`/app/billing/${result.id}`);
    pushToast({
      title: "Bill completed",
      description: `${result.billNumber} has been posted and stock is updated.`,
      variant: "success",
    });
  };

  if (sessionQuery.isLoading) {
    return <LoadingState title="Loading billing workspace" />;
  }

  if (!canCreateBills) {
    return <ErrorState description="You do not have permission to create bills." title="Billing access is limited" action={<Link className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" to="/app/billing/history">Open billing history</Link>} />;
  }

  if (
    (validHeldBillId && heldBillQuery.isLoading) ||
    (medicineSearchQuery.isLoading && !medicineSearchQuery.data)
  ) {
    return <LoadingState title="Preparing the POS counter" />;
  }

  if (activeError) {
    return (
      <ErrorState
        description={activeError.message}
        onRetry={() => {
          medicineSearchQuery.refetch();
          heldBillsQuery.refetch();
          if (validHeldBillId) {
            heldBillQuery.refetch();
          }
        }}
        title="Unable to load billing workspace"
      />
    );
  }

  const isSubmitting =
    createHeldMutation.isPending ||
    updateHeldMutation.isPending ||
    createCompletedMutation.isPending ||
    completeHeldMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <BillingModuleNav canCreateBills={canCreateBills} />
            <button
              className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={resetDraft}
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          hint="Live estimate from the current cart"
          label="Grand total"
          value={formatCurrency(totals.grandTotal)}
        />
        <SummaryCard
          hint="Stock-safe lines ready for this bill"
          label="Items in cart"
          tone={draft.items.length ? "accent" : "default"}
          value={draft.items.length}
        />
        <SummaryCard
          hint="Visible held bills ready to reopen"
          label="Held bills"
          tone={(heldBillsQuery.data?.items.length ?? 0) ? "warning" : "default"}
          value={heldBillsQuery.data?.pagination.total ?? 0}
        />
        <SummaryCard
          hint="Remaining collection after paid amount"
          label="Due amount"
          tone={totals.dueAmount > 0 ? "warning" : "default"}
          value={formatCurrency(totals.dueAmount)}
        />
      </div>

      {validHeldBillId ? (
        <SectionCard
          description="This draft stays stock-aware but does not deduct inventory until you complete it."
          title="Held Bill Context"
        >
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label="held" />
            <p className="text-sm text-slate-600">
              Editing held bill <span className="font-semibold text-slate-950">{heldBillQuery.data?.billNumber}</span>
            </p>
            <Link
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              to={`/app/billing/${validHeldBillId}`}
            >
              View bill detail
            </Link>
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1.4fr_0.95fr]">
        <SectionCard
          description="Search by medicine, generic name, or barcode and add sellable stock in one click."
          title="Medicine search"
        >
          <div className="space-y-4">
            <input
              className={inputClassName}
              onChange={(event) => setMedicineSearch(event.target.value)}
              placeholder="Search medicine, generic, or barcode"
              value={medicineSearch}
            />

            <div className="grid gap-3">
              {(medicineSearchQuery.data?.items ?? []).map((record) => (
                <button
                  className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/50"
                  key={record.medicine.id}
                  onClick={() => {
                    void hydrateMedicine(record).catch((error: Error) => {
                      pushToast({
                        title: "Unable to add medicine",
                        description: error.message,
                        variant: "error",
                      });
                    });
                  }}
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

            {!medicineSearchQuery.data?.items.length ? (
              <EmptyState
                description="No sellable medicines match the current search. Try another term or review inventory."
                title="No medicines found"
              />
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          description="Keep the cart compact and accurate. Each line stays tied to a real batch before the bill is saved."
          title="Bill cart"
          action={
            draft.items.length ? (
              <button
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => setDraft((current) => ({ ...current, items: [] }))}
                type="button"
              >
                Clear cart
              </button>
            ) : null
          }
        >
          {draft.items.length ? (
            <div className="space-y-3">
              {draft.items.map((item) => {
                const selectedBatch = getSelectedBatch(item);
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
                    <div className="flex flex-wrap items-start justify-between gap-3">
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
                        onClick={() => removeItem(item.id)}
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
                            updateItem(item.id, (current) => {
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
                              updateItem(item.id, (current) => ({
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
                              updateItem(item.id, (current) => ({
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

        <SectionCard
          description="Capture walk-in details, payment, and totals without leaving the billing screen."
          title="Bill summary"
        >
          <div className="space-y-4">
            <div className="grid gap-3">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Customer name
                <input
                  className={inputClassName}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      customerName: event.target.value,
                    }))
                  }
                  placeholder="Walk-in customer"
                  value={draft.customerName}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Customer phone
                <input
                  className={inputClassName}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      customerPhone: event.target.value,
                    }))
                  }
                  placeholder="Optional mobile number"
                  value={draft.customerPhone}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Payment method
                <select
                  className={inputClassName}
                  onChange={(event) =>
                    setDraft((current) => ({
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

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Paid amount
                  <input
                    className={inputClassName}
                    min={0}
                    onChange={(event) =>
                      setDraft((current) => ({
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
                      setDraft((current) => ({
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
                    setDraft((current) => ({
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
                <div className="flex items-center justify-between">
                  <span>Paid</span>
                  <span className="font-semibold text-slate-950">
                    {formatCurrency(totals.paidAmount)}
                  </span>
                </div>
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
                onClick={() => {
                  void saveHeldBill().catch((error: Error) => {
                    pushToast({
                      title: "Unable to hold bill",
                      description: error.message,
                      variant: "error",
                    });
                  });
                }}
                type="button"
              >
                {isSubmitting ? "Saving..." : validHeldBillId ? "Update held bill" : "Hold bill"}
              </button>
              <button
                className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting || !draft.items.length}
                onClick={() => {
                  void finalizeBill().catch((error: Error) => {
                    pushToast({
                      title: "Unable to complete bill",
                      description: error.message,
                      variant: "error",
                    });
                  });
                }}
                type="button"
              >
                {isSubmitting ? "Completing..." : validHeldBillId ? "Update and complete" : "Complete bill"}
              </button>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        description="Recent held bills stay close to the POS so billing can resume with minimal clicks."
        title="Quick held bills"
      >
        {heldBillsQuery.data?.items.length ? (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
            {heldBillsQuery.data.items.map((bill) => (
              <article
                className="rounded-[20px] border border-slate-200 bg-slate-50 p-4"
                key={bill.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{bill.billNumber}</p>
                    <p className="mt-1 text-sm text-slate-600">{bill.customerLabel}</p>
                  </div>
                  <StatusBadge label={bill.paymentStatus} />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-950">
                  {formatCurrency(bill.grandTotal)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Created {formatDate(bill.createdAt)}
                </p>
                <Link
                  className="mt-4 inline-flex rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  to={`/app/billing?heldBillId=${bill.id}`}
                >
                  Resume
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            description="Held bills will appear here as soon as you park one from the POS."
            title="No held bills yet"
          />
        )}
      </SectionCard>
    </div>
  );
};
