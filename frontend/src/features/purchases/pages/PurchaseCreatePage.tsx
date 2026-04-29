import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useToast } from "../../../hooks/use-toast";
import {
  listMedicines,
  medicinesQueryKeys,
} from "../../medicines/api/medicines";
import { listSuppliers, suppliersQueryKeys } from "../../suppliers/api/suppliers";
import {
  createPurchase,
  finalizePurchase,
  purchasesQueryKeys,
} from "../api/purchases";
import {
  inventoryQueryKeys,
} from "../../inventory/api/inventory";
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

export const PurchaseCreatePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [submissionError, setSubmissionError] = useState<string>();

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

  const createMutation = useMutation({
    mutationFn: (payload: SavePurchasePayload) => createPurchase(payload),
  });

  const finalizeMutation = useMutation({
    mutationFn: (purchaseId: string) => finalizePurchase(purchaseId),
  });

  const activeError = suppliersQuery.error ?? medicinesQuery.error;

  if (suppliersQuery.isLoading || medicinesQuery.isLoading) {
    return <LoadingState title="Preparing purchase order workspace" />;
  }

  if (activeError) {
    return (
      <ErrorState
        description={activeError.message}
        onRetry={() => {
          suppliersQuery.refetch();
          medicinesQuery.refetch();
        }}
        title="Unable to load purchase order setup"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Create supplier purchase orders in a compact data-entry workflow, then receive them into stock when ready."
        eyebrow="Purchase management"
        title="Create Purchase Order"
      />

      <PurchaseForm
        errorMessage={submissionError}
        isSubmitting={createMutation.isPending || finalizeMutation.isPending}
        medicines={medicinesQuery.data?.items ?? []}
        mode="create"
        onSubmit={async (
          payload: SavePurchasePayload,
          intent: PurchaseSubmissionIntent,
        ) => {
          setSubmissionError(undefined);

          try {
            const createdPurchase = await createMutation.mutateAsync(payload);

            if (intent === "finalize") {
              try {
                const finalizedPurchase = await finalizeMutation.mutateAsync(
                  createdPurchase.id,
                );

                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all }),
                  queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all }),
                ]);

                pushToast({
                  title: "Purchase finalized",
                  description:
                    "The purchase order was saved, received, and stock has been posted successfully.",
                  variant: "success",
                });
                navigate(`/app/purchases/${finalizedPurchase.id}`);
                return;
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : "The draft was saved, but finalization could not be completed.";

                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all }),
                  queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all }),
                ]);

                pushToast({
                  title: "Draft saved, finalization pending",
                  description: message,
                  variant: "error",
                });
                navigate(`/app/purchases/${createdPurchase.id}/edit`);
                return;
              }
            }

            await queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all });
            pushToast({
              title: "Purchase draft saved",
              description:
                "The purchase order has been saved as a draft and can be received later.",
              variant: "success",
            });
            navigate(`/app/purchases/${createdPurchase.id}`);
          } catch (error) {
            setSubmissionError(
              error instanceof Error
                ? error.message
                : "Unable to save the purchase order right now.",
            );
          }
        }}
        suppliers={suppliersQuery.data?.items ?? []}
      />
    </div>
  );
};
