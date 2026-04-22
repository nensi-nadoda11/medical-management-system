import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      setMounted(true);
    });
  }, []);

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

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center p-4 sm:p-6 md:p-12">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl ring-1 ring-slate-900/5 ${panelClassName ?? ""}`}
      >
        <div className="flex-none flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {description ? (
              <p className="text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          <button
            className="flex-none rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className={`flex-1 overflow-y-auto px-6 py-6 ${bodyClassName ?? ""}`}>
          {children}
        </div>
        
        {footer ? (
          <div className="flex-none flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4 md:flex-row md:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
};
