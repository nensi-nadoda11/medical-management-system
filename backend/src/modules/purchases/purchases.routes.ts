import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requireAuth } from "../auth/auth.middleware";
import { requirePermission } from "../../shared/http/require_permission";
import { PurchasesController } from "./purchases.controller";
import {
  approvePurchaseOrderSchema,
  cancelPurchaseSchema,
  createPurchaseSchema,
  finalizePurchaseSchema,
  getPurchaseByIdSchema,
  listPurchasesSchema,
  markPurchaseOrderSupplierNotifiedSchema,
  updateDraftPurchaseSchema,
} from "./purchases.validation";

const router = Router();
const controller = new PurchasesController();

router.get(
  "/",
  requireAuth,
  requirePermission("purchases.view"),
  validateRequest(listPurchasesSchema),
  controller.listPurchases,
);
router.get(
  "/:id",
  requireAuth,
  requirePermission("purchases.view"),
  validateRequest(getPurchaseByIdSchema),
  controller.getPurchaseById,
);
router.post(
  "/",
  requireAuth,
  requirePermission("purchases.create"),
  validateRequest(createPurchaseSchema),
  controller.createPurchase,
);
router.patch(
  "/:id",
  requireAuth,
  requirePermission("purchases.create"),
  validateRequest(updateDraftPurchaseSchema),
  controller.updateDraftPurchase,
);
router.post(
  "/:id/approve",
  requireAuth,
  requirePermission("purchases.finalize"),
  validateRequest(approvePurchaseOrderSchema),
  controller.approvePurchaseOrder,
);
router.post(
  "/:id/mark-supplier-notified",
  requireAuth,
  requirePermission("purchases.finalize"),
  validateRequest(markPurchaseOrderSupplierNotifiedSchema),
  controller.markPurchaseOrderSupplierNotified,
);
router.post(
  "/:id/finalize",
  requireAuth,
  requirePermission("purchases.finalize"),
  validateRequest(finalizePurchaseSchema),
  controller.finalizePurchase,
);
router.post(
  "/:id/cancel",
  requireAuth,
  requirePermission("purchases.finalize"),
  validateRequest(cancelPurchaseSchema),
  controller.cancelPurchase,
);
router.delete(
  "/:id",
  requireAuth,
  validateRequest(getPurchaseByIdSchema),
  controller.deletePurchase,
);

export const purchasesRoutes = router;
