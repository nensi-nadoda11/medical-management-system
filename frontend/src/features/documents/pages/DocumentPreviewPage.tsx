import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { downloadDocumentPdf, documentsQueryKeys, getDocumentPreview, isDocumentKind } from "../api/documents";
import { DocumentPreview } from "../components/DocumentPreview";
import type { DocumentVariant } from "../../../types/document";

export const DocumentPreviewPage = () => {
  const { kind, id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasPrintedRef = useRef(false);
  const variant = (searchParams.get("variant") as DocumentVariant | null) ?? "a4";
  const shouldAutoPrint = searchParams.get("autoprint") === "1";
  const activeKind = isDocumentKind(kind) ? kind : null;

  useEffect(() => {
    const previousOverflowX = window.document.body.style.overflowX;
    const previousOverflowY = window.document.body.style.overflowY;
    window.document.body.style.overflowX = "auto";
    window.document.body.style.overflowY = "auto";

    return () => {
      window.document.body.style.overflowX = previousOverflowX;
      window.document.body.style.overflowY = previousOverflowY;
    };
  }, []);

  const documentQuery = useQuery({
    enabled: Boolean(activeKind && id),
    queryKey: activeKind && id ? documentsQueryKeys.preview(activeKind, id, variant) : ["documents", "invalid"],
    queryFn: () => getDocumentPreview(activeKind!, id!, variant),
  });

  useEffect(() => {
    if (!shouldAutoPrint || !documentQuery.data || hasPrintedRef.current) {
      return;
    }

    hasPrintedRef.current = true;
    window.setTimeout(() => window.print(), 220);
  }, [documentQuery.data, shouldAutoPrint]);

  if (!activeKind || !id) {
    return (
      <div className="document-page min-h-screen bg-slate-100 px-4 py-6">
        <ErrorState
          description="The requested document route is not supported."
          onRetry={() => navigate("/app")}
          title="Invalid document route"
        />
      </div>
    );
  }

  if (documentQuery.isLoading) {
    return (
      <div className="document-page min-h-screen bg-slate-100 px-4 py-6">
        <LoadingState title="Loading document preview" />
      </div>
    );
  }

  if (documentQuery.error) {
    return (
      <div className="document-page min-h-screen bg-slate-100 px-4 py-6">
        <ErrorState
          description={documentQuery.error.message}
          onRetry={() => documentQuery.refetch()}
          title="Unable to load document preview"
        />
      </div>
    );
  }

  const previewDocument = documentQuery.data;

  return (
    <div className="document-page min-h-screen bg-[linear-gradient(180deg,#eef5f7_0%,#f8fafc_100%)] px-3 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-[1120px] space-y-4">
        <div className="print-hidden flex flex-col gap-3 rounded-[26px] border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/70 md:flex-row md:items-center md:justify-between md:px-5">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-700">
              Document Preview
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-slate-950">
              {previewDocument?.title}
            </h1>
            <p className="text-sm text-slate-600">{previewDocument?.documentNumber}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => navigate(-1)}
              type="button"
            >
              Back
            </button>
            {activeKind === "sale-invoice" ? (
              <>
                <Link
                  className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                    variant === "a4"
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  to={`/documents/${activeKind}/${id}?variant=a4`}
                >
                  A4
                </Link>
                <Link
                  className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                    variant === "compact"
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  to={`/documents/${activeKind}/${id}?variant=compact`}
                >
                  Compact
                </Link>
              </>
            ) : null}
            <button
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => window.print()}
              type="button"
            >
              Print
            </button>
            <button
              className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => {
                void downloadDocumentPdf(activeKind, id, variant);
              }}
              type="button"
            >
              Download PDF
            </button>
          </div>
        </div>

        {previewDocument ? <DocumentPreview document={previewDocument} /> : null}
      </div>
    </div>
  );
};
