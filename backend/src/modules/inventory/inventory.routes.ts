import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requireAdmin } from "../../shared/http/require_admin";
import { requireAuth } from "../auth/auth.middleware";
import { InventoryController } from "./inventory.controller";
import {
  createStockAdjustmentSchema,
  getInventoryMedicineDetailSchema,
  listExpiryReportSchema,
  listInventorySummarySchema,
  listLowStockSchema,
  listStockTransactionsSchema,
} from "./inventory.validation";

const router = Router();
const controller = new InventoryController();

router.get(
  "/summary",
  requireAuth,
  requireAdmin,
  validateRequest(listInventorySummarySchema),
  controller.listInventorySummary,
);
router.get(
  "/medicines/:medicineId",
  requireAuth,
  requireAdmin,
  validateRequest(getInventoryMedicineDetailSchema),
  controller.getInventoryMedicineDetail,
);
router.get(
  "/transactions",
  requireAuth,
  requireAdmin,
  validateRequest(listStockTransactionsSchema),
  controller.listStockTransactions,
);
router.get(
  "/low-stock",
  requireAuth,
  requireAdmin,
  validateRequest(listLowStockSchema),
  controller.listLowStock,
);
router.get(
  "/expiry-report",
  requireAuth,
  requireAdmin,
  validateRequest(listExpiryReportSchema),
  controller.listExpiryReport,
);
router.post(
  "/adjustments",
  requireAuth,
  requireAdmin,
  validateRequest(createStockAdjustmentSchema),
  controller.createStockAdjustment,
);

export const inventoryRoutes = router;
