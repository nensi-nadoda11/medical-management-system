import { Router } from "express";
import { requireAdmin } from "../../shared/http/require_admin";
import { requireAuth } from "../auth/auth.middleware";
import { UsersController } from "./users.controller";

const router = Router();
const controller = new UsersController();

router.get(
  "/invitations/list",
  requireAuth,
  requireAdmin,
  controller.listInvitations,
);
router.post("/invitations", requireAuth, requireAdmin, controller.inviteUser);
router.post(
  "/invitations/:id/resend",
  requireAuth,
  requireAdmin,
  controller.resendInvitation,
);
router.post(
  "/invitations/:id/revoke",
  requireAuth,
  requireAdmin,
  controller.revokeInvitation,
);

router.get("/invitation/accept/:token", controller.getInvitationByToken);
router.post("/invitation/accept", controller.acceptInvitation);

router.get("/", requireAuth, requireAdmin, controller.listUsers);
router.patch("/:id", requireAuth, requireAdmin, controller.updateUser);
router.patch(
  "/:id/status",
  requireAuth,
  requireAdmin,
  controller.updateUserStatus,
);

export const usersRoutes = router;
