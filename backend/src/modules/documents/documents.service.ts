import { AppError } from "../../shared/errors/app-error";
import { collapseWhitespace } from "../../shared/utils/strings";
import { renderDocumentPdf } from "./documents.pdf";
import { DocumentsRepository } from "./documents.repository";
import type {
  DocumentVariant,
  GeneratedDocumentTemplate,
} from "./documents.types";

const buildAppError = (statusCode: number, code: string, message: string) =>
  new AppError({
    statusCode,
    code,
    message,
  });

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatCurrency = (value: string | number | null | undefined) =>
  currencyFormatter.format(Number(value ?? 0));

const formatDate = (value: Date | string | null | undefined) =>
  value ? dateFormatter.format(new Date(value)) : "Not available";

const formatDateTime = (value: Date | string | null | undefined) =>
  value ? dateTimeFormatter.format(new Date(value)) : "Not available";

const humanize = (value?: string | null) =>
  value
    ? collapseWhitespace(value.replace(/_/g, " ")).replace(/\b\w/g, (part) =>
        part.toUpperCase(),
      )
    : "Not available";

const sanitizeFileToken = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildPdfFileName = (prefix: string, number: string) =>
  `${sanitizeFileToken(prefix)}-${sanitizeFileToken(number)}.pdf`;

