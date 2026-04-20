import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requirePermission } from "../../shared/http/require_permission";
import { requireAuth } from "../auth/auth.middleware";
import { DocumentsController } from "./documents.controller";
import {
  downloadDocumentPdfSchema,
  getDocumentSchema,
} from "./documents.validation";

const router = Router();
const controller = new DocumentsController();

router.get(
  "/sales/:id",
  requireAuth,
  requirePermission("billing.view"),
  validateRequest(getDocumentSchema),
  controller.getSaleInvoice,
);
router.get(
  "/sales/:id/pdf",
  requireAuth,
  requirePermission("billing.view"),
  validateRequest(downloadDocumentPdfSchema),
  controller.downloadSaleInvoicePdf,
);

router.get(
  "/purchases/:id",
  requireAuth,
  requirePermission("purchases.view"),
  validateRequest(getDocumentSchema),
  controller.getPurchaseDocument,
);
router.get(
  "/purchases/:id/pdf",
  requireAuth,
  requirePermission("purchases.view"),
  validateRequest(downloadDocumentPdfSchema),
  controller.downloadPurchasePdf,
);

router.get(
  "/sales-returns/:id",
  requireAuth,
  requirePermission("billing.return"),
  validateRequest(getDocumentSchema),
  controller.getSaleReturnNote,
);
router.get(
  "/sales-returns/:id/pdf",
  requireAuth,
  requirePermission("billing.return"),
  validateRequest(downloadDocumentPdfSchema),
  controller.downloadSaleReturnPdf,
);

router.get(
  "/purchase-returns/:id",
  requireAuth,
  requirePermission("purchaseReturns.view"),
  validateRequest(getDocumentSchema),
  controller.getPurchaseReturnNote,
);
router.get(
  "/purchase-returns/:id/pdf",
  requireAuth,
  requirePermission("purchaseReturns.view"),
  validateRequest(downloadDocumentPdfSchema),
  controller.downloadPurchaseReturnPdf,
);

router.get(
  "/customer-payments/:id",
  requireAuth,
  requirePermission("payments.view"),
  validateRequest(getDocumentSchema),
  controller.getCustomerPaymentReceipt,
);
router.get(
  "/customer-payments/:id/pdf",
  requireAuth,
  requirePermission("payments.view"),
  validateRequest(downloadDocumentPdfSchema),
  controller.downloadCustomerPaymentReceiptPdf,
);

router.get(
  "/supplier-payments/:id",
  requireAuth,
  requirePermission("payments.view"),
  validateRequest(getDocumentSchema),
  controller.getSupplierPaymentReceipt,
);
router.get(
  "/supplier-payments/:id/pdf",
  requireAuth,
  requirePermission("payments.view"),
  validateRequest(downloadDocumentPdfSchema),
  controller.downloadSupplierPaymentReceiptPdf,
);

export const documentsRoutes = router;
