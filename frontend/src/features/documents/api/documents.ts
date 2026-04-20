import { apiRequest } from "../../../lib/api";
import { downloadApiFile } from "../../../lib/download";
import type {
  DocumentKind,
  DocumentVariant,
  GeneratedDocumentTemplate,
} from "../../../types/document";

const documentEndpointMap: Record<DocumentKind, string> = {
  "sale-invoice": "sales",
  purchase: "purchases",
  "sale-return": "sales-returns",
  "purchase-return": "purchase-returns",
  "customer-receipt": "customer-payments",
  "supplier-receipt": "supplier-payments",
};

const toEndpoint = (kind: DocumentKind) => documentEndpointMap[kind];

export const documentsQueryKeys = {
  all: ["documents"] as const,
  preview: (kind: DocumentKind, id: string, variant: DocumentVariant) =>
    [...documentsQueryKeys.all, "preview", kind, id, variant] as const,
};

export const isDocumentKind = (value?: string): value is DocumentKind =>
  Boolean(value && value in documentEndpointMap);

export const buildDocumentPreviewPath = (
  kind: DocumentKind,
  id: string,
  options?: {
    variant?: DocumentVariant;
    autoprint?: boolean;
  },
) => {
  const params = new URLSearchParams();

  if (options?.variant) {
    params.set("variant", options.variant);
  }

  if (options?.autoprint) {
    params.set("autoprint", "1");
  }

  const query = params.toString();
  return `/documents/${kind}/${id}${query ? `?${query}` : ""}`;
};

export const getDocumentPreview = (
  kind: DocumentKind,
  id: string,
  variant: DocumentVariant = "a4",
) =>
  apiRequest<GeneratedDocumentTemplate>({
    method: "GET",
    url: `/documents/${toEndpoint(kind)}/${id}`,
    params: { variant },
  });

export const downloadDocumentPdf = (
  kind: DocumentKind,
  id: string,
  variant: DocumentVariant = "a4",
) =>
  downloadApiFile(
    `/documents/${toEndpoint(kind)}/${id}/pdf`,
    { variant },
    `${kind}-${id}.pdf`,
  );

