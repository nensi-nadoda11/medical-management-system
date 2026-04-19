import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { UsersController } from "./users.controller";
import { requirePermission } from "../../shared/http/require_permission";

const router = Router();
const controller = new UsersController();

router.get(
  "/invitations/list",
  requireAuth,
  requirePermission("users.view"),
  controller.listInvitations,
);
router.post(
  "/invitations",
  requireAuth,
  requirePermission("users.manage"),
  controller.inviteUser,
);
router.post(
  "/invitations/:id/resend",
  requireAuth,
  requirePermission("users.manage"),
  controller.resendInvitation,
);
router.post(
  "/invitations/:id/revoke",
  requireAuth,
  requirePermission("users.manage"),
  controller.revokeInvitation,
);

router.get("/invitation/accept/:token", controller.getInvitationByToken);
router.post("/invitation/accept", controller.acceptInvitation);

router.get("/", requireAuth, requirePermission("users.view"), controller.listUsers);
router.patch("/:id", requireAuth, requirePermission("users.manage"), controller.updateUser);
router.patch(
  "/:id/status",
  requireAuth,
  requirePermission("users.manage"),
  controller.updateUserStatus,
);

export const usersRoutes = router;
