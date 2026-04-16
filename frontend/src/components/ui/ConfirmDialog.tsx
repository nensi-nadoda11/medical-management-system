import type { ReactNode } from "react";

import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  isLoading?: boolean;
  tone?: "danger" | "default";
  extraContent?: ReactNode;
}

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onClose,
  isLoading = false,
  tone = "default",
  extraContent,
}: ConfirmDialogProps) => (
  <Modal
    open={open}
    title={title}
    description={description}
    onClose={onClose}
    footer={
      <>
        <button
          className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          onClick={onClose}
          type="button"
        >
          {cancelLabel}
        </button>
        <button
          className={
            tone === "danger"
              ? "rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              : "rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          }
          disabled={isLoading}
          onClick={onConfirm}
          type="button"
        >
          {isLoading ? "Please wait..." : confirmLabel}
        </button>
      </>
    }
  >
    {extraContent}
  </Modal>
);
