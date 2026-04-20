import { Router } from "express";

import { requireAdmin } from "../../shared/http/require_admin";
import { requireAuth } from "../auth/auth.middleware";
import { BranchesController } from "./branches.controller";

const router = Router();
const controller = new BranchesController();

router.get("/", requireAuth, controller.listBranches);
router.post("/", requireAuth, requireAdmin, controller.createBranch);
router.patch("/:id", requireAuth, requireAdmin, controller.updateBranch);
router.get(
  "/users/:userId/assignments",
  requireAuth,
  requireAdmin,
  controller.listUserBranchAssignments,
);
router.put(
  "/users/:userId/assignments",
  requireAuth,
  requireAdmin,
  controller.updateUserBranchAssignments,
);

export const branchesRoutes = router;
