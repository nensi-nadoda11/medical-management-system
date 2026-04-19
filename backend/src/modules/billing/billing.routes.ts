import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requirePermission } from "../../shared/http/require_permission";
import { requireAuth } from "../auth/auth.middleware";
import { BillingController } from "./billing.controller";
import {
  completeHeldBillSchema,
  createCompletedBillSchema,
  createHeldBillSchema,
  getBillByIdSchema,
  getSellableMedicineOptionsSchema,
  listBillsSchema,
  searchSellableMedicinesSchema,
  updateHeldBillSchema,
} from "./billing.validation";

const router = Router();
const controller = new BillingController();

router.get(
  "/",
  requireAuth,
  requirePermission("billing.view"),
  validateRequest(listBillsSchema),
  controller.listBills,
);
router.get(
  "/medicines/search",
  requireAuth,
  requirePermission("billing.view"),
  validateRequest(searchSellableMedicinesSchema),
  controller.searchSellableMedicines,
);
router.get(
  "/medicines/:medicineId/options",
  requireAuth,
  requirePermission("billing.view"),
  validateRequest(getSellableMedicineOptionsSchema),
  controller.getSellableMedicineOptions,
);
router.get(
  "/:id",
  requireAuth,
  requirePermission("billing.view"),
  validateRequest(getBillByIdSchema),
  controller.getBillById,
);
router.post(
  "/hold",
  requireAuth,
  requirePermission("billing.create"),
  validateRequest(createHeldBillSchema),
  controller.createHeldBill,
);
router.patch(
  "/:id/hold",
  requireAuth,
  requirePermission("billing.create"),
  validateRequest(updateHeldBillSchema),
  controller.updateHeldBill,
);
router.post(
  "/complete",
  requireAuth,
  requirePermission("billing.complete"),
  validateRequest(createCompletedBillSchema),
  controller.createCompletedBill,
);
router.post(
  "/:id/complete",
  requireAuth,
  requirePermission("billing.complete"),
  validateRequest(completeHeldBillSchema),
  controller.completeHeldBill,
);

export const billingRoutes = router;
