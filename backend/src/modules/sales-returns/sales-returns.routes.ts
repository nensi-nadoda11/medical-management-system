import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requirePermission } from "../../shared/http/require_permission";
import { requireAuth } from "../auth/auth.middleware";
import { SalesReturnsController } from "./sales-returns.controller";
import {
  cancelSalesReturnSchema,
  completeSalesReturnSchema,
  createSalesReturnSchema,
  getReturnableSaleSchema,
  getSalesReturnByIdSchema,
  listSalesReturnsSchema,
  updateSalesReturnSchema,
} from "./sales-returns.validation";

const router = Router();
const controller = new SalesReturnsController();

router.get(
  "/",
  requireAuth,
  requirePermission("billing.return"),
  validateRequest(listSalesReturnsSchema),
  controller.listSalesReturns,
);
router.get(
  "/sales/:saleId/returnable",
  requireAuth,
  requirePermission("billing.return"),
  validateRequest(getReturnableSaleSchema),
  controller.getReturnableSaleDetail,
);
router.get(
  "/:id",
  requireAuth,
  requirePermission("billing.return"),
  validateRequest(getSalesReturnByIdSchema),
  controller.getSalesReturnById,
);
router.post(
  "/",
  requireAuth,
  requirePermission("billing.return"),
  validateRequest(createSalesReturnSchema),
  controller.createDraftSalesReturn,
);
router.patch(
  "/:id",
  requireAuth,
  requirePermission("billing.return"),
  validateRequest(updateSalesReturnSchema),
  controller.updateDraftSalesReturn,
);
router.post(
  "/:id/complete",
  requireAuth,
  requirePermission("billing.return"),
  validateRequest(completeSalesReturnSchema),
  controller.completeSalesReturn,
);
router.post(
  "/:id/cancel",
  requireAuth,
  requirePermission("billing.return"),
  validateRequest(cancelSalesReturnSchema),
  controller.cancelDraftSalesReturn,
);

export const salesReturnsRoutes = router;
