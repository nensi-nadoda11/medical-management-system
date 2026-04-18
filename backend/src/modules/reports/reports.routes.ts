import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requireRoles } from "../../shared/http/require_roles";
import { requireAuth } from "../auth/auth.middleware";
import { ReportsController } from "./reports.controller";
import {
  exportExpiryReportSchema,
  exportLowStockReportSchema,
  exportProfitReportSchema,
  exportSalesReportSchema,
  exportStockReportSchema,
  exportSupplierReportSchema,
  getDashboardSummarySchema,
  listExpiryReportSchema,
  listLowStockReportSchema,
  listProfitReportSchema,
  listSalesReportSchema,
  listStockReportSchema,
  listSupplierReportSchema,
} from "./reports.validation";

const router = Router();
const controller = new ReportsController();

router.get(
  "/dashboard/summary",
  requireAuth,
  requireRoles("admin", "staff", "accountant"),
  validateRequest(getDashboardSummarySchema),
  controller.getDashboardSummary,
);
router.get(
  "/sales",
  requireAuth,
  requireRoles("admin", "staff", "accountant"),
  validateRequest(listSalesReportSchema),
  controller.getSalesReport,
);
router.get(
  "/sales/export",
  requireAuth,
  requireRoles("admin", "staff", "accountant"),
  validateRequest(exportSalesReportSchema),
  controller.exportSalesReport,
);
router.get(
  "/profit",
  requireAuth,
  requireRoles("admin", "accountant"),
  validateRequest(listProfitReportSchema),
  controller.getProfitReport,
);
router.get(
  "/profit/export",
  requireAuth,
  requireRoles("admin", "accountant"),
  validateRequest(exportProfitReportSchema),
  controller.exportProfitReport,
);
router.get(
  "/stock",
  requireAuth,
  requireRoles("admin", "accountant"),
  validateRequest(listStockReportSchema),
  controller.getStockReport,
);
router.get(
  "/stock/export",
  requireAuth,
  requireRoles("admin", "accountant"),
  validateRequest(exportStockReportSchema),
  controller.exportStockReport,
);
router.get(
  "/low-stock",
  requireAuth,
  requireRoles("admin", "accountant"),
  validateRequest(listLowStockReportSchema),
  controller.getLowStockReport,
);
router.get(
  "/low-stock/export",
  requireAuth,
  requireRoles("admin", "accountant"),
  validateRequest(exportLowStockReportSchema),
  controller.exportLowStockReport,
);
router.get(
  "/expiry",
  requireAuth,
  requireRoles("admin", "accountant"),
  validateRequest(listExpiryReportSchema),
  controller.getExpiryReport,
);
router.get(
  "/expiry/export",
  requireAuth,
  requireRoles("admin", "accountant"),
  validateRequest(exportExpiryReportSchema),
  controller.exportExpiryReport,
);
router.get(
  "/suppliers",
  requireAuth,
  requireRoles("admin", "accountant"),
  validateRequest(listSupplierReportSchema),
  controller.getSupplierReport,
);
router.get(
  "/suppliers/export",
  requireAuth,
  requireRoles("admin", "accountant"),
  validateRequest(exportSupplierReportSchema),
  controller.exportSupplierReport,
);

export const reportsRoutes = router;
