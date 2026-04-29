import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useToast } from "../../../hooks/use-toast";
import {
  listMedicines,
  medicinesQueryKeys,
} from "../../medicines/api/medicines";
import { listSuppliers, suppliersQueryKeys } from "../../suppliers/api/suppliers";
import { inventoryQueryKeys } from "../../inventory/api/inventory";
import {
  finalizePurchase,
  getPurchase,
  purchasesQueryKeys,
  updateDraftPurchase,
} from "../api/purchases";
import {
  PurchaseForm,
  type PurchaseSubmissionIntent,
} from "../components/PurchaseForm";
import type { SavePurchasePayload } from "../../../types/purchase";

const lookupParams = {
  page: 1,
  pageSize: 100,
  sortOrder: "asc" as const,
};

export const PurchaseEditPage = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [submissionError, setSubmissionError] = useState<string>();

  const purchaseQuery = useQuery({
    queryKey: purchasesQueryKeys.detail(id),
    queryFn: () => getPurchase(id),
    enabled: Boolean(id),
  });

  const suppliersQuery = useQuery({
    queryKey: suppliersQueryKeys.list({
      ...lookupParams,
      sortBy: "supplierName",
    }),
    queryFn: () =>
      listSuppliers({
        ...lookupParams,
        sortBy: "supplierName",
      }),
  });

  const medicinesQuery = useQuery({
    queryKey: medicinesQueryKeys.list({
      ...lookupParams,
      sortBy: "medicineName",
    }),
    queryFn: () =>
      listMedicines({
        ...lookupParams,
        sortBy: "medicineName",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: SavePurchasePayload) => updateDraftPurchase(id, payload),
  });

  const finalizeMutation = useMutation({
    mutationFn: (purchaseId: string) => finalizePurchase(purchaseId),
  });

  const activeError = purchaseQuery.error ?? suppliersQuery.error ?? medicinesQuery.error;

  if (purchaseQuery.isLoading || suppliersQuery.isLoading || medicinesQuery.isLoading) {
    return <LoadingState title="Opening purchase order draft" />;
  }

  if (activeError) {
    return (
      <ErrorState
        description={activeError.message}
        onRetry={() => {
          purchaseQuery.refetch();
          suppliersQuery.refetch();
          medicinesQuery.refetch();
        }}
        title="Unable to open purchase order draft"
      />
    );
  }

  if (!purchaseQuery.data) {
    return (
      <ErrorState
        description="The requested purchase could not be found."
        title="Purchase not found"
      />
    );
  }

  if (purchaseQuery.data.status !== "draft") {
    return (
      <ErrorState
        action={
          <Link
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            to={`/app/purchases/${purchaseQuery.data.id}`}
          >
            View purchase
          </Link>
        }
        description="Only draft purchase orders can be edited. This document is already locked for changes."
        title="Purchase is no longer editable"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Link
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            to={`/app/purchases/${purchaseQuery.data.id}`}
          >
            View detail
          </Link>
        }
        description="Adjust a draft purchase order safely before it posts stock into live inventory."
        eyebrow="Purchase management"
        title={`Edit ${purchaseQuery.data.purchaseNumber}`}
      />

      <PurchaseForm
        errorMessage={submissionError}
        isSubmitting={updateMutation.isPending || finalizeMutation.isPending}
        medicines={medicinesQuery.data?.items ?? []}
        mode="edit"
        onSubmit={async (
          payload: SavePurchasePayload,
          intent: PurchaseSubmissionIntent,
        ) => {
          setSubmissionError(undefined);

          try {
            const updatedPurchase = await updateMutation.mutateAsync(payload);

            if (intent === "finalize") {
              const finalizedPurchase = await finalizeMutation.mutateAsync(
                updatedPurchase.id,
              );

              await Promise.all([
                queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all }),
                queryClient.invalidateQueries({
                  queryKey: purchasesQueryKeys.detail(finalizedPurchase.id),
                }),
                queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all }),
              ]);

              pushToast({
                title: "Purchase finalized",
                description: "The updated purchase order has been received and posted to stock.",
                variant: "success",
              });
              navigate(`/app/purchases/${finalizedPurchase.id}`);
              return;
            }

            await Promise.all([
              queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all }),
              queryClient.invalidateQueries({
                queryKey: purchasesQueryKeys.detail(updatedPurchase.id),
              }),
            ]);

            pushToast({
              title: "Draft updated",
              description: "Your purchase order draft has been updated successfully.",
              variant: "success",
            });
            navigate(`/app/purchases/${updatedPurchase.id}`);
          } catch (error) {
            setSubmissionError(
              error instanceof Error
                ? error.message
                : "Unable to update the purchase order draft right now.",
            );
          }
        }}
        purchase={purchaseQuery.data}
        suppliers={suppliersQuery.data?.items ?? []}
      />
    </div>
  );
};
