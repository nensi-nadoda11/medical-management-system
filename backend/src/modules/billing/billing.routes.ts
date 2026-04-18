import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requireRoles } from "../../shared/http/require_roles";
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
  requireRoles("admin", "staff", "accountant"),
  validateRequest(listBillsSchema),
  controller.listBills,
);
router.get(
  "/medicines/search",
  requireAuth,
  requireRoles("admin", "staff", "accountant"),
  validateRequest(searchSellableMedicinesSchema),
  controller.searchSellableMedicines,
);
router.get(
  "/medicines/:medicineId/options",
  requireAuth,
  requireRoles("admin", "staff", "accountant"),
  validateRequest(getSellableMedicineOptionsSchema),
  controller.getSellableMedicineOptions,
);
router.get(
  "/:id",
  requireAuth,
  requireRoles("admin", "staff", "accountant"),
  validateRequest(getBillByIdSchema),
  controller.getBillById,
);
router.post(
  "/hold",
  requireAuth,
  requireRoles("admin", "staff"),
  validateRequest(createHeldBillSchema),
  controller.createHeldBill,
);
router.patch(
  "/:id/hold",
  requireAuth,
  requireRoles("admin", "staff"),
  validateRequest(updateHeldBillSchema),
  controller.updateHeldBill,
);
router.post(
  "/complete",
  requireAuth,
  requireRoles("admin", "staff"),
  validateRequest(createCompletedBillSchema),
  controller.createCompletedBill,
);
router.post(
  "/:id/complete",
  requireAuth,
  requireRoles("admin", "staff"),
  validateRequest(completeHeldBillSchema),
  controller.completeHeldBill,
);

export const billingRoutes = router;
