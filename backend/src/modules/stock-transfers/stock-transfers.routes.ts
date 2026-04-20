import { Router } from "express";

import { requireAdmin } from "../../shared/http/require_admin";
import { requireAuth } from "../auth/auth.middleware";
import { StockTransfersController } from "./stock-transfers.controller";

const router = Router();
const controller = new StockTransfersController();

router.get("/", requireAuth, requireAdmin, controller.listTransfers);
router.get(
  "/source-batches",
  requireAuth,
  requireAdmin,
  controller.listSourceBatches,
);
router.post("/", requireAuth, requireAdmin, controller.createTransfer);
router.post("/:id/complete", requireAuth, requireAdmin, controller.completeTransfer);
router.post("/:id/cancel", requireAuth, requireAdmin, controller.cancelTransfer);

export const stockTransfersRoutes = router;
