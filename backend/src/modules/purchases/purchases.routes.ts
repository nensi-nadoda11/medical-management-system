import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requireAdmin } from "../../shared/http/require_admin";
import { requireAuth } from "../auth/auth.middleware";
import { PurchasesController } from "./purchases.controller";
import {
  cancelPurchaseSchema,
  createPurchaseSchema,
  finalizePurchaseSchema,
  getPurchaseByIdSchema,
  listPurchasesSchema,
  updateDraftPurchaseSchema,
} from "./purchases.validation";

const router = Router();
const controller = new PurchasesController();

router.get(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(listPurchasesSchema),
  controller.listPurchases,
);
router.get(
  "/:id",
  requireAuth,
  requireAdmin,
  validateRequest(getPurchaseByIdSchema),
  controller.getPurchaseById,
);
router.post(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(createPurchaseSchema),
  controller.createPurchase,
);
router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  validateRequest(updateDraftPurchaseSchema),
  controller.updateDraftPurchase,
);
router.post(
  "/:id/finalize",
  requireAuth,
  requireAdmin,
  validateRequest(finalizePurchaseSchema),
  controller.finalizePurchase,
);
router.post(
  "/:id/cancel",
  requireAuth,
  requireAdmin,
  validateRequest(cancelPurchaseSchema),
  controller.cancelPurchase,
);

export const purchasesRoutes = router;
