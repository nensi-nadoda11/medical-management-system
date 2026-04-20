import { apiRequest } from "../../../lib/api";
import { downloadApiFile } from "../../../lib/download";
import type {
  BackupRecordDetail,
  BackupRecordListResponse,
  CreateBackupPayload,
  ExportDatasetParams,
  ImportJobDetail,
  ImportJobListResponse,
  ListBackupsParams,
  ListImportJobsParams,
  RestoreBackupPayload,
  RestoreBackupResponse,
  ValidateImportPayload,
} from "../../../types/data-management";

const cleanParams = (
  params: Record<string, string | number | boolean | undefined>,
) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
  );

export const dataManagementQueryKeys = {
  all: ["data-management"] as const,
  imports: () => [...dataManagementQueryKeys.all, "imports"] as const,
  importList: (params: ListImportJobsParams) =>
    [...dataManagementQueryKeys.imports(), params] as const,
  importDetail: (id: string) =>
    [...dataManagementQueryKeys.imports(), "detail", id] as const,
  backups: () => [...dataManagementQueryKeys.all, "backups"] as const,
  backupList: (params: ListBackupsParams) =>
    [...dataManagementQueryKeys.backups(), params] as const,
};

export const downloadImportTemplate = (
  importType: "medicines" | "suppliers" | "customers",
  format: "csv" | "xlsx",
) =>
  downloadApiFile(
    "/data-management/templates",
    { importType, format },
    `${importType}-template.${format}`,
  );

export const validateImportFile = (payload: ValidateImportPayload) =>
  apiRequest<ImportJobDetail>({
    method: "POST",
    url: "/data-management/imports/validate",
    data: payload,
  });

export const confirmImportJob = (jobId: string) =>
  apiRequest<ImportJobDetail>({
    method: "POST",
    url: `/data-management/imports/${jobId}/confirm`,
  });

export const listImportJobs = (params: ListImportJobsParams) =>
  apiRequest<ImportJobListResponse>({
    method: "GET",
    url: "/data-management/imports",
    params: cleanParams({
      page: params.page,
      pageSize: params.pageSize,
      importType: params.importType,
      status: params.status,
    }),
  });

export const getImportJob = (jobId: string) =>
  apiRequest<ImportJobDetail>({
    method: "GET",
    url: `/data-management/imports/${jobId}`,
  });

export const exportDataset = (params: ExportDatasetParams) =>
  downloadApiFile(
    "/data-management/exports/download",
    cleanParams({
      dataset: params.dataset,
      format: params.format,
      search: params.search,
      status: params.status,
      categoryId: params.categoryId,
      manufacturerId: params.manufacturerId,
      lowStockOnly: params.lowStockOnly,
    }),
    `${params.dataset}.${params.format}`,
  );

export const createBackup = (payload: CreateBackupPayload) =>
  apiRequest<BackupRecordDetail>({
    method: "POST",
    url: "/data-management/backups",
    data: payload,
  });

export const listBackups = (params: ListBackupsParams) =>
  apiRequest<BackupRecordListResponse>({
    method: "GET",
    url: "/data-management/backups",
    params: cleanParams({
      page: params.page,
      pageSize: params.pageSize,
      status: params.status,
    }),
  });

export const downloadBackup = (backupId: string, fallbackFilename: string) =>
  downloadApiFile(
    `/data-management/backups/${backupId}/download`,
    {},
    fallbackFilename,
  );

export const restoreBackup = (
  backupId: string,
  payload: RestoreBackupPayload,
) =>
  apiRequest<RestoreBackupResponse>({
    method: "POST",
    url: `/data-management/backups/${backupId}/restore`,
    data: payload,
  });
