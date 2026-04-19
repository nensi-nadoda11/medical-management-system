import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requireAuth } from "../auth/auth.middleware";
import { NotificationsController } from "./notifications.controller";
import {
  bulkMarkNotificationsReadSchema,
  listNotificationsSchema,
  notificationIdSchema,
} from "./notifications.validation";

const router = Router();
const controller = new NotificationsController();

router.get(
  "/",
  requireAuth,
  validateRequest(listNotificationsSchema),
  controller.listNotifications,
);
router.get("/summary", requireAuth, controller.getSummary);
router.get("/unread-count", requireAuth, controller.getUnreadCount);
router.patch(
  "/read",
  requireAuth,
  validateRequest(bulkMarkNotificationsReadSchema),
  controller.bulkMarkRead,
);
router.patch(
  "/:id/read",
  requireAuth,
  validateRequest(notificationIdSchema),
  controller.markAsRead,
);
router.patch(
  "/:id/acknowledge",
  requireAuth,
  validateRequest(notificationIdSchema),
  controller.acknowledge,
);

export const notificationsRoutes = router;
