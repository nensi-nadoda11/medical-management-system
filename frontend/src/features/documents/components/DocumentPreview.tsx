import { cn } from "../../../lib/utils";
import type { GeneratedDocumentTemplate } from "../../../types/document";

interface DocumentPreviewProps {
  document: GeneratedDocumentTemplate;
}

const alignClassName = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

const invoiceTotalLabels = new Set(["Subtotal", "Discount", "Tax", "Paid"]);
const invoiceTotalOrder = new Map([
  ["Subtotal", 0],
  ["Tax", 1],
  ["Discount", 2],
  ["Paid", 3],
]);

const orderInvoiceTotals = (fields: GeneratedDocumentTemplate["totals"]) =>
  [...fields].sort(
    (left, right) =>
      (invoiceTotalOrder.get(left.label) ?? Number.MAX_SAFE_INTEGER) -
      (invoiceTotalOrder.get(right.label) ?? Number.MAX_SAFE_INTEGER),
  );

export const DocumentPreview = ({ document }: DocumentPreviewProps) => {
  const isSaleInvoiceA4 =
    document.kind === "sale_invoice" && document.variant === "a4";
  const isCompact = document.variant === "compact";
  const customerParty = isSaleInvoiceA4
    ? document.parties.find((party) => party.title.toLowerCase() === "customer")
    : null;
  const remainingParties = customerParty
    ? document.parties.filter((party) => party !== customerParty)
    : document.parties;
  const visibleTotals = isSaleInvoiceA4
    ? orderInvoiceTotals(
        document.totals.filter((field) => invoiceTotalLabels.has(field.label)),
      )
    : document.totals;
  const shouldRenderFooter = document.footerLines.length > 0 && !isSaleInvoiceA4;

  return (
    <div
      className={cn(
        "document-sheet rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_90px_-48px_rgba(15,23,42,0.45)]",
        isSaleInvoiceA4 && "sale-invoice-document",
        isCompact ? "document-sheet--compact mx-auto max-w-[380px]" : "max-w-[980px]",
      )}
    >
      <div className="sale-invoice-document__hero rounded-t-[28px] bg-[linear-gradient(135deg,#115e59,#134e4a)] px-5 py-5 text-white md:px-8 md:py-7">
        <div
          className={cn(
            "flex flex-col gap-4",
            isCompact ? "items-start" : "md:flex-row md:items-start md:justify-between",
          )}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-lg font-semibold tracking-[0.18em] text-white">
              {document.shop.logoPlaceholder}
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                {document.title}
              </h1>
              <p
                className={cn(
                  "sale-invoice-document__subtitle max-w-xl text-sm leading-6 text-teal-50/90",
                  isSaleInvoiceA4 && "print:hidden",
                )}
              >
                {document.subtitle}
              </p>
              <div className="space-y-1 text-sm text-teal-50/85">
                <p className="font-medium text-white">{document.shop.name}</p>
                {document.shop.addressLines.map((line) => (
                  <p className={cn(isSaleInvoiceA4 && "print:hidden")} key={line}>
                    {line}
                  </p>
                ))}
                {document.shop.contactLine ? <p>{document.shop.contactLine}</p> : null}
                {document.shop.complianceLine ? (
                  <p className={cn(isSaleInvoiceA4 && "print:hidden")}>
                    {document.shop.complianceLine}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className={cn("space-y-2", !isCompact && "md:text-right")}>
            <p className="text-sm font-semibold tracking-[0.18em] text-teal-100">
              {document.documentNumber}
            </p>
            <div className={cn("flex flex-wrap gap-2", !isCompact && "md:justify-end")}>
              {document.badges.map((badge) => (
                <span
                  className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
                  key={badge}
                >
                  {badge}
                </span>
              ))}
            </div>
            <p
              className={cn(
                "sale-invoice-document__generated text-xs text-teal-100/90",
                isSaleInvoiceA4 && "print:hidden",
              )}
            >
              {document.generatedAt}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-4 py-5 md:px-8 md:py-7 print:space-y-4 print:px-6 print:py-5">
        {customerParty ? (
          <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-100 print:px-4 print:py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
              {customerParty.title}
            </p>
            <div className="mt-2 space-y-1.5 text-sm leading-6 text-slate-700">
              {customerParty.lines.map((line) => (
                <p className="whitespace-pre-line" key={line}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "sale-invoice-document__meta grid gap-3",
            document.variant === "compact" ? "grid-cols-1" : "md:grid-cols-2",
          )}
        >
          {document.metadata.map((field) => (
            <div
              className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 print:px-4 print:py-2.5"
              key={field.label}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {field.label}
              </p>
              <p
                className={cn(
                  "mt-1.5 text-sm text-slate-900",
                  field.emphasis === "strong" ? "font-semibold" : "font-medium",
                )}
              >
                {field.value}
              </p>
            </div>
          ))}
        </div>

        {remainingParties.length ? (
          <div
            className={cn(
              "grid gap-3",
              document.variant === "compact" || remainingParties.length === 1
                ? "grid-cols-1"
                : "md:grid-cols-2",
            )}
          >
            {remainingParties.map((party) => (
              <div
                className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-100"
                key={party.title}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                  {party.title}
                </p>
                <div className="mt-2 space-y-1.5 text-sm leading-6 text-slate-700">
                  {party.lines.map((line) => (
                    <p className="whitespace-pre-line" key={line}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="sale-invoice-document__table space-y-4">
          <div className="hidden overflow-x-auto md:block print:block">
            <table className="min-w-full border-separate border-spacing-y-3 print:border-spacing-y-2">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {document.table.columns.map((column) => (
                    <th className="px-4 print:px-3" key={column.key}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {document.table.rows.map((row) => (
                  <tr className="rounded-3xl bg-slate-50" key={row.id}>
                    {document.table.columns.map((column, index) => (
                      <td
                        className={cn(
                          "px-4 py-4 text-sm whitespace-pre-line text-slate-700 print:px-3 print:py-2.5 print:text-[12px]",
                          alignClassName[column.align ?? "left"],
                          index === 0 && "rounded-l-3xl",
                          index === document.table.columns.length - 1 &&
                            "rounded-r-3xl font-semibold text-slate-950",
                        )}
                        key={column.key}
                      >
                        {row[column.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden print:hidden">
            {document.table.rows.map((row) => (
              <article
                className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                key={row.id}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {document.table.columns.map((column) => (
                    <div
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                      key={column.key}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {column.label}
                      </p>
                      <p
                        className={cn(
                          "mt-1 whitespace-pre-line text-sm text-slate-900",
                          column.key === document.table.columns.at(-1)?.key
                            ? "font-semibold"
                            : "font-medium",
                        )}
                      >
                        {row[column.key]}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div
          className={cn(
            "sale-invoice-document__summary grid gap-4",
            isCompact
              ? "grid-cols-1"
              : isSaleInvoiceA4
              ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
              : "lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.44fr)]",
          )}
        >
          <div className="space-y-4">
            {document.notes?.length ? (
              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-100">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                  Notes
                </p>
                <div className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                  {document.notes.map((note) => (
                    <p className="whitespace-pre-line" key={note}>
                      {note}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {document.paymentSummary?.length ? (
              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-100 print:px-4 print:py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                  Payment Summary
                </p>
                <div
                  className={cn(
                    "mt-3 space-y-2.5",
                    isSaleInvoiceA4 && "sale-invoice-document__payment-grid grid gap-2.5 space-y-0 sm:grid-cols-2",
                  )}
                >
                  {document.paymentSummary.map((field) => (
                    <div
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700 print:px-3 print:py-2.5"
                      key={field.label}
                    >
                      <span>{field.label}</span>
                      <span className="font-semibold text-slate-950">{field.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {shouldRenderFooter ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Footer
                </p>
                <div className="mt-2 space-y-1.5 text-sm leading-6 text-slate-700">
                  {document.footerLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 print:px-4 print:py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Totals
            </p>
            <div
              className={cn(
                "mt-3 space-y-2.5",
                isSaleInvoiceA4 &&
                  "sale-invoice-document__totals-grid grid grid-cols-2 gap-2.5 space-y-0",
              )}
            >
              {visibleTotals.map((field) => (
                <div
                  className={cn(
                    "flex items-center justify-between rounded-2xl px-3.5 py-3 text-sm print:px-3 print:py-2.5",
                    isSaleInvoiceA4
                      ? "border border-slate-200 bg-white text-slate-700"
                      : field.emphasis === "strong"
                        ? "bg-slate-950 text-white"
                        : "border border-slate-200 bg-white text-slate-700",
                  )}
                  key={field.label}
                >
                  <span>{field.label}</span>
                  <span className="font-semibold">{field.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
