import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requirePermission } from "../../shared/http/require_permission";
import { requireAuth } from "../auth/auth.middleware";
import { CustomersController } from "./customers.controller";
import {
  createCustomerPaymentSchema,
  createCustomerSchema,
  deleteCustomerSchema,
  getCustomerByIdSchema,
  listCustomerDueSummarySchema,
  listCustomerOptionsSchema,
  listCustomerPaymentsSchema,
  listCustomerPurchasesSchema,
  listCustomersSchema,
  updateCustomerSchema,
  updateCustomerStatusSchema,
} from "./customers.validation";

const router = Router();
const controller = new CustomersController();

router.get(
  "/",
  requireAuth,
  requirePermission("customers.view"),
  validateRequest(listCustomersSchema),
  controller.listCustomers,
);
router.get(
  "/options",
  requireAuth,
  requirePermission("customers.view"),
  validateRequest(listCustomerOptionsSchema),
  controller.listCustomerOptions,
);
router.get(
  "/due-summary",
  requireAuth,
  requirePermission("customers.view"),
  validateRequest(listCustomerDueSummarySchema),
  controller.listCustomerDueSummaries,
);
router.get(
  "/:id",
  requireAuth,
  requirePermission("customers.view"),
  validateRequest(getCustomerByIdSchema),
  controller.getCustomerById,
);
router.post(
  "/",
  requireAuth,
  requirePermission("customers.create"),
  validateRequest(createCustomerSchema),
  controller.createCustomer,
);
router.patch(
  "/:id",
  requireAuth,
  requirePermission("customers.edit"),
  validateRequest(updateCustomerSchema),
  controller.updateCustomer,
);
router.patch(
  "/:id/status",
  requireAuth,
  requirePermission("customers.edit"),
  validateRequest(updateCustomerStatusSchema),
  controller.updateCustomerStatus,
);
router.delete(
  "/:id",
  requireAuth,
  requirePermission("customers.edit"),
  validateRequest(deleteCustomerSchema),
  controller.deleteCustomer,
);
router.get(
  "/:id/purchases",
  requireAuth,
  requirePermission("customers.view"),
  validateRequest(listCustomerPurchasesSchema),
  controller.listCustomerPurchases,
);
router.get(
  "/:id/payments",
  requireAuth,
  requirePermission("payments.view"),
  validateRequest(listCustomerPaymentsSchema),
  controller.listCustomerPayments,
);
router.post(
  "/:id/payments",
  requireAuth,
  requirePermission("payments.create"),
  validateRequest(createCustomerPaymentSchema),
  controller.createCustomerPayment,
);

export const customersRoutes = router;
