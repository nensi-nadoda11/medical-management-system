import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requirePermission } from "../../shared/http/require_permission";
import { requireAuth } from "../auth/auth.middleware";
import { ReportsController } from "./reports.controller";
import {
  exportDashboardSummarySchema,
  exportExpiryReportSchema,
  exportLowStockReportSchema,
  exportProfitReportSchema,
  exportSalesReportSchema,
  exportStockReportSchema,
  exportSupplierReportSchema,
  exportUsageReportSchema,
  getDashboardSummarySchema,
  listExpiryReportSchema,
  listLowStockReportSchema,
  listProfitReportSchema,
  listSalesReportSchema,
  listStockReportSchema,
  listSupplierReportSchema,
  listUsageReportSchema,
} from "./reports.validation";

const router = Router();
const controller = new ReportsController();

router.get(
  "/dashboard/summary",
  requireAuth,
  requirePermission("reports.view"),
  validateRequest(getDashboardSummarySchema),
  controller.getDashboardSummary,
);
router.get(
  "/dashboard/export",
  requireAuth,
  requirePermission("reports.view"),
  validateRequest(exportDashboardSummarySchema),
  controller.exportDashboardReport,
);
router.get(
  "/sales",
  requireAuth,
  requirePermission("reports.view"),
  validateRequest(listSalesReportSchema),
  controller.getSalesReport,
);
router.get(
  "/sales/export",
  requireAuth,
  requirePermission("reports.view"),
  validateRequest(exportSalesReportSchema),
  controller.exportSalesReport,
);
router.get(
  "/profit",
  requireAuth,
  requirePermission("reports.financial"),
  validateRequest(listProfitReportSchema),
  controller.getProfitReport,
);
router.get(
  "/profit/export",
  requireAuth,
  requirePermission("reports.financial"),
  validateRequest(exportProfitReportSchema),
  controller.exportProfitReport,
);
router.get(
  "/stock",
  requireAuth,
  requirePermission("reports.financial"),
  validateRequest(listStockReportSchema),
  controller.getStockReport,
);
router.get(
  "/stock/export",
  requireAuth,
  requirePermission("reports.financial"),
  validateRequest(exportStockReportSchema),
  controller.exportStockReport,
);
router.get(
  "/low-stock",
  requireAuth,
  requirePermission("reports.financial"),
  validateRequest(listLowStockReportSchema),
  controller.getLowStockReport,
);
router.get(
  "/low-stock/export",
  requireAuth,
  requirePermission("reports.financial"),
  validateRequest(exportLowStockReportSchema),
  controller.exportLowStockReport,
);
router.get(
  "/expiry",
  requireAuth,
  requirePermission("reports.financial"),
  validateRequest(listExpiryReportSchema),
  controller.getExpiryReport,
);
router.get(
  "/expiry/export",
  requireAuth,
  requirePermission("reports.financial"),
  validateRequest(exportExpiryReportSchema),
  controller.exportExpiryReport,
);
router.get(
  "/suppliers",
  requireAuth,
  requirePermission("reports.financial"),
  validateRequest(listSupplierReportSchema),
  controller.getSupplierReport,
);
router.get(
  "/suppliers/export",
  requireAuth,
  requirePermission("reports.financial"),
  validateRequest(exportSupplierReportSchema),
  controller.exportSupplierReport,
);
router.get(
  "/usage",
  requireAuth,
  requirePermission("reports.financial"),
  validateRequest(listUsageReportSchema),
  controller.getUsageReport,
);
router.get(
  "/usage/export",
  requireAuth,
  requirePermission("reports.financial"),
  validateRequest(exportUsageReportSchema),
  controller.exportUsageReport,
);

export const reportsRoutes = router;
