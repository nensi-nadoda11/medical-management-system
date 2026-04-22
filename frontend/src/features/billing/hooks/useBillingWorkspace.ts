import { useDeferredValue, useEffect, useMemo, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../../../hooks/use-toast";
import { getDaysUntil, toSelectedCustomerSummary } from "../../../lib/utils";
import type {
  BillPaymentMethod,
  BillDetail,
  BillingMedicineBatchOption,
  BillingMedicineOptions,
  BillingMedicineSearchItem,
  SaveBillPayload,
} from "../../../types/billing";
import {
  customersQueryKeys,
  getCustomer,
  listCustomerOptions,
} from "../../customers/api/customers";
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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface BillingEditorItem {
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

export interface BillingDraftState {
  selectedCustomer: {
    id: string;
    customerCode: string | null;
    fullName: string;
    mobileNumber: string;
    city?: string | null;
    totalDueAmount?: string;
    lastPurchaseDate?: string | null;
    status?: string;
  } | null;
  customerName: string;
  customerPhone: string;
  paymentMethod: BillPaymentMethod;
  paidAmount: string;
  roundOffAmount: string;
  notes: string;
  items: BillingEditorItem[];
  isFefoEnabled: boolean;
}

const emptyDraft = (): BillingDraftState => ({
  selectedCustomer: null,
  customerName: "",
  customerPhone: "",
  paymentMethod: "cash",
  paidAmount: "0",
  roundOffAmount: "0",
  notes: "",
  items: [],
  isFefoEnabled: true, // Defaulting FEFO to enabled
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
  customerId: draft.selectedCustomer?.id,
  customerName: draft.selectedCustomer
    ? undefined
    : draft.customerName.trim() || undefined,
  customerPhone: draft.selectedCustomer
    ? undefined
    : draft.customerPhone.trim() || undefined,
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
  selectedCustomer: BillingDraftState["selectedCustomer"],
) => ({
  selectedCustomer,
  customerName: bill.customerName ?? "",
  customerPhone: bill.customerPhone ?? "",
  paymentMethod: bill.paymentMethod,
  paidAmount: bill.paidAmount,
  roundOffAmount: bill.roundOffAmount,
  notes: bill.notes ?? "",
  isFefoEnabled: true,
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

export const useBillingWorkspace = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const heldBillId = searchParams.get("heldBillId");
  const validHeldBillId = heldBillId && uuidPattern.test(heldBillId) ? heldBillId : null;
  const deferredHeldBillId = useDeferredValue(validHeldBillId);

  const [draft, setDraft] = useState(emptyDraft);
  const [medicineSearch, setMedicineSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [loadedHeldBillId, setLoadedHeldBillId] = useState<string | null>(null);

  const deferredMedicineSearch = useDeferredValue(medicineSearch);
  const deferredCustomerSearch = useDeferredValue(customerSearch);

  // Queries
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
      search: deferredMedicineSearch || undefined,
      page: 1,
      pageSize: 12,
      sortBy: "medicineName",
      sortOrder: "asc",
    }),
    queryFn: () =>
      searchSellableMedicines({
        search: deferredMedicineSearch || undefined,
        page: 1,
        pageSize: 12,
        sortBy: "medicineName",
        sortOrder: "asc",
      }),
    staleTime: 60_000, // Keep results fresh for 1 minute
    gcTime: 1000 * 60 * 15, // Keep in cache for 15 minutes
    placeholderData: (previousData) => previousData, // Keep UI stable while searching
  });

  const heldBillQuery = useQuery({
    queryKey: deferredHeldBillId
      ? billingQueryKeys.detail(deferredHeldBillId)
      : [...billingQueryKeys.details(), "empty"],
    queryFn: () => getBill(deferredHeldBillId!),
    enabled: Boolean(deferredHeldBillId),
  });

  const customerOptionsQuery = useQuery({
    queryKey: customersQueryKeys.options(deferredCustomerSearch || undefined),
    queryFn: () => listCustomerOptions(deferredCustomerSearch || undefined),
    enabled: Boolean(deferredCustomerSearch.trim().length >= 2),
    staleTime: 15_000,
  });

  // Mutations
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

  // Load held bill logic
  useEffect(() => {
    if (!heldBillId) {
      Promise.resolve().then(() => {
        setLoadedHeldBillId(null);
        setDraft(emptyDraft());
      });
      return;
    }

    if (!heldBillQuery.data || loadedHeldBillId === heldBillId) {
      return;
    }

    void (async () => {
      const medicineIds = [...new Set(heldBillQuery.data!.items.map((item: any) => item.medicine.id))] as string[];
      const optionEntries = await Promise.all(
        medicineIds.map(async (medicineId: string) => [
          medicineId,
          await queryClient.fetchQuery({
            queryKey: billingQueryKeys.medicineOptions(medicineId),
            queryFn: () => getSellableMedicineOptions(medicineId),
            staleTime: 30_000,
          }),
        ] as [string, BillingMedicineOptions]),
      );

      const optionMap = new Map<string, BillingMedicineOptions>(optionEntries);
      const selectedCustomer = heldBillQuery.data.customerId
        ? await queryClient
            .fetchQuery({
              queryKey: customersQueryKeys.detail(heldBillQuery.data.customerId),
              queryFn: () => getCustomer(heldBillQuery.data.customerId!),
              staleTime: 30_000,
            })
            .then(toSelectedCustomerSummary)
            .catch(() =>
              heldBillQuery.data.customerName && heldBillQuery.data.customerPhone
                ? {
                    id: heldBillQuery.data.customerId!,
                    customerCode: null,
                    fullName: heldBillQuery.data.customerName,
                    mobileNumber: heldBillQuery.data.customerPhone,
                    city: null,
                    totalDueAmount: "0.00",
                    lastPurchaseDate: null,
                    status: "active",
                  }
                : null,
            )
        : null;

      Promise.resolve().then(() => {
        setDraft(loadHeldBillIntoDraft(heldBillQuery.data!, optionMap, selectedCustomer));
        setLoadedHeldBillId(heldBillId);
      });
    })().catch((error: Error) => {
      pushToast({
        title: "Unable to load held bill",
        description: error.message,
        variant: "error",
      });
    });
  }, [heldBillId, heldBillQuery.data, loadedHeldBillId, pushToast, queryClient]);

  // Totals calculation
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

  const resetDraft = useCallback(() => {
    setSearchParams({});
    setLoadedHeldBillId(null);
    setCustomerSearch("");
    setDraft(emptyDraft());
  }, [setSearchParams]);

  const hydrateMedicine = async (medicine: BillingMedicineSearchItem) => {
    const options = await queryClient.fetchQuery({
      queryKey: billingQueryKeys.medicineOptions(medicine.medicine.id),
      queryFn: () => getSellableMedicineOptions(medicine.medicine.id),
      staleTime: 30_000,
    });

    setDraft((current) => {
      // FEFO Logic: Pick batch with earliest expiry
      let defaultBatchId = options.defaultBatchId;
      
      if (current.isFefoEnabled && options.batches.length > 0) {
        // Sort batches by expiry date, excluding expired ones (API already filters expired usually)
        const sortedBatches = [...options.batches].sort((a, b) => 
          new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
        );
        defaultBatchId = sortedBatches[0]?.id || defaultBatchId;
      } else if (!defaultBatchId) {
        defaultBatchId = options.batches[0]?.id ?? "";
      }

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

            const selectedBatch = item.batchOptions.find(b => b.id === item.selectedBatchId) || options.batches[0];
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
        items: [...current.items, buildEditorItem(options, { selectedBatchId: defaultBatchId ?? "" })],
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
      throw new Error("Add at least one medicine before saving the bill.");
    }

    const payload = toPayload(draft, draft.items);
    const result = validHeldBillId
      ? await updateHeldMutation.mutateAsync({ id: validHeldBillId, payload })
      : await createHeldMutation.mutateAsync(payload);

    await queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
    setSearchParams({ heldBillId: result.id });
    setLoadedHeldBillId(result.id);
    return result;
  };

  const finalizeBill = async () => {
    if (!draft.items.length) {
      throw new Error("Add at least one medicine before completing the bill.");
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
    return result;
  };

  const toggleFefo = () => {
    setDraft(current => ({ ...current, isFefoEnabled: !current.isFefoEnabled }));
  };

  return {
    draft,
    setDraft,
    medicineSearch,
    setMedicineSearch,
    customerSearch,
    setCustomerSearch,
    totals,
    validHeldBillId,
    heldBillsQuery,
    medicineSearchQuery,
    heldBillQuery,
    customerOptionsQuery,
    isSubmitting: createHeldMutation.isPending || updateHeldMutation.isPending || createCompletedMutation.isPending || completeHeldMutation.isPending,
    resetDraft,
    hydrateMedicine,
    updateItem,
    removeItem,
    saveHeldBill,
    finalizeBill,
    toggleFefo,
  };
};
