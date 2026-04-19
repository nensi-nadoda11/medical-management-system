import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requireAuth } from "../auth/auth.middleware";
import { requirePermission } from "../../shared/http/require_permission";
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
  requirePermission("suppliers.view"),
  validateRequest(listSuppliersSchema),
  controller.listSuppliers,
);
router.get(
  "/:id",
  requireAuth,
  requirePermission("suppliers.view"),
  validateRequest(getSupplierByIdSchema),
  controller.getSupplierById,
);
router.post(
  "/",
  requireAuth,
  requirePermission("suppliers.create"),
  validateRequest(createSupplierSchema),
  controller.createSupplier,
);
router.patch(
  "/:id",
  requireAuth,
  requirePermission("suppliers.edit"),
  validateRequest(updateSupplierSchema),
  controller.updateSupplier,
);
router.patch(
  "/:id/status",
  requireAuth,
  requirePermission("suppliers.edit"),
  validateRequest(updateSupplierStatusSchema),
  controller.updateSupplierStatus,
);

export const suppliersRoutes = router;
