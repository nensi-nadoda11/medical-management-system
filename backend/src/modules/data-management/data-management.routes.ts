import { Router } from "express";

import { requireAdmin } from "../../shared/http/require_admin";
import { validateRequest } from "../../shared/http/validate-request";
import { requireAuth } from "../auth/auth.middleware";
import { DataManagementController } from "./data-management.controller";
import {
  backupRecordSchema,
  confirmImportSchema,
  createBackupSchema,
  downloadTemplateSchema,
  exportDatasetSchema,
  getImportJobSchema,
  listBackupsSchema,
  listImportJobsSchema,
  restoreBackupSchema,
  validateImportSchema,
} from "./data-management.validation";

const router = Router();
const controller = new DataManagementController();

router.get(
  "/templates",
  requireAuth,
  requireAdmin,
  validateRequest(downloadTemplateSchema),
  controller.downloadTemplate,
);

router.post(
  "/imports/validate",
  requireAuth,
  requireAdmin,
  validateRequest(validateImportSchema),
  controller.validateImport,
);

router.post(
  "/imports/:id/confirm",
  requireAuth,
  requireAdmin,
  validateRequest(confirmImportSchema),
  controller.confirmImport,
);

router.get(
  "/imports",
  requireAuth,
  requireAdmin,
  validateRequest(listImportJobsSchema),
  controller.listImportJobs,
);

router.get(
  "/imports/:id",
  requireAuth,
  requireAdmin,
  validateRequest(getImportJobSchema),
  controller.getImportJob,
);

router.get(
  "/exports/download",
  requireAuth,
  requireAdmin,
  validateRequest(exportDatasetSchema),
  controller.exportDataset,
);

router.post(
  "/backups",
  requireAuth,
  requireAdmin,
  validateRequest(createBackupSchema),
  controller.createBackup,
);

router.get(
  "/backups",
  requireAuth,
  requireAdmin,
  validateRequest(listBackupsSchema),
  controller.listBackups,
);

router.get(
  "/backups/:id/download",
  requireAuth,
  requireAdmin,
  validateRequest(backupRecordSchema),
  controller.downloadBackup,
);

router.post(
  "/backups/:id/restore",
  requireAuth,
  requireAdmin,
  validateRequest(restoreBackupSchema),
  controller.restoreBackup,
);

export const dataManagementRoutes = router;
