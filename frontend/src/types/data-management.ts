import type { PaginatedResponse } from "./common";

export const IMPORT_TYPES = ["medicines", "suppliers", "customers"] as const;
export const DUPLICATE_MODES = [
  "skip_duplicates",
  "update_existing",
  "fail_duplicates",
  "upsert",
] as const;
export const EXPORT_DATASETS = [
  "medicines",
  "suppliers",
  "customers",
  "stock_summary",
] as const;

export type ImportType = (typeof IMPORT_TYPES)[number];
export type DuplicateMode = (typeof DUPLICATE_MODES)[number];
export type ExportDataset = (typeof EXPORT_DATASETS)[number];
export type DownloadFormat = "csv" | "xlsx";
export type ImportJobStatus = "validated" | "processing" | "completed" | "failed";
export type ImportRowStatus =
  | "valid"
  | "invalid"
  | "duplicate"
  | "skipped"
  | "imported"
  | "failed";
export type BackupStatus = "ready" | "restored" | "failed";

export interface ImportRowDetail {
  id: string;
  rowNumber: number;
  status: ImportRowStatus;
  action: "create" | "update" | "skip" | "fail" | null;
  identifier: string | null;
  rawData: Record<string, unknown>;
  normalizedData: Record<string, unknown> | null;
  errors: string[];
  warnings: string[];
  targetEntityId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportJobDetail {
  id: string;
  importType: ImportType;
  fileName: string;
  fileFormat: DownloadFormat;
  status: ImportJobStatus;
  duplicateMode: DuplicateMode;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  warningRows: number;
  successRows: number;
  failedRows: number;
  summary: Record<string, unknown> | null;
  startedAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
  rows: ImportRowDetail[];
}

export interface ImportJobListItem {
  id: string;
  importType: ImportType;
  fileName: string;
  fileFormat: DownloadFormat;
  status: ImportJobStatus;
  duplicateMode: DuplicateMode;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  successRows: number;
  failedRows: number;
  createdAt: string;
  startedAt: string;
  completedAt: string | null;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface ValidateImportPayload {
  importType: ImportType;
  duplicateMode: DuplicateMode;
  fileName: string;
  fileContentBase64: string;
}

export interface ListImportJobsParams {
  page?: number;
  pageSize?: number;
  importType?: ImportType;
  status?: ImportJobStatus;
}

export interface ExportDatasetParams {
  dataset: ExportDataset;
  format: DownloadFormat;
  search?: string;
  status?: "active" | "inactive";
  categoryId?: string;
  manufacturerId?: string;
  lowStockOnly?: boolean;
}

export interface CreateBackupPayload {
  includeShopProfile: boolean;
  includeSettings: boolean;
  includeMasters: boolean;
  includeContacts: boolean;
}

export interface BackupRecordDetail {
  id: string;
  fileName: string;
  type: "shop_snapshot";
  status: BackupStatus;
  fileSizeBytes: number;
  metadata: Record<string, unknown> | null;
  restoredAt: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
  confirmationText: string;
}

export interface BackupRecordListItem {
  id: string;
  fileName: string;
  type: "shop_snapshot";
  status: BackupStatus;
  fileSizeBytes: number;
  metadata: Record<string, unknown> | null;
  restoredAt: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface ListBackupsParams {
  page?: number;
  pageSize?: number;
  status?: BackupStatus;
}

export interface RestoreBackupPayload {
  confirmationText: string;
}

export interface RestoreBackupResponse {
  backup: BackupRecordDetail;
  summary: {
    categoriesCreated: number;
    categoriesUpdated: number;
    manufacturersCreated: number;
    manufacturersUpdated: number;
    medicinesCreated: number;
    medicinesUpdated: number;
    medicinesSkipped: number;
    suppliersCreated: number;
    suppliersUpdated: number;
    suppliersSkipped: number;
    customersCreated: number;
    customersUpdated: number;
    customersSkipped: number;
  };
}

export type ImportJobListResponse = PaginatedResponse<ImportJobListItem>;
export type BackupRecordListResponse = PaginatedResponse<BackupRecordListItem>;
