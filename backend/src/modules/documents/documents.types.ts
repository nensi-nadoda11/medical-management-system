export type DocumentVariant = "a4" | "compact";

export type DocumentKind =
  | "sale_invoice"
  | "purchase_document"
  | "sale_return_note"
  | "purchase_return_note"
  | "customer_payment_receipt"
  | "supplier_payment_receipt";

export interface DocumentField {
  label: string;
  value: string;
  emphasis?: "default" | "strong";
}

export interface DocumentPartyBlock {
  title: string;
  lines: string[];
}

export interface DocumentTableColumn {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
}

export type DocumentTableRow = Record<string, string> & {
  id: string;
};

export interface GeneratedDocumentTemplate {
  kind: DocumentKind;
  variant: DocumentVariant;
  title: string;
  subtitle: string;
  documentNumber: string;
  pdfFileName: string;
  generatedAt: string;
  shop: {
    name: string;
    logoPlaceholder: string;
    addressLines: string[];
    contactLine?: string | undefined;
    complianceLine?: string | undefined;
  };
  badges: string[];
  metadata: DocumentField[];
  parties: DocumentPartyBlock[];
  table: {
    columns: DocumentTableColumn[];
    rows: DocumentTableRow[];
  };
  totals: DocumentField[];
  paymentSummary?: DocumentField[] | undefined;
  notes?: string[] | undefined;
  footerLines: string[];
}
