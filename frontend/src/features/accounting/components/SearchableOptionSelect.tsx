import { useEffect, useMemo, useRef, useState } from "react";

type SearchableOption = {
  id: string;
  label: string;
};

interface SearchableOptionSelectProps {
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  value: string;
  options: SearchableOption[];
  search: string;
  isLoading?: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (value: string) => void;
}

const triggerClassName =
  "flex min-h-[46px] w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

const searchInputClassName =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100";

export const SearchableOptionSelect = ({
  placeholder,
  searchPlaceholder,
  emptyMessage,
  value,
  options,
  search,
  isLoading,
  onSearchChange,
  onSelect,
}: SearchableOptionSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const selectedOption = useMemo(
    () => options.find((item) => item.id === value) ?? null,
    [options, value],
  );

  return (
    <div className="text-sm font-medium text-slate-700" ref={rootRef}>
      <div className="relative">
        <button
          aria-expanded={isOpen}
          className={triggerClassName}
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <span className={selectedOption ? "text-slate-900" : "text-slate-400"}>
            {selectedOption?.label || placeholder}
          </span>
          <span className="text-base text-slate-400">{isOpen ? "\u2227" : "\u2228"}</span>
        </button>

        {isOpen ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-[24px] border border-slate-200 bg-white p-3 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)]">
            <input
              autoFocus
              className={searchInputClassName}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              value={search}
            />

            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Loading...
                </div>
              ) : options.length ? (
                options.map((item) => (
                  <button
                    className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                      item.id === value
                        ? "border-teal-200 bg-teal-50 text-teal-700"
                        : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    key={item.id}
                    onClick={() => {
                      onSelect(item.id);
                      setIsOpen(false);
                    }}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  {emptyMessage}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
