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
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <div
        className={`w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-950/10 ${panelClassName ?? ""}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
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
        <div className={`max-h-[70vh] overflow-y-auto px-6 py-5 ${bodyClassName ?? ""}`}>
          {children}
        </div>
        {footer ? (
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 md:flex-row md:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};
