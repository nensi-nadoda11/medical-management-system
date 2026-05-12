import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Modal } from "../../../components/ui/Modal";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Pagination } from "../../../components/ui/Pagination";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useToast } from "../../../hooks/use-toast";
import {
  cn,
  formatDateTime,
  formatNumber,
  humanizeLabel,
} from "../../../lib/utils";
import type {
  BackupRecordListItem,
  CreateBackupPayload,
  DuplicateMode,
  ExportDataset,
  ImportJobDetail,
  ImportRowDetail,
  ImportType,
} from "../../../types/data-management";
import {
  createBackup,
  confirmImportJob,
  dataManagementQueryKeys,
  downloadBackup,
  downloadImportTemplate,
  exportDataset,
  getImportJob,
  listBackups,
  listImportJobs,
  restoreBackup,
  validateImportFile,
} from "../api/dataManagement";

const inputClassName =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";
const pillClassName =
  "rounded-full border px-3.5 py-2 text-sm font-semibold transition";

const sectionTabs = [
  { key: "import", label: "Import" },
  { key: "export", label: "Export" },
  { key: "backup", label: "Backup & Restore" },
] as const;

const duplicateModeLabels: Record<DuplicateMode, string> = {
  skip_duplicates: "Skip duplicates",
  update_existing: "Update existing",
  fail_duplicates: "Fail on duplicates",
  upsert: "Upsert",
};

const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unable to read the selected file."));
        return;
      }

      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.readAsDataURL(file);
  });

const formatFileSize = (value: number) => {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const renderMessages = (items: string[], tone: "error" | "warning") =>
  items.length ? (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2.5 text-xs leading-5",
        tone === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-amber-200 bg-amber-50 text-amber-700",
      )}
    >
      {items.join(" ")}
    </div>
  ) : null;

