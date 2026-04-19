import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requireAuth } from "../auth/auth.middleware";
import { requirePermission } from "../../shared/http/require_permission";
import { MedicinesController } from "./medicines.controller";
import {
  createCategorySchema,
  createManufacturerSchema,
  createMedicineSchema,
  getMedicineByIdSchema,
  listMasterDataSchema,
  listMedicinesSchema,
  updateCategorySchema,
  updateManufacturerSchema,
  updateMedicineSchema,
  updateMedicineStatusSchema,
} from "./medicines.validation";

const router = Router();
const controller = new MedicinesController();

router.get(
  "/categories",
  requireAuth,
  requirePermission("medicines.view"),
  validateRequest(listMasterDataSchema),
  controller.listCategories,
);
router.post(
  "/categories",
  requireAuth,
  requirePermission("medicines.create"),
  validateRequest(createCategorySchema),
  controller.createCategory,
);
router.patch(
  "/categories/:id",
  requireAuth,
  requirePermission("medicines.edit"),
  validateRequest(updateCategorySchema),
  controller.updateCategory,
);

router.get(
  "/manufacturers",
  requireAuth,
  requirePermission("medicines.view"),
  validateRequest(listMasterDataSchema),
  controller.listManufacturers,
);
router.post(
  "/manufacturers",
  requireAuth,
  requirePermission("medicines.create"),
  validateRequest(createManufacturerSchema),
  controller.createManufacturer,
);
router.patch(
  "/manufacturers/:id",
  requireAuth,
  requirePermission("medicines.edit"),
  validateRequest(updateManufacturerSchema),
  controller.updateManufacturer,
);

router.get(
  "/",
  requireAuth,
  requirePermission("medicines.view"),
  validateRequest(listMedicinesSchema),
  controller.listMedicines,
);
router.get(
  "/:id",
  requireAuth,
  requirePermission("medicines.view"),
  validateRequest(getMedicineByIdSchema),
  controller.getMedicineById,
);
router.post(
  "/",
  requireAuth,
  requirePermission("medicines.create"),
  validateRequest(createMedicineSchema),
  controller.createMedicine,
);
router.patch(
  "/:id",
  requireAuth,
  requirePermission("medicines.edit"),
  validateRequest(updateMedicineSchema),
  controller.updateMedicine,
);
router.patch(
  "/:id/status",
  requireAuth,
  requirePermission("medicines.edit"),
  validateRequest(updateMedicineStatusSchema),
  controller.updateMedicineStatus,
);

export const medicinesRoutes = router;
