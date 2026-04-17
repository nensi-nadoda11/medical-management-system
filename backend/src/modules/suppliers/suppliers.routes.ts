import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requireAdmin } from "../../shared/http/require_admin";
import { requireAuth } from "../auth/auth.middleware";
import { SuppliersController } from "./suppliers.controller";
import {
  createSupplierSchema,
  getSupplierByIdSchema,
  listSuppliersSchema,
  updateSupplierSchema,
  updateSupplierStatusSchema,
} from "./suppliers.validation";

const router = Router();
const controller = new SuppliersController();

router.get(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(listSuppliersSchema),
  controller.listSuppliers,
);
router.get(
  "/:id",
  requireAuth,
  requireAdmin,
  validateRequest(getSupplierByIdSchema),
  controller.getSupplierById,
);
router.post(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(createSupplierSchema),
  controller.createSupplier,
);
router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  validateRequest(updateSupplierSchema),
  controller.updateSupplier,
);
router.patch(
  "/:id/status",
  requireAuth,
  requireAdmin,
  validateRequest(updateSupplierStatusSchema),
  controller.updateSupplierStatus,
);

export const suppliersRoutes = router;
