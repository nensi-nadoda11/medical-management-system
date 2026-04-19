import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requireAuth } from "../auth/auth.middleware";
import { requirePermission } from "../../shared/http/require_permission";
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
  requirePermission("inventory.view"),
  validateRequest(listInventorySummarySchema),
  controller.listInventorySummary,
);
router.get(
  "/medicines/:medicineId",
  requireAuth,
  requirePermission("inventory.view"),
  validateRequest(getInventoryMedicineDetailSchema),
  controller.getInventoryMedicineDetail,
);
router.get(
  "/transactions",
  requireAuth,
  requirePermission("inventory.view"),
  validateRequest(listStockTransactionsSchema),
  controller.listStockTransactions,
);
router.get(
  "/low-stock",
  requireAuth,
  requirePermission("inventory.view"),
  validateRequest(listLowStockSchema),
  controller.listLowStock,
);
router.get(
  "/expiry-report",
  requireAuth,
  requirePermission("inventory.view"),
  validateRequest(listExpiryReportSchema),
  controller.listExpiryReport,
);
router.post(
  "/adjustments",
  requireAuth,
  requirePermission("inventory.adjust"),
  validateRequest(createStockAdjustmentSchema),
  controller.createStockAdjustment,
);

export const inventoryRoutes = router;