const buildPaymentReceiptNumber = (
  prefix: string,
  value: {
    id: string;
    createdAt: Date;
  },
) => {
  const date = new Date(value.createdAt);
  const dateToken = [
    date.getFullYear().toString(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");

  return `${prefix}-${dateToken}-${value.id.slice(0, 6).toUpperCase()}`;
};

const toLogoPlaceholder = (shopName: string) =>
  shopName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "MS";

const toAddressLines = (
  shop: NonNullable<Awaited<ReturnType<DocumentsRepository["findShopBranding"]>>>,
) => {
  const lines = [
    shop.addressLine1,
    shop.addressLine2,
    [shop.city, shop.state, shop.pincode].filter(Boolean).join(", "),
  ]
    .map((part) => collapseWhitespace(part ?? ""))
    .filter(Boolean);

  return lines.length ? lines : ["Address not configured"];
};

const toContactLine = (
  shop: NonNullable<Awaited<ReturnType<DocumentsRepository["findShopBranding"]>>>,
) => {
  const parts = [shop.phone, shop.email].filter(Boolean);
  return parts.length ? parts.join(" | ") : undefined;
};

const toComplianceLine = (
  shop: NonNullable<Awaited<ReturnType<DocumentsRepository["findShopBranding"]>>>,
) => {
  const parts = [
    shop.gstNumber ? `GST: ${shop.gstNumber}` : undefined,
    shop.licenseNumber ? `License: ${shop.licenseNumber}` : undefined,
  ].filter(Boolean);

  return parts.length ? parts.join(" | ") : undefined;
};

const buildBaseFooter = () => [
  "This document is system generated and reflects the live business record.",
  "Signature / stamp can be added where business policy requires it.",
];

const resolvePurchaseWorkflowStage = (purchase: {
  status: "draft" | "finalized" | "cancelled";
  purchaseOrderApprovedAt: Date | null;
  supplierNotifiedAt: Date | null;
}) => {
  if (purchase.status === "cancelled") {
    return "cancelled" as const;
  }

  if (purchase.status === "finalized") {
    return "received" as const;
  }

  if (purchase.supplierNotifiedAt) {
    return "supplier_notified" as const;
  }

  if (purchase.purchaseOrderApprovedAt) {
    return "approved" as const;
  }

  return "draft" as const;
};

const buildPurchaseDocumentConfig = (stage: ReturnType<typeof resolvePurchaseWorkflowStage>) => {
  if (stage === "received") {
    return {
      title: "Purchase Receipt",
      subtitle: "Received supplier purchase with batch and tax detail.",
      filePrefix: "purchase-receipt",
    };
  }

  if (stage === "supplier_notified") {
    return {
      title: "Supplier Purchase Order",
      subtitle: "Approved purchase order already shared with the supplier.",
      filePrefix: "supplier-purchase-order",
    };
  }

  if (stage === "approved") {
    return {
      title: "Approved Purchase Order",
      subtitle: "Approved purchase order awaiting supplier confirmation or stock receipt.",
      filePrefix: "approved-purchase-order",
    };
  }

  return {
    title: "Draft Purchase Order",
    subtitle: "Draft supplier purchase order ready for review, print, or supplier sharing.",
    filePrefix: "draft-purchase-order",
  };
};

export class DocumentsService {
  constructor(private readonly documentsRepository = new DocumentsRepository()) {}

  async getSaleInvoiceDocument(shopId: string, saleId: string, variant: DocumentVariant) {
    const [shop, record] = await Promise.all([
      this.documentsRepository.findShopBranding(shopId),
      this.documentsRepository.findSaleDocumentById(shopId, saleId),
    ]);

    if (!shop) {
      throw buildAppError(404, "SHOP_NOT_FOUND", "Shop not found.");
    }

    if (!record) {
      throw buildAppError(404, "SALE_NOT_FOUND", "Sale invoice not found.");
    }

    if (record.sale.status !== "completed") {
      throw buildAppError(
        400,
        "SALE_DOCUMENT_UNAVAILABLE",
        "Only completed sale invoices can be generated.",
      );
    }

    return {
      kind: "sale_invoice",
      variant,
      title: variant === "compact" ? "Invoice Bill" : "Sales Invoice",
      subtitle: "Completed sale document ready for print and PDF output.",
      documentNumber: record.sale.billNumber,
      pdfFileName: buildPdfFileName("invoice", record.sale.billNumber),
      generatedAt: `Generated on ${formatDateTime(new Date())}`,
      shop: {
        name: shop.name,
        logoPlaceholder: toLogoPlaceholder(shop.name),
        addressLines: toAddressLines(shop),
        contactLine: toContactLine(shop),
        complianceLine: toComplianceLine(shop),
      },
      badges: [humanize(record.sale.status), humanize(record.sale.paymentStatus)],
      metadata: [
        { label: "Invoice No", value: record.sale.billNumber, emphasis: "strong" },
        { label: "Invoice Date", value: formatDateTime(record.sale.completedAt) },
        { label: "Payment Method", value: humanize(record.sale.paymentMethod) },
        { label: "Billed By", value: record.createdBy.fullName },
      ],
      parties: [
        {
          title: "Customer",
          lines: [
            record.sale.customerName || "Walk-in customer",
            record.sale.customerPhone || "Phone not available",
          ],
        },
      ],
      table: {
        columns:
          variant === "compact"
            ? [
                { key: "item", label: "Item", widthRatio: 2.8 },
                { key: "quantity", label: "Qty", align: "center", widthRatio: 0.9 },
                { key: "rate", label: "Rate", align: "right", widthRatio: 1.1 },
                { key: "amount", label: "Amount", align: "right", widthRatio: 1.2 },
              ]
            : [
                { key: "item", label: "Item", widthRatio: 2.8 },
                { key: "batch", label: "Batch", widthRatio: 1.2 },
                { key: "expiry", label: "Expiry", align: "center", widthRatio: 1.1 },
                { key: "quantity", label: "Qty", align: "center", widthRatio: 0.8 },
                { key: "rate", label: "Rate", align: "right", widthRatio: 1.1 },
                { key: "tax", label: "Tax", align: "right", widthRatio: 0.8 },
                { key: "discount", label: "Discount", align: "right", widthRatio: 1.0 },
                { key: "amount", label: "Amount", align: "right", widthRatio: 1.2 },
              ],
        rows: record.items.map((entry) => ({
          id: entry.item.id,
          item:
            variant === "compact"
              ? `${entry.medicine.medicineName}\n${entry.batch.batchNumber}`
              : `${entry.medicine.medicineName}\n${entry.medicine.genericName}`,
          batch: entry.batch.batchNumber,
          expiry: formatDate(entry.batch.expiryDate),
          quantity: String(entry.item.quantity),
          rate: formatCurrency(entry.item.rate),
          tax: `${entry.item.gstPercent}%`,
          discount: `${entry.item.discountPercent}%`,
          amount: formatCurrency(entry.item.lineTotal),
        })),
      },
      totals: [
        { label: "Subtotal", value: formatCurrency(record.sale.subtotal) },
        { label: "Tax", value: formatCurrency(record.sale.taxAmount) },
        { label: "Discount", value: formatCurrency(record.sale.discountAmount) },
        { label: "Paid", value: formatCurrency(record.sale.paidAmount) },
      ],
      paymentSummary: [
        { label: "Payment Status", value: humanize(record.sale.paymentStatus) },
        { label: "Due Amount", value: formatCurrency(record.sale.dueAmount) },
      ],
      notes: record.sale.notes ? [record.sale.notes] : undefined,
      footerLines: [],
    } satisfies GeneratedDocumentTemplate;
  }

  async getPurchaseDocument(
    shopId: string,
    purchaseId: string,
    _variant: DocumentVariant,
  ) {
    const [shop, record] = await Promise.all([
      this.documentsRepository.findShopBranding(shopId),
      this.documentsRepository.findPurchaseDocumentById(shopId, purchaseId),
    ]);

    if (!shop) {
      throw buildAppError(404, "SHOP_NOT_FOUND", "Shop not found.");
    }

    if (!record) {
      throw buildAppError(404, "PURCHASE_NOT_FOUND", "Purchase not found.");
    }

    if (record.purchase.status === "cancelled") {
      throw buildAppError(
        400,
        "PURCHASE_DOCUMENT_UNAVAILABLE",
        "Cancelled purchase documents cannot be generated.",
      );
    }

    const workflowStage = resolvePurchaseWorkflowStage(record.purchase);
    const documentConfig = buildPurchaseDocumentConfig(workflowStage);

    return {
      kind: "purchase_document",
      variant: "a4",
      title: documentConfig.title,
      subtitle: documentConfig.subtitle,
      documentNumber: record.purchase.purchaseNumber,
      pdfFileName: buildPdfFileName(
        documentConfig.filePrefix,
        record.purchase.purchaseNumber,
      ),
      generatedAt: `Generated on ${formatDateTime(new Date())}`,
      shop: {
        name: shop.name,
        logoPlaceholder: toLogoPlaceholder(shop.name),
        addressLines: toAddressLines(shop),
        contactLine: toContactLine(shop),
        complianceLine: toComplianceLine(shop),
      },
      badges: [
        humanize(workflowStage),
        humanize(record.purchase.status),
        humanize(record.purchase.paymentStatus),
      ],
      metadata: [
        {
          label: "Purchase No",
          value: record.purchase.purchaseNumber,
          emphasis: "strong",
        },
        { label: "Purchase Date", value: formatDate(record.purchase.purchaseDate) },
        {
          label: "Supplier Invoice",
          value: record.purchase.supplierInvoiceNumber || "Not provided",
        },
        {
          label: "Invoice Date",
          value: formatDate(record.purchase.supplierInvoiceDate),
        },
      ],
      parties: [
        {
          title: "Supplier",
          lines: [
            record.supplier.supplierName,
            record.supplier.companyName || "Company not provided",
            record.supplier.mobileNumber,
            record.supplier.email || "Email not provided",
          ],
        },
        {
          title: "Recorded By",
          lines: [
            record.createdBy.fullName,
            humanize(record.createdBy.role),
            workflowStage === "received"
              ? `Received ${formatDateTime(record.purchase.finalizedAt)}`
              : workflowStage === "supplier_notified"
                ? `Supplier notified ${formatDateTime(record.purchase.supplierNotifiedAt)}`
                : workflowStage === "approved"
                  ? `Approved ${formatDateTime(record.purchase.purchaseOrderApprovedAt)}`
                  : `Drafted ${formatDateTime(record.purchase.createdAt)}`,
          ],
        },
      ],
      table: {
        columns: [
          { key: "item", label: "Item", widthRatio: 2.7 },
          { key: "batch", label: "Batch", widthRatio: 1.2 },
          { key: "expiry", label: "Expiry", align: "center", widthRatio: 1.1 },
          { key: "quantity", label: "Qty", align: "center", widthRatio: 0.8 },
          { key: "free", label: "Free", align: "center", widthRatio: 0.8 },
          { key: "rate", label: "Purchase", align: "right", widthRatio: 1.1 },
          { key: "tax", label: "Tax", align: "right", widthRatio: 0.8 },
          { key: "amount", label: "Amount", align: "right", widthRatio: 1.2 },
        ],
        rows: record.items.map((entry) => ({
          id: entry.item.id,
          item: `${entry.medicine.medicineName}\n${entry.medicine.genericName}`,
          batch: entry.item.batchNumber,
          expiry: formatDate(entry.item.expiryDate),
          quantity: String(entry.item.quantity),
          free: String(entry.item.freeQuantity),
          rate: formatCurrency(entry.item.purchaseRate),
          tax: `${entry.item.gstPercent}%`,
          amount: formatCurrency(entry.item.lineTotal),
        })),
      },
      totals: [
        { label: "Subtotal", value: formatCurrency(record.purchase.subtotal) },
        { label: "Discount", value: formatCurrency(record.purchase.discountAmount) },
        { label: "Tax", value: formatCurrency(record.purchase.taxAmount) },
        { label: "Round Off", value: formatCurrency(record.purchase.roundOffAmount) },
        { label: "Paid", value: formatCurrency(record.purchase.paidAmount) },
        {
          label: "Grand Total",
          value: formatCurrency(record.purchase.grandTotal),
          emphasis: "strong",
        },
      ],
      paymentSummary: [
        { label: "Payment Status", value: humanize(record.purchase.paymentStatus) },
        { label: "Due Amount", value: formatCurrency(record.purchase.dueAmount) },
      ],
      notes: record.purchase.notes ? [record.purchase.notes] : undefined,
      footerLines: buildBaseFooter(),
    } satisfies GeneratedDocumentTemplate;
  }

  async getSaleReturnDocument(
    shopId: string,
    returnId: string,
    _variant: DocumentVariant,
  ) {
    const [shop, record] = await Promise.all([
      this.documentsRepository.findShopBranding(shopId),
      this.documentsRepository.findSaleReturnDocumentById(shopId, returnId),
    ]);

    if (!shop) {
      throw buildAppError(404, "SHOP_NOT_FOUND", "Shop not found.");
    }

    if (!record) {
      throw buildAppError(404, "SALE_RETURN_NOT_FOUND", "Sales return not found.");
    }

    if (record.saleReturn.status !== "completed") {
      throw buildAppError(
        400,
        "SALE_RETURN_DOCUMENT_UNAVAILABLE",
        "Only completed sales returns can be generated.",
      );
    }

    const completedBy = record.saleReturn.completedByUserId
      ? await this.documentsRepository.findUserById(record.saleReturn.completedByUserId)
      : null;

    return {
      kind: "sale_return_note",
      variant: "a4",
      title: "Sales Return Note",
      subtitle: "Completed return note linked to the original sale invoice.",
      documentNumber: record.saleReturn.returnNumber,
      pdfFileName: buildPdfFileName("sales-return", record.saleReturn.returnNumber),
      generatedAt: `Generated on ${formatDateTime(new Date())}`,
      shop: {
        name: shop.name,
        logoPlaceholder: toLogoPlaceholder(shop.name),
        addressLines: toAddressLines(shop),
        contactLine: toContactLine(shop),
        complianceLine: toComplianceLine(shop),
      },
      badges: [humanize(record.saleReturn.status), humanize(record.saleReturn.refundStatus)],
      metadata: [
        {
          label: "Return No",
          value: record.saleReturn.returnNumber,
          emphasis: "strong",
        },
        { label: "Original Bill", value: record.sale.billNumber },
        { label: "Return Date", value: formatDateTime(record.saleReturn.completedAt) },
        {
          label: "Refund Method",
          value: record.saleReturn.refundMethod
            ? humanize(record.saleReturn.refundMethod)
            : "Not required",
        },
      ],
      parties: [
        {
          title: "Customer",
          lines: [
            record.sale.customerName || "Walk-in customer",
            record.sale.customerPhone || "Phone not available",
          ],
        },
        {
          title: "Processed By",
          lines: [
            completedBy?.fullName || record.createdBy.fullName,
            humanize(completedBy?.role || record.createdBy.role),
            `Refund ${formatCurrency(record.saleReturn.refundAmount)}`,
          ],
        },
      ],
      table: {
        columns: [
          { key: "item", label: "Item", widthRatio: 2.4 },
          { key: "batch", label: "Batch", widthRatio: 1.4 },
          { key: "sold", label: "Sold", align: "center", widthRatio: 0.8 },
          { key: "returned", label: "Returned", align: "center", widthRatio: 0.9 },
          { key: "rate", label: "Rate", align: "right", widthRatio: 1.0 },
          { key: "reason", label: "Reason", widthRatio: 1.8 },
          { key: "amount", label: "Amount", align: "right", widthRatio: 1.1 },
        ],
        rows: record.items.map((entry) => ({
          id: entry.item.id,
          item: `${entry.medicine.medicineName}\n${entry.medicine.genericName}`,
          batch: `${entry.batch.batchNumber}\n${formatDate(entry.batch.expiryDate)}`,
          sold: String(entry.saleItem.quantity),
          returned: String(entry.item.quantity),
          rate: formatCurrency(entry.item.rate),
          reason: entry.item.notes
            ? `${humanize(entry.item.reason)}\n${entry.item.notes}`
            : humanize(entry.item.reason),
          amount: formatCurrency(entry.item.lineReturnAmount),
        })),
      },
      totals: [
        {
          label: "Total Return Amount",
          value: formatCurrency(record.saleReturn.totalReturnAmount),
        },
        { label: "Refund Amount", value: formatCurrency(record.saleReturn.refundAmount) },
        {
          label: "Refund Status",
          value: humanize(record.saleReturn.refundStatus),
          emphasis: "strong",
        },
      ],
      notes: record.saleReturn.notes ? [record.saleReturn.notes] : undefined,
      footerLines: buildBaseFooter(),
    } satisfies GeneratedDocumentTemplate;
  }

  async getPurchaseReturnDocument(
    shopId: string,
    returnId: string,
    _variant: DocumentVariant,
  ) {
    const [shop, record] = await Promise.all([
      this.documentsRepository.findShopBranding(shopId),
      this.documentsRepository.findPurchaseReturnDocumentById(shopId, returnId),
    ]);

    if (!shop) {
      throw buildAppError(404, "SHOP_NOT_FOUND", "Shop not found.");
    }

    if (!record) {
      throw buildAppError(
        404,
        "PURCHASE_RETURN_NOT_FOUND",
        "Purchase return not found.",
      );
    }

    if (record.purchaseReturn.status !== "completed") {
      throw buildAppError(
        400,
        "PURCHASE_RETURN_DOCUMENT_UNAVAILABLE",
        "Only completed purchase returns can be generated.",
      );
    }

    const completedBy = record.purchaseReturn.completedByUserId
      ? await this.documentsRepository.findUserById(record.purchaseReturn.completedByUserId)
      : null;

    return {
      kind: "purchase_return_note",
      variant: "a4",
      title: "Purchase Return Note",
      subtitle: "Completed supplier return linked to the original purchase.",
      documentNumber: record.purchaseReturn.returnNumber,
      pdfFileName: buildPdfFileName(
        "purchase-return",
        record.purchaseReturn.returnNumber,
      ),
      generatedAt: `Generated on ${formatDateTime(new Date())}`,
      shop: {
        name: shop.name,
        logoPlaceholder: toLogoPlaceholder(shop.name),
        addressLines: toAddressLines(shop),
        contactLine: toContactLine(shop),
        complianceLine: toComplianceLine(shop),
      },
      badges: [humanize(record.purchaseReturn.status), humanize(record.purchase.paymentStatus)],
      metadata: [
        {
          label: "Return No",
          value: record.purchaseReturn.returnNumber,
          emphasis: "strong",
        },
        { label: "Purchase No", value: record.purchase.purchaseNumber },
        { label: "Return Date", value: formatDateTime(record.purchaseReturn.completedAt) },
        { label: "Purchase Date", value: formatDate(record.purchase.purchaseDate) },
      ],
      parties: [
        {
          title: "Supplier",
          lines: [
            record.supplier.supplierName,
            record.supplier.companyName || "Company not provided",
            record.supplier.mobileNumber,
            record.supplier.email || "Email not provided",
          ],
        },
        {
          title: "Processed By",
          lines: [
            completedBy?.fullName || record.createdBy.fullName,
            humanize(completedBy?.role || record.createdBy.role),
            `Amount ${formatCurrency(record.purchaseReturn.totalReturnAmount)}`,
          ],
        },
      ],
      table: {
        columns: [
          { key: "item", label: "Item", widthRatio: 2.4 },
          { key: "batch", label: "Batch", widthRatio: 1.4 },
          { key: "purchased", label: "Purchased", align: "center", widthRatio: 1.0 },
          { key: "returned", label: "Returned", align: "center", widthRatio: 0.9 },
          { key: "rate", label: "Rate", align: "right", widthRatio: 1.0 },
          { key: "reason", label: "Reason", widthRatio: 1.8 },
          { key: "amount", label: "Amount", align: "right", widthRatio: 1.1 },
        ],
        rows: record.items.map((entry) => ({
          id: entry.item.id,
          item: `${entry.medicine.medicineName}\n${entry.medicine.genericName}`,
          batch: `${entry.batch.batchNumber}\n${formatDate(entry.batch.expiryDate)}`,
          purchased: String(entry.purchaseItem.quantity),
          returned: String(entry.item.quantity),
          rate: formatCurrency(entry.item.purchaseRate),
          reason: entry.item.notes
            ? `${humanize(entry.item.reason)}\n${entry.item.notes}`
            : humanize(entry.item.reason),
          amount: formatCurrency(entry.item.lineReturnAmount),
        })),
      },
      totals: [
        {
          label: "Total Return Amount",
          value: formatCurrency(record.purchaseReturn.totalReturnAmount),
          emphasis: "strong",
        },
        { label: "Purchase Status", value: humanize(record.purchase.status) },
        { label: "Payment Status", value: humanize(record.purchase.paymentStatus) },
      ],
      notes: record.purchaseReturn.notes ? [record.purchaseReturn.notes] : undefined,
      footerLines: buildBaseFooter(),
    } satisfies GeneratedDocumentTemplate;
  }

  async getCustomerPaymentReceipt(
    shopId: string,
    paymentId: string,
    _variant: DocumentVariant,
  ) {
    const [shop, record] = await Promise.all([
      this.documentsRepository.findShopBranding(shopId),
      this.documentsRepository.findCustomerPaymentDocumentById(shopId, paymentId),
    ]);

    if (!shop) {
      throw buildAppError(404, "SHOP_NOT_FOUND", "Shop not found.");
    }

    if (!record) {
      throw buildAppError(
        404,
        "CUSTOMER_PAYMENT_NOT_FOUND",
        "Customer payment not found.",
      );
    }

    if (record.payment.status !== "completed") {
      throw buildAppError(
        400,
        "CUSTOMER_PAYMENT_DOCUMENT_UNAVAILABLE",
        "Only completed customer payments can be generated.",
      );
    }

    const receiptNumber = buildPaymentReceiptNumber("CR", {
      id: record.payment.id,
      createdAt: record.payment.createdAt,
    });
    const allocationRows = record.allocations.length
      ? record.allocations.map((entry) => ({
          id: entry.allocation.id,
          reference: entry.sale.billNumber,
          date: formatDate(entry.sale.completedAt),
          amount: formatCurrency(entry.allocation.amount),
          status: humanize(entry.sale.paymentStatus),
        }))
      : [
          {
            id: record.payment.id,
            reference: record.linkedSale?.billNumber || "Advance / general receipt",
            date: formatDate(record.linkedSale?.completedAt ?? record.payment.paymentDate),
            amount: formatCurrency(record.payment.amount),
            status: record.linkedSale
              ? humanize(record.linkedSale.paymentStatus)
              : "Advance",
          },
        ];

    return {
      kind: "customer_payment_receipt",
      variant: "a4",
      title: "Customer Payment Receipt",
      subtitle: "Receipt generated from completed customer payment data.",
      documentNumber: receiptNumber,
      pdfFileName: buildPdfFileName("customer-receipt", receiptNumber),
      generatedAt: `Generated on ${formatDateTime(new Date())}`,
      shop: {
        name: shop.name,
        logoPlaceholder: toLogoPlaceholder(shop.name),
        addressLines: toAddressLines(shop),
        contactLine: toContactLine(shop),
        complianceLine: toComplianceLine(shop),
      },
      badges: [humanize(record.payment.status), humanize(record.payment.paymentMethod)],
      metadata: [
        { label: "Receipt No", value: receiptNumber, emphasis: "strong" },
        { label: "Payment Date", value: formatDateTime(record.payment.paymentDate) },
        { label: "Amount", value: formatCurrency(record.payment.amount), emphasis: "strong" },
        { label: "Received By", value: record.receivedBy.fullName },
      ],
      parties: [
        {
          title: "Customer",
          lines: [
            record.customer.fullName,
            record.customer.customerCode,
            record.customer.mobileNumber,
            record.customer.email || "Email not provided",
          ],
        },
        {
          title: "Linked Sale",
          lines: [
            record.linkedSale?.billNumber || "Advance / multi-bill receipt",
            record.linkedSale?.completedAt
              ? formatDateTime(record.linkedSale.completedAt)
              : "No single linked bill",
          ],
        },
      ],
      table: {
        columns: [
          { key: "reference", label: "Bill Reference", widthRatio: 1.9 },
          { key: "date", label: "Bill Date", align: "center", widthRatio: 1.1 },
          { key: "status", label: "Status", align: "center", widthRatio: 1.0 },
          { key: "amount", label: "Allocated", align: "right", widthRatio: 1.1 },
        ],
        rows: allocationRows,
      },
      totals: [
        {
          label: "Received Amount",
          value: formatCurrency(record.payment.amount),
          emphasis: "strong",
        },
      ],
      paymentSummary: [
        { label: "Method", value: humanize(record.payment.paymentMethod) },
        { label: "Reference No", value: record.payment.referenceNumber || "Not provided" },
      ],
      notes: record.payment.notes ? [record.payment.notes] : undefined,
      footerLines: buildBaseFooter(),
    } satisfies GeneratedDocumentTemplate;
  }

  async getSupplierPaymentReceipt(
    shopId: string,
    paymentId: string,
    _variant: DocumentVariant,
  ) {
    const [shop, record] = await Promise.all([
      this.documentsRepository.findShopBranding(shopId),
      this.documentsRepository.findSupplierPaymentDocumentById(shopId, paymentId),
    ]);

    if (!shop) {
      throw buildAppError(404, "SHOP_NOT_FOUND", "Shop not found.");
    }

    if (!record) {
      throw buildAppError(
        404,
        "SUPPLIER_PAYMENT_NOT_FOUND",
        "Supplier payment not found.",
      );
    }

    if (record.payment.status !== "completed") {
      throw buildAppError(
        400,
        "SUPPLIER_PAYMENT_DOCUMENT_UNAVAILABLE",
        "Only completed supplier payments can be generated.",
      );
    }

    const receiptNumber = buildPaymentReceiptNumber("SR", {
      id: record.payment.id,
      createdAt: record.payment.createdAt,
    });
    const allocationRows = record.allocations.length
      ? record.allocations.map((entry) => ({
          id: entry.allocation.id,
          reference: entry.purchase.purchaseNumber,
          date: formatDate(entry.purchase.purchaseDate),
          amount: formatCurrency(entry.allocation.amount),
          status: humanize(entry.purchase.paymentStatus),
        }))
      : [
          {
            id: record.payment.id,
            reference:
              record.linkedPurchase?.purchaseNumber || "Advance / general payment",
            date: formatDate(
              record.linkedPurchase?.purchaseDate ?? record.payment.paymentDate,
            ),
            amount: formatCurrency(record.payment.amount),
            status: record.linkedPurchase
              ? humanize(record.linkedPurchase.paymentStatus)
              : "Advance",
          },
        ];

    return {
      kind: "supplier_payment_receipt",
      variant: "a4",
      title: "Supplier Payment Receipt",
      subtitle: "Receipt generated from completed supplier payment data.",
      documentNumber: receiptNumber,
      pdfFileName: buildPdfFileName("supplier-receipt", receiptNumber),
      generatedAt: `Generated on ${formatDateTime(new Date())}`,
      shop: {
        name: shop.name,
        logoPlaceholder: toLogoPlaceholder(shop.name),
        addressLines: toAddressLines(shop),
        contactLine: toContactLine(shop),
        complianceLine: toComplianceLine(shop),
      },
      badges: [humanize(record.payment.status), humanize(record.payment.paymentMethod)],
      metadata: [
        { label: "Receipt No", value: receiptNumber, emphasis: "strong" },
        { label: "Payment Date", value: formatDateTime(record.payment.paymentDate) },
        { label: "Amount", value: formatCurrency(record.payment.amount), emphasis: "strong" },
        { label: "Recorded By", value: record.paidBy.fullName },
      ],
      parties: [
        {
          title: "Supplier",
          lines: [
            record.supplier.supplierName,
            record.supplier.companyName || "Company not provided",
            record.supplier.mobileNumber,
            record.supplier.email || "Email not provided",
          ],
        },
        {
          title: "Linked Purchase",
          lines: [
            record.linkedPurchase?.purchaseNumber || "Advance / multi-purchase payment",
            record.linkedPurchase?.purchaseDate
              ? formatDate(record.linkedPurchase.purchaseDate)
              : "No single linked purchase",
          ],
        },
      ],
      table: {
        columns: [
          { key: "reference", label: "Purchase Reference", widthRatio: 1.9 },
          { key: "date", label: "Purchase Date", align: "center", widthRatio: 1.1 },
          { key: "status", label: "Status", align: "center", widthRatio: 1.0 },
          { key: "amount", label: "Allocated", align: "right", widthRatio: 1.1 },
        ],
        rows: allocationRows,
      },
      totals: [
        {
          label: "Paid Amount",
          value: formatCurrency(record.payment.amount),
          emphasis: "strong",
        },
      ],
      paymentSummary: [
        { label: "Method", value: humanize(record.payment.paymentMethod) },
        { label: "Reference No", value: record.payment.referenceNumber || "Not provided" },
      ],
      notes: record.payment.notes ? [record.payment.notes] : undefined,
      footerLines: buildBaseFooter(),
    } satisfies GeneratedDocumentTemplate;
  }

  async getDocumentPdf(template: GeneratedDocumentTemplate) {
    return renderDocumentPdf(template);
  }

  async getSaleInvoicePdf(shopId: string, saleId: string, variant: DocumentVariant) {
    const template = await this.getSaleInvoiceDocument(shopId, saleId, variant);
    return {
      fileName: template.pdfFileName,
      buffer: await this.getDocumentPdf(template),
    };
  }

  async getPurchasePdf(shopId: string, purchaseId: string, variant: DocumentVariant) {
    const template = await this.getPurchaseDocument(shopId, purchaseId, variant);
    return {
      fileName: template.pdfFileName,
      buffer: await this.getDocumentPdf(template),
    };
  }

  async getSaleReturnPdf(shopId: string, returnId: string, variant: DocumentVariant) {
    const template = await this.getSaleReturnDocument(shopId, returnId, variant);
    return {
      fileName: template.pdfFileName,
      buffer: await this.getDocumentPdf(template),
    };
  }

  async getPurchaseReturnPdf(
    shopId: string,
    returnId: string,
    variant: DocumentVariant,
  ) {
    const template = await this.getPurchaseReturnDocument(shopId, returnId, variant);
    return {
      fileName: template.pdfFileName,
      buffer: await this.getDocumentPdf(template),
    };
  }

  async getCustomerPaymentReceiptPdf(
    shopId: string,
    paymentId: string,
    variant: DocumentVariant,
  ) {
    const template = await this.getCustomerPaymentReceipt(shopId, paymentId, variant);
    return {
      fileName: template.pdfFileName,
      buffer: await this.getDocumentPdf(template),
    };
  }

  async getSupplierPaymentReceiptPdf(
    shopId: string,
    paymentId: string,
    variant: DocumentVariant,
  ) {
    const template = await this.getSupplierPaymentReceipt(shopId, paymentId, variant);
    return {
      fileName: template.pdfFileName,
      buffer: await this.getDocumentPdf(template),
    };
  }
}
