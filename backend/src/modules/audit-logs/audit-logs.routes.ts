import { Router } from "express";

import { requireAdmin } from "../../shared/http/require_admin";
import { validateRequest } from "../../shared/http/validate-request";
import { requireAuth } from "../auth/auth.middleware";
import { AuditLogsController } from "./audit-logs.controller";
import {
  getAuditLogByIdSchema,
  listAuditLogsSchema,
  listRecentActivitySchema,
} from "./audit-logs.validation";

const router = Router();
const controller = new AuditLogsController();

router.get(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(listAuditLogsSchema),
  controller.listAuditLogs,
);
router.get(
  "/recent",
  requireAuth,
  requireAdmin,
  validateRequest(listRecentActivitySchema),
  controller.listRecentActivity,
);
router.get(
  "/:id",
  requireAuth,
  requireAdmin,
  validateRequest(getAuditLogByIdSchema),
  controller.getAuditLogById,
);

export const auditLogsRoutes = router;
