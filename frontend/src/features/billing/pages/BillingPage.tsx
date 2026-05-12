import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useToast } from "../../../hooks/use-toast";
import { toSelectedCustomerSummary } from "../../../lib/utils";
import { hasPermission } from "../../../types/auth";
import { useSessionQuery } from "../../auth/hooks/use-session";
import {
  createCustomer,
  customersQueryKeys,
} from "../../customers/api/customers";
import { CustomerQuickAddModal } from "../../customers/components/CustomerQuickAddModal";
import { useBillingWorkspace } from "../hooks/useBillingWorkspace";

// Billing Workspace Components
import { BillingHeader } from "../components/billing-workspace/BillingHeader";
import { BillingStats } from "../components/billing-workspace/BillingStats";
import { MedicineSearchPanel } from "../components/billing-workspace/MedicineSearchPanel";
import { BillingCartPanel } from "../components/billing-workspace/BillingCartPanel";
import { BillingSummaryPanel } from "../components/billing-workspace/BillingSummaryPanel";
import { QuickHeldBillsPanel } from "../components/billing-workspace/QuickHeldBillsPanel";
import { SectionCard } from "../../../components/ui/SectionCard";
import { Link } from "react-router-dom";

export const BillingPage = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const sessionQuery = useSessionQuery();
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);

  const {
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
    setIsPaidAmountManual,
    isSubmitting,
    resetDraft,
    hydrateMedicine,
    updateItem,
    removeItem,
    saveHeldBill,
    finalizeBill,
    toggleFefo,
  } = useBillingWorkspace();

  const canCreateBills = hasPermission(sessionQuery.data?.user, "billing.create");

  const createCustomerMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createCustomer>[0]) =>
      createCustomer(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customersQueryKeys.all });
    },
  });

  const handleConflict = (error: unknown) => {
    const err = error as { statusCode?: number; code?: string };
    if (err.statusCode === 409 || err.code === "SALE_STOCK_CONFLICT") {
      pushToast({
        title: "Stock conflict detected",
        description: "Some items in your cart might have been sold by another counter. Please refresh and try again.",
        variant: "error",
      });
      return true;
    }
    return false;
  };

  const onSaveHeld = async () => {
    try {
      const result = await saveHeldBill();
      pushToast({
        title: validHeldBillId ? "Held bill updated" : "Bill placed on hold",
        description: `${result.billNumber} is ready to reopen anytime.`,
        variant: "success",
      });
    } catch (error: unknown) {
      const err = error as Error;
      if (!handleConflict(error)) {
        pushToast({
          title: "Unable to hold bill",
          description: err.message,
          variant: "error",
        });
      }
    }
  };

  const onFinalize = async () => {
    try {
      const result = await finalizeBill();
      pushToast({
        title: "Bill completed",
        description: `${result.billNumber} has been posted and stock is updated.`,
        variant: "success",
      });
    } catch (error: unknown) {
      const err = error as Error;
      if (!handleConflict(error)) {
        pushToast({
          title: "Unable to complete bill",
          description: err.message,
          variant: "error",
        });
      }
    }
  };

  if (sessionQuery.isLoading) {
    return <LoadingState title="Loading billing workspace" />;
  }

  if (!canCreateBills) {
    return (
      <ErrorState
        description="You do not have permission to create bills."
        title="Billing access is limited"
        action={
          <Link
            className="ui-btn ui-btn--primary"
            to="/app/billing/history"
          >
            Open billing history
          </Link>
        }
      />
    );
  }

  const activeError =
    medicineSearchQuery.error ??
    heldBillsQuery.error ??
    (validHeldBillId ? heldBillQuery.error : null);

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

  // Note: Localized loading is now handled inside components via skeletons
  const isWorkspaceLoading = (validHeldBillId && heldBillQuery.isLoading);

  if (isWorkspaceLoading) {
    return <LoadingState title="Preparing the POS counter" />;
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <BillingHeader
        canCreateBills={canCreateBills}
        validHeldBillId={validHeldBillId}
        onNewBill={resetDraft}
      />

      <BillingStats
        dueAmount={totals.dueAmount}
        grandTotal={totals.grandTotal}
        heldBillsCount={heldBillsQuery.data?.pagination.total ?? 0}
        itemCount={draft.items.length}
      />

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
              className="ui-btn ui-btn--secondary !min-h-[2.35rem] !px-3"
              to={`/app/billing/${validHeldBillId}`}
            >
              View bill detail
            </Link>
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="min-w-0 overflow-hidden rounded-[26px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,255,0.94))] p-4 shadow-[0_24px_54px_-42px_rgba(15,23,42,0.24)] md:p-5 xl:h-[54rem]">
          <div className="grid h-full min-h-0 gap-5 xl:grid-rows-[minmax(0,24rem)_minmax(0,1fr)]">
            <div className="min-h-0 overflow-hidden">
              <MedicineSearchPanel
                embedded
                isFefoEnabled={draft.isFefoEnabled}
                isLoading={medicineSearchQuery.isLoading}
                medicines={medicineSearchQuery.data?.items ?? []}
                onAddMedicine={hydrateMedicine}
                onSearchChange={setMedicineSearch}
                onToggleFefo={toggleFefo}
                search={medicineSearch}
              />
            </div>

            <div className="min-h-0 overflow-hidden border-t border-slate-200/70 pt-5">
              <BillingCartPanel
                embedded
                items={draft.items}
                onClearCart={() => setDraft((current) => ({ ...current, items: [] }))}
                onRemoveItem={removeItem}
                onUpdateItem={updateItem}
              />
            </div>
          </div>
        </div>

        <BillingSummaryPanel
          customerOptions={customerOptionsQuery.data?.items ?? []}
          customerSearch={customerSearch}
          draft={draft}
          isSubmitting={isSubmitting}
          onCustomerSearchChange={setCustomerSearch}
          onDraftChange={setDraft}
          onFinalize={onFinalize}
          onQuickAddCustomer={() => setIsQuickCustomerOpen(true)}
          onSaveHeld={onSaveHeld}
          setIsPaidAmountManual={setIsPaidAmountManual}
          onSelectCustomer={(customer) => {
            setDraft((current) => ({
              ...current,
              selectedCustomer: toSelectedCustomerSummary(customer),
              customerName: customer.fullName,
              customerPhone: customer.mobileNumber,
            }));
            setCustomerSearch("");
          }}
          totals={totals}
          validHeldBillId={validHeldBillId}
        />
      </div>

      <QuickHeldBillsPanel
        heldBills={heldBillsQuery.data?.items ?? []}
        isLoading={heldBillsQuery.isLoading}
      />

      <CustomerQuickAddModal
        errorMessage={createCustomerMutation.error?.message}
        isSubmitting={createCustomerMutation.isPending}
        onClose={() => setIsQuickCustomerOpen(false)}
        onCreated={(customer) => {
          setDraft((current) => ({
            ...current,
            selectedCustomer: toSelectedCustomerSummary(customer),
            customerName: customer.fullName,
            customerPhone: customer.mobileNumber,
          }));
          setCustomerSearch("");
          setIsQuickCustomerOpen(false);
          pushToast({
            title: "Customer created",
            description: `${customer.fullName} is ready to use in this bill.`,
            variant: "success",
          });
        }}
        onSubmit={(payload) => createCustomerMutation.mutateAsync(payload)}
        open={isQuickCustomerOpen}
      />
    </div>
  );
};
