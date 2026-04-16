import { Router } from "express";
import { ShopController } from "./shop.controller";
import { requireAdmin } from "../../shared/http/require_admin";
import { requireAuth } from "../auth/auth.middleware";

const router = Router();
const controller = new ShopController();

router.get("/profile", requireAuth, requireAdmin, controller.getProfile);
router.patch("/profile", requireAuth, requireAdmin, controller.updateProfile);

export const shopRoutes = router;
