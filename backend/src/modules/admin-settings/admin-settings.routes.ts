import { Router } from "express";

import { requireAdmin } from "../../shared/http/require_admin";
import { validateRequest } from "../../shared/http/validate-request";
import { requireAuth } from "../auth/auth.middleware";
import { AdminSettingsController } from "./admin-settings.controller";
import {
  getUserPermissionDetailSchema,
  listAdminAuditLogsSchema,
  updateRolePermissionsSchema,
  updateShopSettingsSchema,
  updateUserPermissionOverridesSchema,
} from "./admin-settings.validation";

const router = Router();
const controller = new AdminSettingsController();

router.get("/permissions/catalog", requireAuth, requireAdmin, controller.getPermissionCatalog);
router.get("/permissions/roles", requireAuth, requireAdmin, controller.getRolePermissions);
router.put(
  "/permissions/roles/:role",
  requireAuth,
  requireAdmin,
  validateRequest(updateRolePermissionsSchema),
  controller.updateRolePermissions,
);
router.get(
  "/permissions/users/:userId",
  requireAuth,
  requireAdmin,
  validateRequest(getUserPermissionDetailSchema),
  controller.getUserPermissionDetail,
);
router.put(
  "/permissions/users/:userId",
  requireAuth,
  requireAdmin,
  validateRequest(updateUserPermissionOverridesSchema),
  controller.updateUserPermissionOverrides,
);
router.get("/shop-settings", requireAuth, requireAdmin, controller.getShopSettings);
router.patch(
  "/shop-settings",
  requireAuth,
  requireAdmin,
  validateRequest(updateShopSettingsSchema),
  controller.updateShopSettings,
);
router.get(
  "/audit-logs",
  requireAuth,
  requireAdmin,
  validateRequest(listAdminAuditLogsSchema),
  controller.listAuditLogs,
);

export const adminSettingsRoutes = router;
