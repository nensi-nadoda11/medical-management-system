import { Router } from "express";

import { validateRequest } from "../../shared/http/validate-request";
import { requireAdmin } from "../../shared/http/require_admin";
import { requireAuth } from "../auth/auth.middleware";
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
  requireAdmin,
  validateRequest(listMasterDataSchema),
  controller.listCategories,
);
router.post(
  "/categories",
  requireAuth,
  requireAdmin,
  validateRequest(createCategorySchema),
  controller.createCategory,
);
router.patch(
  "/categories/:id",
  requireAuth,
  requireAdmin,
  validateRequest(updateCategorySchema),
  controller.updateCategory,
);

router.get(
  "/manufacturers",
  requireAuth,
  requireAdmin,
  validateRequest(listMasterDataSchema),
  controller.listManufacturers,
);
router.post(
  "/manufacturers",
  requireAuth,
  requireAdmin,
  validateRequest(createManufacturerSchema),
  controller.createManufacturer,
);
router.patch(
  "/manufacturers/:id",
  requireAuth,
  requireAdmin,
  validateRequest(updateManufacturerSchema),
  controller.updateManufacturer,
);

router.get(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(listMedicinesSchema),
  controller.listMedicines,
);
router.get(
  "/:id",
  requireAuth,
  requireAdmin,
  validateRequest(getMedicineByIdSchema),
  controller.getMedicineById,
);
router.post(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(createMedicineSchema),
  controller.createMedicine,
);
router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  validateRequest(updateMedicineSchema),
  controller.updateMedicine,
);
router.patch(
  "/:id/status",
  requireAuth,
  requireAdmin,
  validateRequest(updateMedicineStatusSchema),
  controller.updateMedicineStatus,
);

export const medicinesRoutes = router;
