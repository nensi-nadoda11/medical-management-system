import { Router } from "express";
import { ShopController } from "./shop.controller";
import { requireAuth } from "../auth/auth.middleware";
import { requirePermission } from "../../shared/http/require_permission";

const router = Router();
const controller = new ShopController();

router.get("/profile", requireAuth, requirePermission("shop.view"), controller.getProfile);
router.patch(
  "/profile",
  requireAuth,
  requirePermission("shop.manage"),
  controller.updateProfile,
);

export const shopRoutes = router;
