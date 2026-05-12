import { useState } from "react";

import { useToast } from "../../../hooks/use-toast";
import { cn } from "../../../lib/utils";
import type { DocumentKind, DocumentVariant } from "../../../types/document";
import {
  buildDocumentPreviewPath,
  downloadDocumentPdf,
} from "../api/documents";

interface DocumentActionGroupProps {
  kind: DocumentKind;
  id: string;
  compact?: boolean;
  showPreview?: boolean;
  previewVariant?: DocumentVariant;
  printVariant?: DocumentVariant;
  pdfVariant?: DocumentVariant;
  buttonClassName?: string;
}

const baseButtonClassName =
  "rounded-2xl border border-slate-200 bg-white font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50";

export const DocumentActionGroup = ({
  kind,
  id,
  compact = false,
  showPreview = true,
  previewVariant = "a4",
  printVariant = "a4",
  pdfVariant = "a4",
  buttonClassName,
}: DocumentActionGroupProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const { pushToast } = useToast();
  const sizeClassName = compact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showPreview ? (
        <a
          className={cn(baseButtonClassName, sizeClassName, buttonClassName)}
          href={buildDocumentPreviewPath(kind, id, { variant: previewVariant })}
          rel="noreferrer"
          target="_blank"
        >
          Preview
        </a>
      ) : null}
      <a
        className={cn(baseButtonClassName, sizeClassName, buttonClassName)}
        href={buildDocumentPreviewPath(kind, id, {
          variant: printVariant,
          autoprint: true,
        })}
        rel="noreferrer"
        target="_blank"
      >
        Print
      </a>
      <button
        className={cn(baseButtonClassName, sizeClassName, buttonClassName)}
        disabled={isDownloading}
        onClick={() => {
          setIsDownloading(true);
          void downloadDocumentPdf(kind, id, pdfVariant)
            .catch((error: Error) => {
              pushToast({
                title: "Unable to download PDF",
                description: error.message,
                variant: "error",
              });
            })
            .finally(() => setIsDownloading(false));
        }}
        type="button"
      >
        {isDownloading ? "Preparing..." : "PDF"}
      </button>
    </div>
  );
};
