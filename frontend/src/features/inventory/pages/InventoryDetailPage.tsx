import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SummaryCard } from "../../../components/ui/SummaryCard";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
} from "../../../lib/utils";
import { getInventoryMedicineDetail, inventoryQueryKeys } from "../api/inventory";
import { StockAdjustmentModal } from "../components/StockAdjustmentModal";

export const InventoryDetailPage = () => {
  const { medicineId = "" } = useParams();
  const [adjustmentTarget, setAdjustmentTarget] = useState<{
    medicineId?: string;
    batchId?: string;
  }>();

  const detailQuery = useQuery({
    queryKey: inventoryQueryKeys.detail(medicineId, true),
    queryFn: () => getInventoryMedicineDetail(medicineId, true),
    enabled: Boolean(medicineId),
  });

  if (detailQuery.isLoading) {
    return <LoadingState title="Loading stock detail" />;
  }

  if (detailQuery.error) {
    return (
      <ErrorState
        description={detailQuery.error.message}
        onRetry={() => detailQuery.refetch()}
        title="Unable to load stock detail"
      />
    );
  }

  if (!detailQuery.data) {
    return (
      <ErrorState
        description="The requested medicine could not be found."
        title="Medicine not found"
      />
    );
  }

  const detail = detailQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Link
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              to="/app/inventory"
            >
              Back to inventory
            </Link>
            <button
              className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() =>
                setAdjustmentTarget({
                  medicineId: detail.medicine.id,
                })
              }
              type="button"
            >
              Stock adjustment
            </button>
          </>
        }
        description="Review medicine-level stock, active and exhausted batches, and recent stock movements."
        eyebrow="Inventory control"
        title={detail.medicine.medicineName}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          hint="Current available quantity across non-expired active stock"
          label="Available stock"
          value={formatNumber(detail.availableQuantity)}
        />
        <SummaryCard
          hint="Configured reorder threshold"
          label="Reorder level"
          value={formatNumber(detail.medicine.reorderLevel)}
        />
        <SummaryCard
          hint="Batch coverage currently available"
          label="Active batches"
          value={formatNumber(detail.activeBatchCount)}
        />
        <SummaryCard
          hint={detail.isLowStock ? "Immediate refill attention needed" : "Healthy stock position"}
          label="Stock state"
          tone={detail.isLowStock ? "danger" : "accent"}
          value={detail.isLowStock ? "Low Stock" : "Safe"}
        />
      </div>


      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <div className="space-y-5">
          <SectionCard
            description="Batch-level visibility for practical stock control and refill decisions."
            title="Batch stock"
          >
            {detail.batches.length ? (
              <div className="space-y-4">
              <div className="grid gap-3 lg:hidden">
                {detail.batches.map((batch) => (
                  <article
                    className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                    key={batch.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {batch.batchNumber}
                        </p>
                        <p className="text-sm text-slate-600">
                          Expiry {formatDate(batch.expiryDate)}
                        </p>
                      </div>
                      <StatusBadge label={batch.status} />
                    </div>

                    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[
                        ["Available quantity", formatNumber(batch.quantityAvailable)],
                        ["Received quantity", formatNumber(batch.quantityReceived)],
                        ["Purchase rate", formatCurrency(batch.purchaseRate)],
                        ["Sale rate", formatCurrency(batch.saleRate)],
                        ["MRP", formatCurrency(batch.mrp)],
                        ["GST", `${batch.gstPercent}%`],
                      ].map(([label, value]) => (
                        <div
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                          key={label}
                        >
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {label}
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-900">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <button
                      className="mt-4 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                      onClick={() =>
                        setAdjustmentTarget({
                          medicineId: detail.medicine.id,
                          batchId: batch.id,
                        })
                      }
                      type="button"
                    >
                      Adjust this batch
                    </button>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-[1080px] w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <th className="px-4">Batch</th>
                      <th className="px-4">Expiry</th>
                      <th className="px-4">Available</th>
                      <th className="px-4">Received</th>
                      <th className="px-4">Purchase rate</th>
                      <th className="px-4">Sale rate</th>
                      <th className="px-4">MRP</th>
                      <th className="px-4">Status</th>
                      <th className="px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.batches.map((batch) => (
                      <tr className="rounded-3xl bg-slate-50" key={batch.id}>
                        <td className="rounded-l-3xl px-4 py-4 text-sm font-semibold text-slate-950">
                          {batch.batchNumber}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {formatDate(batch.expiryDate)}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-slate-950">
                          {formatNumber(batch.quantityAvailable)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {formatNumber(batch.quantityReceived)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {formatCurrency(batch.purchaseRate)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {formatCurrency(batch.saleRate)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {formatCurrency(batch.mrp)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge label={batch.status} />
                        </td>
                        <td className="rounded-r-3xl px-4 py-4 text-right">
                          <button
                            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                            onClick={() =>
                              setAdjustmentTarget({
                                medicineId: detail.medicine.id,
                                batchId: batch.id,
                              })
                            }
                            type="button"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
            ) : (
              <EmptyState
                description="This medicine does not have any stock batches yet. Finalize a purchase or add stock before expecting batch-level detail here."
                title="No batches available"
              />
            )}
          </SectionCard>

          <SectionCard
            description="Recent stock movements returned by the backend ledger for this medicine."
            title="Recent stock transactions"
          >
            {detail.recentTransactions.length ? (
              <div className="space-y-3">
                <div className="grid gap-3 lg:hidden">
                  {detail.recentTransactions.map((transaction) => (
                    <article
                      className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                      key={transaction.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <StatusBadge label={transaction.transactionType} />
                        <p className="text-sm text-slate-600">
                          {formatDateTime(transaction.createdAt)}
                        </p>
                      </div>
                      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                        {[
                          ["Batch", transaction.batch.batchNumber],
                          ["Quantity in", formatNumber(transaction.quantityIn)],
                          ["Quantity out", formatNumber(transaction.quantityOut)],
                          ["Balance after", formatNumber(transaction.balanceAfter)],
                          ["Reference", transaction.referenceType],
                          ["Notes", transaction.notes || "No notes"],
                        ].map(([label, value]) => (
                          <div
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                            key={label}
                          >
                            <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {label}
                            </dt>
                            <dd className="mt-1 text-sm font-medium text-slate-900">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="min-w-[1080px] w-full border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <th className="px-4">Type</th>
                        <th className="px-4">Batch</th>
                        <th className="px-4">Qty in</th>
                        <th className="px-4">Qty out</th>
                        <th className="px-4">Balance after</th>
                        <th className="px-4">Reference</th>
                        <th className="px-4">Created</th>
                        <th className="px-4">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.recentTransactions.map((transaction) => (
                        <tr className="rounded-3xl bg-slate-50" key={transaction.id}>
                          <td className="rounded-l-3xl px-4 py-4">
                            <StatusBadge label={transaction.transactionType} />
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {transaction.batch.batchNumber}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {formatNumber(transaction.quantityIn)}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {formatNumber(transaction.quantityOut)}
                          </td>
                          <td className="px-4 py-4 text-sm font-semibold text-slate-950">
                            {formatNumber(transaction.balanceAfter)}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {transaction.referenceType}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {formatDateTime(transaction.createdAt)}
                          </td>
                          <td className="rounded-r-3xl px-4 py-4 text-sm text-slate-700">
                            {transaction.notes || "No notes"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-600">
                No stock transactions have been recorded for this medicine yet.
              </p>
            )}
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard
            description="Master and stock positioning details for this medicine."
            title="Medicine summary"
          >
            <div className="space-y-3">
              {[
                ["Generic name", detail.medicine.genericName],
                ["Category", detail.category.name],
                ["Manufacturer", detail.manufacturer.name],
                ["Form / Unit", `${detail.medicine.form} / ${detail.medicine.unit}`],
              ].map(([label, value]) => (
                <div
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3"
                  key={label}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
                </div>
              ))}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Status
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge label={detail.medicine.status} />
                  <StatusBadge
                    label={detail.isLowStock ? "Low Stock" : "Safe"}
                    tone={detail.isLowStock ? "low_stock" : "safe"}
                  />
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <StockAdjustmentModal
        initialBatchId={adjustmentTarget?.batchId}
        initialMedicineId={adjustmentTarget?.medicineId}
        onClose={() => setAdjustmentTarget(undefined)}
        open={adjustmentTarget !== undefined}
      />
    </div>
  );
};
