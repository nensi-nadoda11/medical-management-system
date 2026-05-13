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
  isConfirmDisabled?: boolean;
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
  isConfirmDisabled = false,
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
          className="ui-btn ui-btn--secondary"
          onClick={onClose}
          type="button"
        >
          {cancelLabel}
        </button>
        <button
          className={tone === "danger" ? "ui-btn ui-btn--danger" : "ui-btn ui-btn--primary"}
          disabled={isLoading || isConfirmDisabled}
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
