import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";

interface Column<T> {
  header: string;
  accessor?: keyof T | ((item: T) => ReactNode);
  className?: string;
  headerClassName?: string;
}

interface ResponsiveDataListProps<T> {
  data: T[];
  columns: Column<T>[];
  renderCard: (item: T) => ReactNode;
  isLoading?: boolean;
  emptyState?: {
    title: string;
    description: string;
  };
  pagination?: ReactNode;
  rowClassName?: string;
  tableClassName?: string;
  keyExtractor: (item: T) => string | number;
}

export function ResponsiveDataList<T>({
  data,
  columns,
  renderCard,
  isLoading,
  emptyState,
  pagination,
  rowClassName = "rounded-[22px] bg-transparent",
  tableClassName = "min-w-[1080px] w-full border-separate border-spacing-y-2.5",
  keyExtractor,
}: ResponsiveDataListProps<T>) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Mobile Skeletons */}
        <div className="grid gap-3 xl:hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-[22px] border border-slate-100 bg-slate-50/50 p-4 h-48" />
          ))}
        </div>

        {/* Desktop Skeletons */}
        <div className="hidden overflow-x-auto xl:block">
          <table className={tableClassName}>
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {columns.map((col, i) => (
                  <th key={i} className={col.headerClassName || "px-4"}>{col.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse bg-slate-50/50">
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-8">
                      <div className="h-4 bg-slate-200 rounded w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <EmptyState
        title={emptyState?.title || "No data found"}
        description={emptyState?.description || "No records match your current criteria."}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile View */}
      <div className="grid gap-3 xl:hidden">
        {data.map((item) => (
          <div key={keyExtractor(item)}>{renderCard(item)}</div>
        ))}
      </div>

      {/* Desktop View */}
      <div className="hidden overflow-x-auto xl:block">
        <table className={tableClassName}>
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {columns.map((col, i) => (
                <th key={i} className={col.headerClassName || "px-4"}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr className={rowClassName} key={keyExtractor(item)}>
                {columns.map((col, i) => {
                  const content = col.accessor
                    ? typeof col.accessor === "function"
                      ? col.accessor(item)
                      : (item[col.accessor] as ReactNode)
                    : null;

                  return (
                    <td key={i} className={col.className || "px-4 py-4"}>
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && <div className="mt-4">{pagination}</div>}
    </div>
  );
}
