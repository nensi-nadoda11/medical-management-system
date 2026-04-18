import { useEffect } from "react";
import type { PropsWithChildren, ReactNode } from "react";

interface ModalProps extends PropsWithChildren {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
  panelClassName?: string;
  bodyClassName?: string;
}

export const Modal = ({
  open,
  title,
  description,
  onClose,
  footer,
  panelClassName,
  bodyClassName,
  children,
}: ModalProps) => {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
      <div
        className={`flex max-h-[calc(100vh-2.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-950/15 ${panelClassName ?? ""}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
            {description ? (
              <p className="text-sm leading-6 text-slate-600">{description}</p>
            ) : null}
          </div>
          <button
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
        <div
          className={`min-h-0 flex-1 overflow-y-auto px-6 py-5 ${bodyClassName ?? ""}`}
        >
          {children}
        </div>
        {footer ? (
          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 md:flex-row md:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};
