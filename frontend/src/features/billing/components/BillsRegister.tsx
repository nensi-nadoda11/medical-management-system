import { Link } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatCurrency, formatDateTime } from "../../../lib/utils";
import type { BillListItem } from "../../../types/billing";
import type { PaginationMeta } from "../../../types/common";

interface BillsRegisterProps {
  bills: BillListItem[];
  pagination?: PaginationMeta;
  onPageChange: (page: number) => void;
  emptyTitle: string;
  emptyDescription: string;
  canOpenInPos: boolean;
}

export const BillsRegister = ({
  bills,
  pagination,
  onPageChange,
  emptyTitle,
  emptyDescription,
  canOpenInPos,
}: BillsRegisterProps) => {
  if (!bills.length) {
    return <EmptyState description={emptyDescription} title={emptyTitle} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 xl:hidden">
        {bills.map((bill) => (
          <article
            className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
            key={bill.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-950">
                    {bill.billNumber}
                  </h3>
                  <StatusBadge label={bill.status} />
                  <StatusBadge label={bill.paymentStatus} />
                </div>
                <p className="mt-1 text-sm text-slate-600">{bill.customerLabel}</p>
              </div>
              <p className="text-base font-semibold text-slate-950">
                {formatCurrency(bill.grandTotal)}
              </p>
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["Created", formatDateTime(bill.createdAt)],
                ["Completed", formatDateTime(bill.completedAt)],
                ["Payment", bill.paymentMethod.toUpperCase()],
                ["Due", formatCurrency(bill.dueAmount)],
                ["Created by", bill.createdBy.fullName],
                ["Phone", bill.customerPhone || "Not provided"],
              ].map(([label, value]) => (
                <div
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                  key={label}
                >
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                to={`/app/billing/${bill.id}`}
              >
                View
              </Link>
              {canOpenInPos && bill.status === "held" ? (
                <Link
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  to={`/app/billing?heldBillId=${bill.id}`}
                >
                  Open in POS
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto xl:block">
        <table className="min-w-[1180px] w-full border-separate border-spacing-y-3">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <th className="px-4">Bill</th>
              <th className="px-4">Customer</th>
              <th className="px-4">Status</th>
              <th className="px-4">Payment</th>
              <th className="px-4">Amount</th>
              <th className="px-4">Created / Completed</th>
              <th className="px-4">Operator</th>
              <th className="px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr className="rounded-3xl bg-slate-50" key={bill.id}>
                <td className="rounded-l-3xl px-4 py-4">
                  <div>
                    <p className="font-semibold text-slate-950">{bill.billNumber}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {bill.customerPhone || "Walk-in billing"}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">
                  <div>
                    <p className="font-medium text-slate-900">{bill.customerLabel}</p>
                    <p className="mt-1 text-slate-600">{bill.notes || "No notes"}</p>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge label={bill.status} />
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">
                  <div className="space-y-2">
                    <StatusBadge label={bill.paymentStatus} />
                    <p className="text-slate-600">{bill.paymentMethod.toUpperCase()}</p>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-950">
                    {formatCurrency(bill.grandTotal)}
                  </p>
                  <p className="mt-1 text-slate-600">
                    Due {formatCurrency(bill.dueAmount)}
                  </p>
                </td>
                <td className="px-4 py-4 text-sm text-slate-600">
                  <p>{formatDateTime(bill.createdAt)}</p>
                  <p className="mt-1">
                    {bill.completedAt ? formatDateTime(bill.completedAt) : "Pending"}
                  </p>
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">{bill.createdBy.fullName}</p>
                  <p className="mt-1 text-slate-600">{bill.createdBy.role}</p>
                </td>
                <td className="rounded-r-3xl px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <Link
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                      to={`/app/billing/${bill.id}`}
                    >
                      View
                    </Link>
                    {canOpenInPos && bill.status === "held" ? (
                      <Link
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                        to={`/app/billing?heldBillId=${bill.id}`}
                      >
                        Open in POS
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination ? (
        <Pagination
          onPageChange={onPageChange}
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalItems={pagination.total}
          totalPages={pagination.totalPages}
        />
      ) : null}
    </div>
  );
};
