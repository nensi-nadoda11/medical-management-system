import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requirePermission } from "../../shared/http/require_permission";
import { requireAuth } from "../auth/auth.middleware";
import { PurchaseReturnsController } from "./purchase-returns.controller";
import {
  cancelPurchaseReturnSchema,
  completePurchaseReturnSchema,
  createPurchaseReturnSchema,
  getPurchaseReturnByIdSchema,
  getReturnablePurchaseSchema,
  listPurchaseReturnsSchema,
  updatePurchaseReturnSchema,
} from "./purchase-returns.validation";

const router = Router();
const controller = new PurchaseReturnsController();

router.get(
  "/",
  requireAuth,
  requirePermission("purchaseReturns.view"),
  validateRequest(listPurchaseReturnsSchema),
  controller.listPurchaseReturns,
);
router.get(
  "/purchases/:purchaseId/returnable",
  requireAuth,
  requirePermission("purchaseReturns.create"),
  validateRequest(getReturnablePurchaseSchema),
  controller.getReturnablePurchaseDetail,
);
router.get(
  "/:id",
  requireAuth,
  requirePermission("purchaseReturns.view"),
  validateRequest(getPurchaseReturnByIdSchema),
  controller.getPurchaseReturnById,
);
router.post(
  "/",
  requireAuth,
  requirePermission("purchaseReturns.create"),
  validateRequest(createPurchaseReturnSchema),
  controller.createDraftPurchaseReturn,
);
router.patch(
  "/:id",
  requireAuth,
  requirePermission("purchaseReturns.create"),
  validateRequest(updatePurchaseReturnSchema),
  controller.updateDraftPurchaseReturn,
);
router.post(
  "/:id/complete",
  requireAuth,
  requirePermission("purchaseReturns.complete"),
  validateRequest(completePurchaseReturnSchema),
  controller.completePurchaseReturn,
);
router.post(
  "/:id/cancel",
  requireAuth,
  requirePermission("purchaseReturns.complete"),
  validateRequest(cancelPurchaseReturnSchema),
  controller.cancelDraftPurchaseReturn,
);

export const purchaseReturnsRoutes = router;
