import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import { useToast } from "../../../hooks/use-toast";
import { formatDateTime, formatNumber } from "../../../lib/utils";
import type { TransferBatchOption } from "../../../types/stock-transfer";
import { branchesQueryKeys, getBranches } from "../../branches/api/branches";
import {
  cancelStockTransfer,
  completeStockTransfer,
  createStockTransfer,
  getStockTransfers,
  getTransferSourceBatches,
  stockTransferQueryKeys,
} from "../api/stock-transfers";

const inputClassName =
  "w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

interface DraftTransferItem {
  sourceBatchId: string;
  medicineId: string;
  quantity: number;
  label: string;
  batchNumber: string;
  availableQuantity: number;
}

export const StockTransfersPage = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [page, setPage] = useState(1);
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<DraftTransferItem[]>([]);

  const branchesQuery = useQuery({
    queryKey: branchesQueryKeys.list,
    queryFn: getBranches,
  });

  const transfersQuery = useQuery({
    queryKey: stockTransferQueryKeys.list(page, 10),
    queryFn: () => getStockTransfers({ page, pageSize: 10 }),
  });

  const sourceBatchesQuery = useQuery({
    queryKey: stockTransferQueryKeys.sourceBatches(fromBranchId, search),
    queryFn: () =>
      getTransferSourceBatches({
        branchId: fromBranchId,
        search: search || undefined,
        pageSize: 12,
      }),
    enabled: Boolean(fromBranchId),
  });

  const createMutation = useMutation({
    mutationFn: createStockTransfer,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: stockTransferQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: branchesQueryKeys.all }),
      ]);
      pushToast({
        title: "Transfer created",
        description: "The draft transfer is ready for completion.",
        variant: "success",
      });
      setItems([]);
      setSearch("");
    },
  });

  const updateTransferStatusMutation = useMutation({
    mutationFn: async ({
      transferId,
      action,
    }: {
      transferId: string;
      action: "complete" | "cancel";
    }) => {
      if (action === "complete") {
        return completeStockTransfer(transferId);
      }

      return cancelStockTransfer(transferId);
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: stockTransferQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: branchesQueryKeys.all }),
      ]);
      pushToast({
        title:
          variables.action === "complete" ? "Transfer completed" : "Transfer cancelled",
        description:
          variables.action === "complete"
            ? "Stock moved successfully across branches."
            : "The draft transfer was cancelled.",
        variant: "success",
      });
    },
  });

  const activeError =
    branchesQuery.error ?? transfersQuery.error ?? sourceBatchesQuery.error;

  const activeBranches = useMemo(
    () => (branchesQuery.data?.items ?? []).filter((branch) => branch.status === "active"),
    [branchesQuery.data],
  );

  if (branchesQuery.isLoading || transfersQuery.isLoading) {
    return <LoadingState title="Loading stock transfers" />;
  }

  if (activeError) {
    return (
      <ErrorState
        description={activeError.message}
        onRetry={() => {
          branchesQuery.refetch();
          transfersQuery.refetch();
          sourceBatchesQuery.refetch();
        }}
        title="Unable to load stock transfer workspace"
      />
    );
  }

  const canCreateTransfer =
    Boolean(fromBranchId) &&
    Boolean(toBranchId) &&
    fromBranchId !== toBranchId &&
    items.length > 0 &&
    !createMutation.isPending;
  const transferSummary = transfersQuery.data;
  const draftCount =
    transferSummary?.items.filter((item) => item.status === "draft").length ?? 0;

  const addTransferItem = (option: TransferBatchOption) => {
    setItems((current) => {
      if (current.some((item) => item.sourceBatchId === option.batch.id)) {
        return current;
      }

      return [
        ...current,
        {
          sourceBatchId: option.batch.id,
          medicineId: option.medicine.id,
          quantity: 1,
          label: `${option.medicine.medicineName} / ${option.medicine.genericName}`,
          batchNumber: option.batch.batchNumber,
          availableQuantity: option.batch.quantityAvailable,
        },
      ];
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        className="py-4"
        eyebrow="Inventory Control"
        title="Stock transfers"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Active branches" value={formatNumber(activeBranches.length)} />
        <SummaryCard label="Draft transfers" tone="warning" value={formatNumber(draftCount)} />
        <SummaryCard
          label="Total transfers"
          value={formatNumber(transferSummary?.pagination.total ?? 0)}
        />
        <SummaryCard
          label="Current page"
          value={formatNumber(transferSummary?.pagination.page ?? 1)}
        />
      </div>

      <SectionCard contentClassName="pt-1" title="Create transfer">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
          <div className="min-w-0 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
                From branch
                <select
                  className={inputClassName}
                  onChange={(event) => {
                    setFromBranchId(event.target.value);
                    setItems([]);
                  }}
                  value={fromBranchId}
                >
                  <option value="">Select source branch</option>
                  {activeBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
                To branch
                <select
                  className={inputClassName}
                  onChange={(event) => setToBranchId(event.target.value)}
                  value={toBranchId}
                >
                  <option value="">Select destination branch</option>
                  {activeBranches
                    .filter((branch) => branch.id !== fromBranchId)
                    .map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
              Search batches
              <input
                className={inputClassName}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search medicine, generic, or batch"
                value={search}
              />
            </label>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-3">
              <div className="grid h-[15rem] gap-2 overflow-y-auto pr-1">
                {(sourceBatchesQuery.data ?? []).map((option) => (
                  <button
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-slate-300"
                    key={option.batch.id}
                    onClick={() => addTransferItem(option)}
                    type="button"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {option.medicine.medicineName}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Batch {option.batch.batchNumber} • Available {formatNumber(option.batch.quantityAvailable)}
                      </p>
                    </div>
                    <span className="rounded-xl border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      Add
                    </span>
                  </button>
                ))}
                {fromBranchId && !sourceBatchesQuery.isLoading && !sourceBatchesQuery.data?.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                    No source batches available for this branch and search.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-3">
              <div className="h-[15rem] space-y-3 overflow-y-auto pr-1">
                {items.length ? (
                  items.map((item) => (
                    <div
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                      key={item.sourceBatchId}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            Batch {item.batchNumber} • Available {formatNumber(item.availableQuantity)}
                          </p>
                        </div>
                        <button
                          className="rounded-xl border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                          onClick={() =>
                            setItems((current) =>
                              current.filter((entry) => entry.sourceBatchId !== item.sourceBatchId),
                            )
                          }
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                      <label className="mt-3 grid gap-2 text-sm font-medium text-slate-700">
                        Quantity
                        <input
                          className={inputClassName}
                          max={item.availableQuantity}
                          min={1}
                          onChange={(event) =>
                            setItems((current) =>
                              current.map((entry) =>
                                entry.sourceBatchId === item.sourceBatchId
                                  ? {
                                      ...entry,
                                      quantity: Math.max(
                                        1,
                                        Math.min(
                                          entry.availableQuantity,
                                          Number(event.target.value) || 1,
                                        ),
                                      ),
                                    }
                                  : entry,
                              ),
                            )
                          }
                          type="number"
                          value={item.quantity}
                        />
                      </label>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                    Add source batches to start drafting a transfer.
                  </div>
                )}
              </div>
            </div>

            {createMutation.error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {createMutation.error.message}
              </div>
            ) : null}

            <button
              className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canCreateTransfer}
              onClick={() =>
                createMutation.mutate({
                  fromBranchId,
                  toBranchId,
                  items: items.map((item) => ({
                    sourceBatchId: item.sourceBatchId,
                    medicineId: item.medicineId,
                    quantity: item.quantity,
                  })),
                })
              }
              type="button"
            >
              {createMutation.isPending ? "Creating draft..." : "Create transfer draft"}
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard contentClassName="pt-1" title="Transfer register">
        <div className="space-y-4">
          <div className="hidden overflow-x-auto xl:block">
            <table className="min-w-[980px] w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4">Transfer</th>
                  <th className="px-4">Status</th>
                  <th className="px-4">Created by</th>
                  <th className="px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(transferSummary?.items ?? []).map((item) => (
                  <tr className="rounded-3xl bg-slate-50" key={item.id}>
                    <td className="rounded-l-3xl px-4 py-4">
                      <p className="font-semibold text-slate-950">
                        {item.fromBranch.name} to {item.toBranch.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.fromBranch.code} to {item.toBranch.code}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge label={item.status} />
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{item.createdBy.fullName}</td>
                    <td className="rounded-r-3xl px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={
                            item.status !== "draft" || updateTransferStatusMutation.isPending
                          }
                          onClick={() =>
                            updateTransferStatusMutation.mutate({
                              transferId: item.id,
                              action: "complete",
                            })
                          }
                          type="button"
                        >
                          Complete
                        </button>
                        <button
                          className="rounded-2xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={
                            item.status !== "draft" || updateTransferStatusMutation.isPending
                          }
                          onClick={() =>
                            updateTransferStatusMutation.mutate({
                              transferId: item.id,
                              action: "cancel",
                            })
                          }
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 xl:hidden">
            {(transferSummary?.items ?? []).map((item) => (
              <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-4" key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {item.fromBranch.name} to {item.toBranch.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Created {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  <StatusBadge label={item.status} />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    className="flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={item.status !== "draft" || updateTransferStatusMutation.isPending}
                    onClick={() =>
                      updateTransferStatusMutation.mutate({
                        transferId: item.id,
                        action: "complete",
                      })
                    }
                    type="button"
                  >
                    Complete
                  </button>
                  <button
                    className="flex-1 rounded-2xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={item.status !== "draft" || updateTransferStatusMutation.isPending}
                    onClick={() =>
                      updateTransferStatusMutation.mutate({
                        transferId: item.id,
                        action: "cancel",
                      })
                    }
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </article>
            ))}
          </div>

          <Pagination
            onPageChange={setPage}
            page={transferSummary?.pagination.page ?? 1}
            pageSize={transferSummary?.pagination.pageSize ?? 10}
            totalItems={transferSummary?.pagination.total ?? 0}
            totalPages={transferSummary?.pagination.totalPages ?? 1}
          />
        </div>
      </SectionCard>
    </div>
  );
};