export const DataManagementPage = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [activeSection, setActiveSection] =
    useState<(typeof sectionTabs)[number]["key"]>("import");
  const [importType, setImportType] = useState<ImportType>("medicines");
  const [duplicateMode, setDuplicateMode] =
    useState<DuplicateMode>("skip_duplicates");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewJob, setPreviewJob] = useState<ImportJobDetail | null>(null);
  const [importHistoryPage, setImportHistoryPage] = useState(1);
  const [selectedImportJobId, setSelectedImportJobId] = useState<string | null>(null);
  const [exportDatasetKey, setExportDatasetKey] =
    useState<ExportDataset>("medicines");
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("xlsx");
  const [exportSearch, setExportSearch] = useState("");
  const [exportStatus, setExportStatus] = useState<"" | "active" | "inactive">("");
  const [stockLowOnly, setStockLowOnly] = useState(false);
  const [backupPage, setBackupPage] = useState(1);
  const [backupOptions, setBackupOptions] = useState<CreateBackupPayload>({
    includeShopProfile: true,
    includeSettings: true,
    includeMasters: true,
    includeContacts: true,
  });
  const [restoreTarget, setRestoreTarget] = useState<BackupRecordListItem | null>(null);
  const [restoreConfirmationText, setRestoreConfirmationText] = useState("");
  const [restoreResult, setRestoreResult] = useState<{
    summary: Record<string, number>;
    fileName: string;
  } | null>(null);

  const deferredExportSearch = useDeferredValue(exportSearch);

  const importJobsQuery = useQuery({
    queryKey: dataManagementQueryKeys.importList({
      page: importHistoryPage,
      pageSize: 6,
      importType,
    }),
    queryFn: () =>
      listImportJobs({
        page: importHistoryPage,
        pageSize: 6,
        importType,
      }),
  });

  const importJobDetailQuery = useQuery({
    queryKey: selectedImportJobId
      ? dataManagementQueryKeys.importDetail(selectedImportJobId)
      : [...dataManagementQueryKeys.imports(), "detail", "empty"],
    queryFn: () => getImportJob(selectedImportJobId as string),
    enabled: Boolean(selectedImportJobId),
    initialData:
      selectedImportJobId && previewJob?.id === selectedImportJobId
        ? previewJob
        : undefined,
  });

  const backupsQuery = useQuery({
    queryKey: dataManagementQueryKeys.backupList({
      page: backupPage,
      pageSize: 6,
    }),
    queryFn: () =>
      listBackups({
        page: backupPage,
        pageSize: 6,
      }),
  });

  const validateImportMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error("Choose a CSV or XLSX file to validate.");
      }

      const fileContentBase64 = await readFileAsBase64(selectedFile);
      return validateImportFile({
        importType,
        duplicateMode,
        fileName: selectedFile.name,
        fileContentBase64,
      });
    },
    onSuccess: async (result) => {
      setPreviewJob(result);
      setSelectedImportJobId(result.id);
      await queryClient.invalidateQueries({
        queryKey: dataManagementQueryKeys.imports(),
      });
      pushToast({
        title: "Import preview ready",
        description: "Validation completed and the preview is ready for review.",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      pushToast({
        title: "Unable to validate file",
        description: error.message,
        variant: "error",
      });
    },
  });

  const confirmImportMutation = useMutation({
    mutationFn: (jobId: string) => confirmImportJob(jobId),
    onSuccess: async (result) => {
      setPreviewJob(result);
      await queryClient.invalidateQueries({
        queryKey: dataManagementQueryKeys.imports(),
      });
      await queryClient.invalidateQueries({
        queryKey: dataManagementQueryKeys.importDetail(result.id),
      });
      pushToast({
        title: "Import completed",
        description: "The confirmed import has been applied successfully.",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      pushToast({
        title: "Import confirmation failed",
        description: error.message,
        variant: "error",
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: () =>
      exportDataset({
        dataset: exportDatasetKey,
        format: exportFormat,
        search: deferredExportSearch || undefined,
        status:
          exportDatasetKey === "stock_summary"
            ? exportStatus || undefined
            : exportStatus || undefined,
        lowStockOnly: exportDatasetKey === "stock_summary" ? stockLowOnly : undefined,
      }),
    onSuccess: () => {
      pushToast({
        title: "Export started",
        description: "Your dataset download has been prepared.",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      pushToast({
        title: "Export failed",
        description: error.message,
        variant: "error",
      });
    },
  });

  const createBackupMutation = useMutation({
    mutationFn: () => createBackup(backupOptions),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: dataManagementQueryKeys.backups(),
      });
      pushToast({
        title: "Backup created",
        description: `${result.fileName} is ready for download or restore review.`,
        variant: "success",
      });
    },
    onError: (error: Error) => {
      pushToast({
        title: "Backup creation failed",
        description: error.message,
        variant: "error",
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => {
      if (!restoreTarget) {
        throw new Error("Select a backup to restore.");
      }

      return restoreBackup(restoreTarget.id, {
        confirmationText: restoreConfirmationText,
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: dataManagementQueryKeys.backups(),
      });
      setRestoreResult({
        summary: result.summary,
        fileName: result.backup.fileName,
      });
      setRestoreTarget(null);
      setRestoreConfirmationText("");
      pushToast({
        title: "Restore completed",
        description: "The controlled restore finished successfully.",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      pushToast({
        title: "Restore failed",
        description: error.message,
        variant: "error",
      });
    },
  });

  const overviewStats = useMemo(
    () => [
      ["Preview rows", previewJob?.totalRows ?? 0],
      ["Import jobs", importJobsQuery.data?.pagination.total ?? 0],
      ["Backups", backupsQuery.data?.pagination.total ?? 0],
      [
        "Ready backups",
        backupsQuery.data?.items.filter((item) => item.status === "ready").length ?? 0,
      ],
    ],
    [backupsQuery.data, importJobsQuery.data, previewJob],
  );

  const activeError = importJobsQuery.error ?? backupsQuery.error;

  if (importJobsQuery.isLoading || backupsQuery.isLoading) {
    return <LoadingState title="Loading data management workspace" />;
  }

  if (activeError) {
    return (
      <ErrorState
        title="Unable to load data controls"
        description={activeError.message}
        onRetry={() => {
          importJobsQuery.refetch();
          backupsQuery.refetch();
        }}
      />
    );
  }

  const importJobs = importJobsQuery.data?.items ?? [];
  const importPagination = importJobsQuery.data?.pagination;
  const backupItems = backupsQuery.data?.items ?? [];
  const backupPagination = backupsQuery.data?.pagination;
  const activeImportDetail =
    selectedImportJobId && importJobDetailQuery.data?.id === selectedImportJobId
      ? importJobDetailQuery.data
      : previewJob?.id === selectedImportJobId
        ? previewJob
        : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin utility"
        title="Data Management"
        actions={
          <div className="flex flex-wrap gap-2">
            {sectionTabs.map((tab) => (
              <button
                className={cn(
                  pillClassName,
                  activeSection === tab.key
                    ? "border-transparent bg-slate-950 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                )}
                key={tab.key}
                onClick={() => setActiveSection(tab.key)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewStats.map(([label, value]) => (
          <article
            className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60"
            key={label}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {label}
            </p>
            <p className="mt-2.5 text-[1.9rem] font-semibold tracking-tight text-slate-950">
              {formatNumber(value)}
            </p>
          </article>
        ))}
      </div>

      {activeSection === "import" ? (
        <div className="space-y-6">
          <SectionCard
            title="Import wizard"
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  onClick={() => downloadImportTemplate(importType, "csv")}
                  type="button"
                >
                  Template CSV
                </button>
                <button
                  className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  onClick={() => downloadImportTemplate(importType, "xlsx")}
                  type="button"
                >
                  Template XLSX
                </button>
              </div>
            }
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.4fr_auto]">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Import type
                <select
                  className={inputClassName}
                  onChange={(event) => {
                    setImportType(event.target.value as ImportType);
                    setPreviewJob(null);
                    setSelectedFile(null);
                    setImportHistoryPage(1);
                  }}
                  value={importType}
                >
                  <option value="medicines">Medicines</option>
                  <option value="suppliers">Suppliers</option>
                  <option value="customers">Customers</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Duplicate mode
                <select
                  className={inputClassName}
                  onChange={(event) =>
                    setDuplicateMode(event.target.value as DuplicateMode)
                  }
                  value={duplicateMode}
                >
                  {Object.entries(duplicateModeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Upload file
                <input
                  accept=".csv,.xlsx"
                  className={cn(inputClassName, "file:mr-3 file:rounded-xl file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white")}
                  onChange={(event) => {
                    setSelectedFile(event.target.files?.[0] ?? null);
                    setPreviewJob(null);
                  }}
                  type="file"
                />
              </label>

              <button
                className="self-end rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!selectedFile || validateImportMutation.isPending}
                onClick={() => validateImportMutation.mutate()}
                type="button"
              >
                {validateImportMutation.isPending ? "Validating..." : "Validate preview"}
              </button>
            </div>

            {selectedFile ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{selectedFile.name}</span>
                <span>{formatFileSize(selectedFile.size)}</span>
                <StatusBadge label={duplicateModeLabels[duplicateMode]} tone="info" />
              </div>
            ) : null}

            {previewJob ? (
              <div className="mt-5 space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    ["Total rows", previewJob.totalRows],
                    ["Valid", previewJob.validRows],
                    ["Invalid", previewJob.invalidRows],
                    ["Duplicates", previewJob.duplicateRows],
                    ["Warnings", previewJob.warningRows],
                  ].map(([label, value]) => (
                    <div
                      className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3"
                      key={label}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {label}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">
                        {formatNumber(value)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#fcfefe_0%,#f5faf9_100%)] px-4 py-3.5">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-950">
                      Preview job #{previewJob.id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-slate-600">
                      {previewJob.invalidRows
                        ? "Fix invalid rows before confirming this import."
                        : previewJob.duplicateMode === "fail_duplicates" &&
                            previewJob.duplicateRows
                          ? "Duplicate rows must be removed or revalidated with another mode."
                          : "Preview is ready for confirmation."}
                    </p>
                  </div>

                  <button
                    className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={
                      previewJob.invalidRows > 0 ||
                      (previewJob.duplicateMode === "fail_duplicates" &&
                        previewJob.duplicateRows > 0) ||
                      confirmImportMutation.isPending
                    }
                    onClick={() => confirmImportMutation.mutate(previewJob.id)}
                    type="button"
                  >
                    {confirmImportMutation.isPending
                      ? "Importing..."
                      : previewJob.status === "completed"
                        ? "Import completed"
                        : "Confirm import"}
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">
                        Preview rows
                      </h3>
                      <p className="text-sm text-slate-600">
                        Reviewing the first issues here keeps confirmation safer.
                      </p>
                    </div>
                    <button
                      className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      onClick={() => setSelectedImportJobId(previewJob.id)}
                      type="button"
                    >
                      Open full detail
                    </button>
                  </div>

                  <div className="grid gap-3 lg:hidden">
                    {previewJob.rows.slice(0, 8).map((row) => (
                      <article
                        className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                        key={row.id}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              Row {row.rowNumber}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {row.identifier ?? "No identifier"}
                            </p>
                          </div>
                          <StatusBadge label={row.status} />
                        </div>
                        <div className="mt-3 space-y-2">
                          {renderMessages(row.errors, "error")}
                          {renderMessages(row.warnings, "warning")}
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto lg:block">
                    <table className="min-w-[980px] w-full border-separate border-spacing-y-3">
                      <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          <th className="px-4">Row</th>
                          <th className="px-4">Identifier</th>
                          <th className="px-4">Status</th>
                          <th className="px-4">Action</th>
                          <th className="px-4">Errors</th>
                          <th className="px-4">Warnings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewJob.rows.slice(0, 10).map((row) => (
                          <tr className="bg-slate-50" key={row.id}>
                            <td className="rounded-l-3xl px-4 py-4 text-sm font-semibold text-slate-900">
                              {row.rowNumber}
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-600">
                              {row.identifier ?? "No identifier"}
                            </td>
                            <td className="px-4 py-4">
                              <StatusBadge label={row.status} />
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700">
                              {row.action ? humanizeLabel(row.action) : "Not set"}
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-600">
                              {row.errors.join(" ") || "No issues"}
                            </td>
                            <td className="rounded-r-3xl px-4 py-4 text-sm text-slate-600">
                              {row.warnings.join(" ") || "None"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState
                  title="No preview generated yet"
                  description="Download a template, fill your rows, then validate the upload to get row-level checks before anything is imported."
                />
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Import history"
            description="Track validation jobs, confirmed imports, and failures with row-level drilldown."
          >
            {importJobs.length ? (
              <div className="space-y-4">
                <div className="grid gap-3 lg:hidden">
                  {importJobs.map((job) => (
                    <article
                      className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                      key={job.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {humanizeLabel(job.importType)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{job.fileName}</p>
                        </div>
                        <StatusBadge label={job.status} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
                        <div>Total rows: {formatNumber(job.totalRows)}</div>
                        <div>Valid: {formatNumber(job.validRows)}</div>
                        <div>Invalid: {formatNumber(job.invalidRows)}</div>
                        <div>Duplicates: {formatNumber(job.duplicateRows)}</div>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                          {formatDateTime(job.createdAt)}
                        </p>
                        <button
                          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                          onClick={() => setSelectedImportJobId(job.id)}
                          type="button"
                        >
                          View details
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="min-w-[1080px] w-full border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <th className="px-4">Type</th>
                        <th className="px-4">File</th>
                        <th className="px-4">Status</th>
                        <th className="px-4">Counts</th>
                        <th className="px-4">Created by</th>
                        <th className="px-4">Created</th>
                        <th className="px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importJobs.map((job) => (
                        <tr className="bg-slate-50" key={job.id}>
                          <td className="rounded-l-3xl px-4 py-4 font-semibold text-slate-950">
                            {humanizeLabel(job.importType)}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-600">{job.fileName}</td>
                          <td className="px-4 py-4">
                            <StatusBadge label={job.status} />
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-600">
                            {job.totalRows} total / {job.validRows} valid / {job.invalidRows} invalid
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-600">
                            {job.createdBy.fullName}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-600">
                            {formatDateTime(job.createdAt)}
                          </td>
                          <td className="rounded-r-3xl px-4 py-4 text-right">
                            <button
                              className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                              onClick={() => setSelectedImportJobId(job.id)}
                              type="button"
                            >
                              View details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {importPagination ? (
                  <Pagination
                    page={importPagination.page}
                    pageSize={importPagination.pageSize}
                    totalItems={importPagination.total}
                    totalPages={importPagination.totalPages}
                    onPageChange={setImportHistoryPage}
                  />
                ) : null}
              </div>
            ) : (
              <EmptyState
                title="No import history yet"
                description="Validated and confirmed imports will start appearing here once the first bulk file is processed."
              />
            )}
          </SectionCard>
        </div>
      ) : null}

      {activeSection === "export" ? (
        <SectionCard
          title="Dataset export"
          description="Generate clean Excel or CSV outputs for master data and stock summary without leaving the admin workspace."
        >
          <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr_1.2fr_0.9fr_auto]">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Dataset
              <select
                className={inputClassName}
                onChange={(event) =>
                  setExportDatasetKey(event.target.value as ExportDataset)
                }
                value={exportDatasetKey}
              >
                <option value="medicines">Medicines</option>
                <option value="suppliers">Suppliers</option>
                <option value="customers">Customers</option>
                <option value="stock_summary">Stock summary</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Format
              <select
                className={inputClassName}
                onChange={(event) => setExportFormat(event.target.value as "csv" | "xlsx")}
                value={exportFormat}
              >
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="csv">CSV</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Search
              <input
                className={inputClassName}
                onChange={(event) => setExportSearch(event.target.value)}
                placeholder="Optional search filter"
                value={exportSearch}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Status
              <select
                className={inputClassName}
                onChange={(event) =>
                  setExportStatus(event.target.value as "" | "active" | "inactive")
                }
                value={exportStatus}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <button
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
              type="button"
            >
              {exportMutation.isPending ? "Preparing..." : "Export dataset"}
            </button>
          </div>

          {exportDatasetKey === "stock_summary" ? (
            <label className="mt-4 flex items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                checked={stockLowOnly}
                className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-teal-500"
                onChange={(event) => setStockLowOnly(event.target.checked)}
                type="checkbox"
              />
              Export only low-stock medicines
            </label>
          ) : null}
        </SectionCard>
      ) : null}

      {activeSection === "backup" ? (
        <div className="space-y-6">
          <SectionCard
            title="Manual backup"
            description="Create a shop-scoped snapshot of profile, settings, master data, and contact data for controlled recovery."
            action={
              <button
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={createBackupMutation.isPending}
                onClick={() => createBackupMutation.mutate()}
                type="button"
              >
                {createBackupMutation.isPending ? "Creating..." : "Create backup"}
              </button>
            }
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  ["includeShopProfile", "Shop profile"],
                  ["includeSettings", "Admin settings"],
                  ["includeMasters", "Masters"],
                  ["includeContacts", "Suppliers & customers"],
                ] as const
              ).map(([key, label]) => (
                <label
                  className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
                  key={key}
                >
                  <input
                    checked={backupOptions[key]}
                    className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-teal-500"
                    onChange={(event) =>
                      setBackupOptions((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  {label}
                </label>
              ))}
            </div>

            {restoreResult ? (
              <div className="mt-5 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4">
                <p className="text-sm font-semibold text-emerald-900">
                  Restore completed for {restoreResult.fileName}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {Object.entries(restoreResult.summary).map(([key, value]) => (
                    <div key={key} className="rounded-2xl bg-white px-3 py-2.5 text-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {humanizeLabel(key)}
                      </p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {formatNumber(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Backup history"
            description="Download previous snapshots or launch the guarded restore flow for the same shop."
          >
            {backupItems.length ? (
              <div className="space-y-4">
                <div className="grid gap-3 lg:hidden">
                  {backupItems.map((backup) => (
                    <article
                      className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                      key={backup.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {backup.fileName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatFileSize(backup.fileSizeBytes)}
                          </p>
                        </div>
                        <StatusBadge label={backup.status} />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                          onClick={() => downloadBackup(backup.id, backup.fileName)}
                          type="button"
                        >
                          Download
                        </button>
                        <button
                          className="rounded-2xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                          onClick={() => {
                            setRestoreTarget(backup);
                            setRestoreConfirmationText("");
                          }}
                          type="button"
                        >
                          Restore
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="min-w-[1080px] w-full border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <th className="px-4">File</th>
                        <th className="px-4">Status</th>
                        <th className="px-4">Size</th>
                        <th className="px-4">Created by</th>
                        <th className="px-4">Created</th>
                        <th className="px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backupItems.map((backup) => (
                        <tr className="bg-slate-50" key={backup.id}>
                          <td className="rounded-l-3xl px-4 py-4 font-semibold text-slate-950">
                            {backup.fileName}
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge label={backup.status} />
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-600">
                            {formatFileSize(backup.fileSizeBytes)}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-600">
                            {backup.createdBy.fullName}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-600">
                            {formatDateTime(backup.createdAt)}
                          </td>
                          <td className="rounded-r-3xl px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                                onClick={() => downloadBackup(backup.id, backup.fileName)}
                                type="button"
                              >
                                Download
                              </button>
                              <button
                                className="rounded-2xl border border-rose-200 px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                                onClick={() => {
                                  setRestoreTarget(backup);
                                  setRestoreConfirmationText("");
                                }}
                                type="button"
                              >
                                Restore
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {backupPagination ? (
                  <Pagination
                    page={backupPagination.page}
                    pageSize={backupPagination.pageSize}
                    totalItems={backupPagination.total}
                    totalPages={backupPagination.totalPages}
                    onPageChange={setBackupPage}
                  />
                ) : null}
              </div>
            ) : (
              <EmptyState
                title="No backups created yet"
                description="Create the first manual backup to start keeping controlled restore points for this shop."
              />
            )}
          </SectionCard>
        </div>
      ) : null}

      <Modal
        open={Boolean(selectedImportJobId)}
        title="Import job detail"
        description="Review row-level validation, duplicate handling, and final execution details."
        onClose={() => setSelectedImportJobId(null)}
        panelClassName="max-w-6xl"
      >
        {importJobDetailQuery.isLoading ? (
          <LoadingState title="Loading import detail" />
        ) : activeImportDetail ? (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              {[
                ["Status", activeImportDetail.status],
                ["Total rows", activeImportDetail.totalRows],
                ["Valid", activeImportDetail.validRows],
                ["Invalid", activeImportDetail.invalidRows],
                ["Duplicates", activeImportDetail.duplicateRows],
                ["Success", activeImportDetail.successRows],
              ].map(([label, value]) => (
                <div
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3"
                  key={label}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {label}
                  </p>
                  <div className="mt-2">
                    {typeof value === "string" ? (
                      <StatusBadge label={value} />
                    ) : (
                      <p className="text-xl font-semibold text-slate-950">
                        {formatNumber(value)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {activeImportDetail.rows.length ? (
              <div className="space-y-3">
                <div className="grid gap-3 lg:hidden">
                  {activeImportDetail.rows.map((row: ImportRowDetail) => (
                    <article
                      className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                      key={row.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            Row {row.rowNumber}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {row.identifier ?? "No identifier"}
                          </p>
                        </div>
                        <StatusBadge label={row.status} />
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Action
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-900">
                            {row.action ? humanizeLabel(row.action) : "Not set"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Identifier
                          </p>
                          <p className="mt-1 break-words text-sm font-medium text-slate-900">
                            {row.identifier ?? "No identifier"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {renderMessages(row.errors, "error")}
                        {renderMessages(row.warnings, "warning")}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="min-w-[1120px] w-full border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <th className="px-4">Row</th>
                        <th className="px-4">Status</th>
                        <th className="px-4">Action</th>
                        <th className="px-4">Identifier</th>
                        <th className="px-4">Errors</th>
                        <th className="px-4">Warnings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeImportDetail.rows.map((row: ImportRowDetail) => (
                        <tr className="bg-slate-50" key={row.id}>
                          <td className="rounded-l-3xl px-4 py-4 text-sm font-semibold text-slate-950">
                            {row.rowNumber}
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge label={row.status} />
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {row.action ? humanizeLabel(row.action) : "Not set"}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-600">
                            {row.identifier ?? "No identifier"}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-600">
                            {row.errors.join(" ") || "No issues"}
                          </td>
                          <td className="rounded-r-3xl px-4 py-4 text-sm text-slate-600">
                            {row.warnings.join(" ") || "None"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No row detail found"
                description="This import job does not contain any stored row-level preview records."
              />
            )}
          </div>
        ) : (
          <ErrorState
            title="Unable to load import detail"
            description={importJobDetailQuery.error?.message ?? "Please retry."}
            onRetry={() => importJobDetailQuery.refetch()}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        title="Restore backup"
        description="This controlled restore is admin-only and does not silently delete live records. It merges safe data back into the same shop after validation."
        confirmLabel="Run restore"
        tone="danger"
        isLoading={restoreMutation.isPending}
        onClose={() => {
          setRestoreTarget(null);
          setRestoreConfirmationText("");
        }}
        onConfirm={() => restoreMutation.mutate()}
        extraContent={
          restoreTarget ? (
            <div className="space-y-3">
              <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Type <strong>{`RESTORE ${restoreTarget.fileName}`}</strong> to confirm this restore.
              </div>
              <input
                className={inputClassName}
                onChange={(event) => setRestoreConfirmationText(event.target.value)}
                placeholder={`RESTORE ${restoreTarget.fileName}`}
                value={restoreConfirmationText}
              />
            </div>
          ) : null
        }
      />
    </div>
  );
};
