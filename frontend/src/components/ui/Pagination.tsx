interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const Pagination = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationProps) => {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        Showing {start}-{end} of {totalItems}
      </p>

      <div className="flex items-center gap-2">
        <button
          className="ui-btn ui-btn--secondary !min-h-[2.4rem] !px-4 !py-2"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          Previous
        </button>
        <span className="rounded-[18px] border border-slate-200/80 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-200/40">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <button
          className="ui-btn ui-btn--secondary !min-h-[2.4rem] !px-4 !py-2"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
};
