import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requirePermission } from "../../shared/http/require_permission";
import { requireAuth } from "../auth/auth.middleware";
import { AccountingController } from "./accounting.controller";
import {
  createCustomerPaymentSchema,
  createSupplierPaymentSchema,
  getCustomerDueSummarySchema,
  getCustomerLedgerSchema,
  getSupplierDueSummarySchema,
  getSupplierLedgerSchema,
  listCustomerPaymentsSchema,
  listOutstandingCustomersSchema,
  listOutstandingSuppliersSchema,
  listSupplierOptionsSchema,
  listSupplierPaymentsSchema,
} from "./accounting.validation";

const router = Router();
const controller = new AccountingController();

router.get(
  "/customers/payments",
  requireAuth,
  requirePermission("payments.view"),
  validateRequest(listCustomerPaymentsSchema),
  controller.listCustomerPayments,
);
router.post(
  "/customers/payments",
  requireAuth,
  requirePermission("payments.create"),
  validateRequest(createCustomerPaymentSchema),
  controller.createCustomerPayment,
);
router.get(
  "/customers/outstanding",
  requireAuth,
  requirePermission("payments.view"),
  validateRequest(listOutstandingCustomersSchema),
  controller.listOutstandingCustomers,
);
router.get(
  "/customers/:customerId/summary",
  requireAuth,
  requirePermission("payments.view"),
  validateRequest(getCustomerDueSummarySchema),
  controller.getCustomerDueSummary,
);
router.get(
  "/customers/:customerId/ledger",
  requireAuth,
  requirePermission("payments.view"),
  validateRequest(getCustomerLedgerSchema),
  controller.getCustomerLedger,
);

router.get(
  "/suppliers/options",
  requireAuth,
  requirePermission("payments.view"),
  validateRequest(listSupplierOptionsSchema),
  controller.listSupplierOptions,
);
router.get(
  "/suppliers/payments",
  requireAuth,
  requirePermission("payments.view"),
  validateRequest(listSupplierPaymentsSchema),
  controller.listSupplierPayments,
);
router.post(
  "/suppliers/payments",
  requireAuth,
  requirePermission("payments.create"),
  validateRequest(createSupplierPaymentSchema),
  controller.createSupplierPayment,
);
router.get(
  "/suppliers/outstanding",
  requireAuth,
  requirePermission("payments.view"),
  validateRequest(listOutstandingSuppliersSchema),
  controller.listOutstandingSuppliers,
);
router.get(
  "/suppliers/:supplierId/summary",
  requireAuth,
  requirePermission("payments.view"),
  validateRequest(getSupplierDueSummarySchema),
  controller.getSupplierDueSummary,
);
router.get(
  "/suppliers/:supplierId/ledger",
  requireAuth,
  requirePermission("payments.view"),
  validateRequest(getSupplierLedgerSchema),
  controller.getSupplierLedger,
);

export const accountingRoutes = router;
