import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import ExcelJS from "exceljs";
import {
  and,
  asc,
  desc,
  eq,
  like,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { env } from "../../config/env";
import { db } from "../../db/client";
import {
  customerCounters,
  customers,
  importJobRows,
  manufacturers,
  medicineCategories,
  medicines,
  shopSettings,
  shops,
  suppliers,
} from "../../db/schema";
import { AppError } from "../../shared/errors/app-error";
import { normalizePhoneNumber } from "../../shared/utils/phone";
import {
  collapseWhitespace,
  normalizeEmail,
  toSlug,
} from "../../shared/utils/strings";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { BranchesRepository } from "../branches/branches.repository";
import { BranchesService } from "../branches/branches.service";
import { InventoryRepository } from "../inventory/inventory.repository";
import { DataManagementRepository } from "./data-management.repository";
import type {
  CreateBackupInput,
  DownloadTemplateQuery,
  DuplicateMode,
  ExportDatasetQuery,
  ImportType,
  ListBackupsQuery,
  ListImportJobsQuery,
  RestoreBackupInput,
  ValidateImportInput,
} from "./data-management.validation";

type AuthContext = {
  id: string;
  shopId: string;
  role: "admin" | "staff" | "accountant";
  fullName: string;
  shopName: string;
  shopSlug: string | undefined;
};

type FileFormat = "csv" | "xlsx";
type ImportRowStatus =
  | "valid"
  | "invalid"
  | "duplicate"
  | "skipped"
  | "imported"
  | "failed";
type ImportRowAction = "create" | "update" | "skip" | "fail";
type MasterStatus = "active" | "inactive";
type MedicineForm =
  | "tablet"
  | "capsule"
  | "syrup"
  | "injection"
  | "ointment"
  | "cream"
  | "drops"
  | "inhaler"
  | "powder"
  | "gel"
  | "lotion"
  | "solution"
  | "suspension"
  | "spray"
  | "vial"
  | "sachet"
  | "other";
type MedicineUnit =
  | "strip"
  | "bottle"
  | "piece"
  | "box"
  | "vial"
  | "tube"
  | "sachet"
  | "ampoule"
  | "packet"
  | "kit"
  | "container"
  | "canister"
  | "other";
type CustomerGender = "male" | "female" | "other";

type JsonRecord = Record<string, unknown>;

type TemplateDefinition = {
  sheetName: string;
  headers: string[];
  requiredHeaders: string[];
  example: Record<string, string>;
};

type PreviewRowRecord = {
  rowNumber: number;
  status: ImportRowStatus;
  action: ImportRowAction;
  identifier: string | null;
  rawData: JsonRecord;
  normalizedData: JsonRecord | null;
  errors: string[];
  warnings: string[];
  targetEntityId: string | null;
};

type MedicineImportRecord = {
  medicineName: string;
  genericName: string;
  brandName: string | undefined;
  strength: string | undefined;
  form: MedicineForm;
  unit: MedicineUnit;
  categoryName: string;
  categoryId: string;
  manufacturerName: string;
  manufacturerId: string;
  hsnCode: string | undefined;
  gstPercent: number;
  barcode: string | undefined;
  reorderLevel: number;
  prescriptionRequired: boolean;
  status: MasterStatus;
  notes: string | undefined;
  duplicateKind: "file" | "database" | undefined;
};

type SupplierImportRecord = {
  supplierName: string;
  companyName: string | undefined;
  contactPerson: string | undefined;
  mobileNumber: string;
  alternateMobileNumber: string | undefined;
  email: string | undefined;
  gstNumber: string | undefined;
  drugLicenseNumber: string | undefined;
  addressLine1: string | undefined;
  addressLine2: string | undefined;
  city: string | undefined;
  state: string | undefined;
  pincode: string | undefined;
  openingBalance: string;
  status: MasterStatus;
  notes: string | undefined;
  duplicateKind: "file" | "database" | undefined;
};

type CustomerImportRecord = {
  fullName: string;
  mobileNumber: string;
  alternateMobileNumber: string | undefined;
  email: string | undefined;
  gender: CustomerGender | undefined;
  age: number | undefined;
  dateOfBirth: string | undefined;
  addressLine1: string | undefined;
  addressLine2: string | undefined;
  city: string | undefined;
  state: string | undefined;
  pincode: string | undefined;
  status: MasterStatus;
  notes: string | undefined;
  duplicateKind: "file" | "database" | undefined;
};

type RestoreSummary = {
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

type BackupPayload = {
  version: 1;
  type: "shop_snapshot";
  generatedAt: string;
  shop: {
    id: string;
    name: string;
    slug: string;
    profile?: JsonRecord;
    settings?: JsonRecord | null;
  };
  data: {
    categories?: Array<Record<string, unknown>>;
    manufacturers?: Array<Record<string, unknown>>;
    medicines?: Array<Record<string, unknown>>;
    suppliers?: Array<Record<string, unknown>>;
    customers?: Array<Record<string, unknown>>;
  };
  metadata: {
    includeShopProfile: boolean;
    includeSettings: boolean;
    includeMasters: boolean;
    includeContacts: boolean;
    counts: Record<string, number>;
  };
};

const buildBackupReferenceNameMap = (rows: Array<Record<string, unknown>> | undefined) =>
  new Map(
    (rows ?? [])
      .map((row) => {
        const id = toOptionalString(row.id, 64);
        const name = toOptionalString(row.name, 160);

        if (!id || !name) {
          return null;
        }

        return [id, name] as const;
      })
      .filter((entry): entry is readonly [string, string] => entry !== null),
  );

const BACKUP_DIRECTORY = env.backupStorageDirectory;
const GST_PERCENTAGES = [0, 5, 12, 18, 28];
const MEDICINE_FORMS: MedicineForm[] = [
  "tablet",
  "capsule",
  "syrup",
  "injection",
  "ointment",
  "cream",
  "drops",
  "inhaler",
  "powder",
  "gel",
  "lotion",
  "solution",
  "suspension",
  "spray",
  "vial",
  "sachet",
  "other",
];
const MEDICINE_UNITS: MedicineUnit[] = [
  "strip",
  "bottle",
  "piece",
  "box",
  "vial",
  "tube",
  "sachet",
  "ampoule",
  "packet",
  "kit",
  "container",
  "canister",
  "other",
];
const MASTER_STATUSES: MasterStatus[] = ["active", "inactive"];
const CUSTOMER_GENDERS: CustomerGender[] = ["male", "female", "other"];

const IMPORT_TEMPLATES: Record<ImportType, TemplateDefinition> = {
  medicines: {
    sheetName: "Medicine Import",
    headers: [
      "medicineName",
      "genericName",
      "brandName",
      "strength",
      "form",
      "unit",
      "categoryName",
      "manufacturerName",
      "hsnCode",
      "gstPercent",
      "barcode",
      "reorderLevel",
      "prescriptionRequired",
      "status",
      "notes",
    ],
    requiredHeaders: [
      "medicineName",
      "genericName",
      "form",
      "unit",
      "categoryName",
      "manufacturerName",
      "gstPercent",
    ],
    example: {
      medicineName: "Paracetamol 500",
      genericName: "Paracetamol",
      brandName: "Calpol",
      strength: "500 mg",
      form: "tablet",
      unit: "strip",
      categoryName: "Analgesics",
      manufacturerName: "ABC Pharma",
      hsnCode: "3004",
      gstPercent: "12",
      barcode: "8901234567890",
      reorderLevel: "25",
      prescriptionRequired: "false",
      status: "active",
      notes: "Keep away from moisture",
    },
  },
  suppliers: {
    sheetName: "Supplier Import",
    headers: [
      "supplierName",
      "companyName",
      "contactPerson",
      "mobileNumber",
      "alternateMobileNumber",
      "email",
      "gstNumber",
      "drugLicenseNumber",
      "addressLine1",
      "addressLine2",
      "city",
      "state",
      "pincode",
      "openingBalance",
      "status",
      "notes",
    ],
    requiredHeaders: ["supplierName", "mobileNumber"],
    example: {
      supplierName: "Raj Medical Agencies",
      companyName: "Raj Healthcare Pvt Ltd",
      contactPerson: "Rakesh Jain",
      mobileNumber: "+919876543210",
      alternateMobileNumber: "",
      email: "sales@rajmedical.in",
      gstNumber: "27ABCDE1234F1Z5",
      drugLicenseNumber: "DL-4455-9988",
      addressLine1: "12 Market Road",
      addressLine2: "",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      openingBalance: "0.00",
      status: "active",
      notes: "Primary distributor",
    },
  },
  customers: {
    sheetName: "Customer Import",
    headers: [
      "fullName",
      "mobileNumber",
      "alternateMobileNumber",
      "email",
      "gender",
      "age",
      "dateOfBirth",
      "addressLine1",
      "addressLine2",
      "city",
      "state",
      "pincode",
      "status",
      "notes",
    ],
    requiredHeaders: ["fullName", "mobileNumber"],
    example: {
      fullName: "Anita Sharma",
      mobileNumber: "+919812345678",
      alternateMobileNumber: "",
      email: "anita@example.com",
      gender: "female",
      age: "34",
      dateOfBirth: "1992-08-18",
      addressLine1: "Flat 22, Green View",
      addressLine2: "",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      status: "active",
      notes: "Chronic care customer",
    },
  },
};

const buildAppError = (
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
) =>
  new AppError({
    statusCode,
    code,
    message,
    ...(details !== undefined ? { details } : {}),
  });

const buildPaginatedResponse = <T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
) => ({
  items,
  pagination: {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  },
});

const normalizeSearch = (value?: string) =>
  value ? collapseWhitespace(value).toLowerCase() : undefined;

const normalizeName = (value: string) => collapseWhitespace(value).toLowerCase();
const toOptionalString = (value: unknown, max: number) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = collapseWhitespace(String(value));
  if (!normalized.length) {
    return undefined;
  }

  return normalized.slice(0, max);
};

const toOptionalTrimmed = (value: unknown, max: number) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  if (!normalized.length) {
    return undefined;
  }

  return normalized.slice(0, max);
};

const toHeaderKey = (value: string) =>
  collapseWhitespace(value.replace(/^\uFEFF/, "")).toLowerCase();

const escapeCsvValue = (value: unknown) => {
  const normalized = value === null || value === undefined ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
};

const buildCsvBuffer = (
  headers: string[],
  rows: Array<Record<string, unknown>>,
) =>
  Buffer.from(
    [
      headers.map(escapeCsvValue).join(","),
      ...rows.map((row) =>
        headers.map((header) => escapeCsvValue(row[header])).join(","),
      ),
    ].join("\n"),
    "utf8",
  );

const buildWorkbookBuffer = async (
  sheetName: string,
  headers: string[],
  rows: Array<Record<string, unknown>>,
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));

  worksheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.min(Math.max(header.length + 6, 18), 28),
  }));

  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "10293A" },
  };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  rows.forEach((row) => {
    worksheet.addRow(
      Object.fromEntries(headers.map((header) => [header, row[header] ?? ""])),
    );
  });

  return workbook.xlsx.writeBuffer();
};

const parseCsvMatrix = (text: string) => {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    const nextCharacter = text[index + 1];

    if (inQuotes) {
      if (character === '"' && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
        continue;
      }

      if (character === '"') {
        inQuotes = false;
        continue;
      }

      currentCell += character;
      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (character === "\n") {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    if (character !== "\r") {
      currentCell += character;
    }
  }

  if (currentCell.length || currentRow.length) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
};

const parseBooleanValue = (value: unknown) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized.length) {
    return undefined;
  }

  if (["true", "yes", "1"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "0"].includes(normalized)) {
    return false;
  }

  return null;
};

const parseIntegerValue = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  if (!normalized.length) {
    return undefined;
  }

  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }

  return Number.parseInt(normalized, 10);
};

const parseMoneyValue = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  if (!normalized.length) {
    return undefined;
  }

  if (!/^-?\d{1,11}(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  return Number(normalized).toFixed(2);
};

const parseDateValue = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  if (!normalized.length) {
    return undefined;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const mapFileFormat = (fileName: string): FileFormat => {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".csv") {
    return "csv";
  }

  if (extension === ".xlsx") {
    return "xlsx";
  }

  throw buildAppError(
    422,
    "IMPORT_FILE_FORMAT_INVALID",
    "Only CSV and XLSX files are supported for import.",
  );
};

const readWorksheetMatrix = async (format: FileFormat, fileBuffer: Buffer) => {
  if (format === "csv") {
    return parseCsvMatrix(fileBuffer.toString("utf8"));
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    fileBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw buildAppError(
      422,
      "IMPORT_FILE_EMPTY",
      "The uploaded workbook does not contain any worksheet.",
    );
  }

  const matrix: string[][] = [];
  worksheet.eachRow((row) => {
    const values = row.values as Array<unknown>;
    matrix.push(
      values
        .slice(1)
        .map((value) =>
          value === null || value === undefined ? "" : String(value).trim(),
        ),
    );
  });

  return matrix;
};

const requireString = (
  value: unknown,
  label: string,
  min: number,
  max: number,
  errors: string[],
) => {
  const normalized = toOptionalString(value, max);
  if (!normalized || normalized.length < min) {
    errors.push(`${label} is required.`);
    return undefined;
  }

  return normalized;
};

const parseEnumValue = <T extends string>(
  value: unknown,
  label: string,
  allowed: readonly T[],
  errors: string[],
) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase() as T;

  if (!allowed.includes(normalized)) {
    errors.push(`${label} must be one of: ${allowed.join(", ")}.`);
    return undefined;
  }

  return normalized;
};

const mapImportRowResponse = (row: typeof importJobRows.$inferSelect) => ({
  id: row.id,
  rowNumber: row.rowNumber,
  status: row.status,
  action: row.action,
  identifier: row.identifier,
  rawData: row.rawData,
  normalizedData: row.normalizedData,
  errors: row.errors,
  warnings: row.warnings,
  targetEntityId: row.targetEntityId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class DataManagementService {
  constructor(
    private readonly repository = new DataManagementRepository(),
    private readonly auditLogsService = new AuditLogsService(),
    private readonly inventoryRepository = new InventoryRepository(),
    private readonly branchesRepository = new BranchesRepository(),
    private readonly branchesService = new BranchesService(),
  ) {}

  async downloadTemplate(auth: AuthContext, query: DownloadTemplateQuery) {
    const template = IMPORT_TEMPLATES[query.importType];
    const rows = [template.example];
    const buffer =
      query.format === "csv"
        ? buildCsvBuffer(template.headers, rows)
        : await buildWorkbookBuffer(template.sheetName, template.headers, rows);

    await this.auditLogsService.record({
      actor: auth,
      module: "data_management",
      action: "template.downloaded",
      entityType: "import_template",
      entityId: query.importType,
      title: "Import template downloaded",
      description: `${auth.fullName} downloaded the ${query.importType} import template.`,
      metadata: {
        importType: query.importType,
        format: query.format,
      },
    });

    return {
      buffer,
      contentType:
        query.format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName: `${query.importType}-template.${query.format}`,
    };
  }

  async validateImport(auth: AuthContext, input: ValidateImportInput) {
    const format = mapFileFormat(input.fileName);
    let fileBuffer: Buffer;

    try {
      fileBuffer = Buffer.from(input.fileContentBase64, "base64");
    } catch {
      throw buildAppError(
        422,
        "IMPORT_FILE_INVALID",
        "The uploaded file content could not be decoded.",
      );
    }

    const matrix = await readWorksheetMatrix(format, fileBuffer);
    const template = IMPORT_TEMPLATES[input.importType];
    const [headerRow, ...dataRows] = matrix;

    if (!headerRow?.length) {
      throw buildAppError(
        422,
        "IMPORT_FILE_EMPTY",
        "The uploaded file does not contain any header row.",
      );
    }

    const headerIndex = new Map<string, number>();
    headerRow.forEach((header, index) => {
      headerIndex.set(toHeaderKey(header), index);
    });

    const missingHeaders = template.requiredHeaders.filter(
      (header) => !headerIndex.has(toHeaderKey(header)),
    );

    if (missingHeaders.length) {
      throw buildAppError(
        422,
        "IMPORT_HEADERS_INVALID",
        "The uploaded file is missing required columns for the selected import type.",
        missingHeaders.map((header) => ({
          path: header,
          message: "Required header is missing.",
        })),
      );
    }

    const preparedRows = dataRows
      .map((cells, rowIndex) => {
        const rawData = Object.fromEntries(
          template.headers.map((header) => [
            header,
            cells[headerIndex.get(toHeaderKey(header)) ?? -1] ?? "",
          ]),
        ) as JsonRecord;

        const hasValues = Object.values(rawData).some((value) =>
          String(value ?? "").trim().length,
        );

        return hasValues
          ? {
              rowNumber: rowIndex + 2,
              rawData,
            }
          : null;
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (!preparedRows.length) {
      throw buildAppError(
        422,
        "IMPORT_FILE_EMPTY",
        "The uploaded file does not contain any data rows.",
      );
    }

    const previewRows = await this.buildPreviewRows(
      auth.shopId,
      input.importType,
      input.duplicateMode,
      preparedRows,
    );

    const summary = {
      totalRows: previewRows.length,
      validRows: previewRows.filter((row) => row.status === "valid").length,
      invalidRows: previewRows.filter((row) => row.status === "invalid").length,
      duplicateRows: previewRows.filter((row) => row.status === "duplicate").length,
      warningRows: previewRows.filter((row) => row.warnings.length > 0).length,
      successRows: 0,
      failedRows: 0,
    };

    const job = await this.repository.createImportJob({
      shopId: auth.shopId,
      importType: input.importType,
      fileName: input.fileName,
      fileFormat: format,
      status: "validated",
      duplicateMode: input.duplicateMode,
      totalRows: summary.totalRows,
      validRows: summary.validRows,
      invalidRows: summary.invalidRows,
      duplicateRows: summary.duplicateRows,
      warningRows: summary.warningRows,
      successRows: 0,
      failedRows: 0,
      summary: {
        importType: input.importType,
        duplicateMode: input.duplicateMode,
      },
      createdByUserId: auth.id,
      startedAt: new Date(),
    });

    if (!job) {
      throw buildAppError(
        500,
        "IMPORT_JOB_CREATE_FAILED",
        "The import preview could not be created.",
      );
    }

    await this.repository.replaceImportRows(
      job.id,
      previewRows.map((row) => ({
        jobId: job.id,
        shopId: auth.shopId,
        rowNumber: row.rowNumber,
        status: row.status,
        action: row.action,
        identifier: row.identifier,
        rawData: row.rawData,
        normalizedData: row.normalizedData,
        errors: row.errors,
        warnings: row.warnings,
        targetEntityId: row.targetEntityId,
      })),
    );

    await this.auditLogsService.record({
      actor: auth,
      module: "data_management",
      action: "import.validated",
      entityType: "import_job",
      entityId: job.id,
      severity: "important",
      title: "Import validated",
      description: `${auth.fullName} validated a ${input.importType} import file.`,
      metadata: {
        importType: input.importType,
        duplicateMode: input.duplicateMode,
        fileName: input.fileName,
        ...summary,
      },
    });

    return this.getImportJobDetail(auth.shopId, job.id);
  }

  async confirmImport(auth: AuthContext, jobId: string) {
    const jobRecord = await this.repository.findImportJobById(auth.shopId, jobId);

    if (!jobRecord) {
      throw buildAppError(404, "IMPORT_JOB_NOT_FOUND", "Import job not found.");
    }

    const rows = await this.repository.listImportRows(auth.shopId, jobId);
    const duplicateMode = jobRecord.job.duplicateMode as DuplicateMode;
    const invalidRows = rows.filter((row) => row.status === "invalid").length;
    const duplicateRows = rows.filter((row) => row.status === "duplicate").length;

    try {
      if (invalidRows > 0) {
        throw buildAppError(
          409,
          "IMPORT_JOB_HAS_INVALID_ROWS",
          "Please fix all invalid rows before confirming this import.",
        );
      }

      if (duplicateMode === "fail_duplicates" && duplicateRows > 0) {
        throw buildAppError(
          409,
          "IMPORT_JOB_HAS_DUPLICATES",
          "This import cannot be confirmed while duplicate rows are present.",
        );
      }

      await db.transaction(async (tx) => {
        await this.repository.updateImportJob(
          jobId,
          {
            status: "processing",
            confirmedAt: new Date(),
          },
          tx,
        );

        const finalRows: PreviewRowRecord[] = [];
        let successRows = 0;

        for (const row of rows) {
          const normalizedData = row.normalizedData as JsonRecord | null;

          if (row.status === "invalid" || !normalizedData) {
            finalRows.push({
              rowNumber: row.rowNumber,
              status: row.status,
              action: (row.action as ImportRowAction | null) ?? "fail",
              identifier: row.identifier,
              rawData: row.rawData,
              normalizedData,
              errors: row.errors,
              warnings: row.warnings,
              targetEntityId: row.targetEntityId,
            });
            continue;
          }

          const duplicateKind = normalizedData.duplicateKind as
            | "file"
            | "database"
            | undefined;

          if (duplicateKind === "file" || row.action === "skip") {
            finalRows.push({
              rowNumber: row.rowNumber,
              status: "skipped",
              action: "skip",
              identifier: row.identifier,
              rawData: row.rawData,
              normalizedData,
              errors: row.errors,
              warnings: row.warnings,
              targetEntityId: row.targetEntityId,
            });
            continue;
          }

          const result = await this.applyImportRow(
            auth.shopId,
            jobRecord.job.importType,
            duplicateMode,
            row,
            tx,
          );

          successRows += result.status === "imported" ? 1 : 0;
          finalRows.push(result);
        }

        await this.repository.replaceImportRows(
          jobId,
          finalRows.map((row) => ({
            jobId,
            shopId: auth.shopId,
            rowNumber: row.rowNumber,
            status: row.status,
            action: row.action,
            identifier: row.identifier,
            rawData: row.rawData,
            normalizedData: row.normalizedData,
            errors: row.errors,
            warnings: row.warnings,
            targetEntityId: row.targetEntityId,
          })),
          tx,
        );

        await this.repository.updateImportJob(
          jobId,
          {
            status: "completed",
            successRows,
            failedRows: 0,
            completedAt: new Date(),
          },
          tx,
        );
      });

      await this.auditLogsService.record({
        actor: auth,
        module: "data_management",
        action: "import.completed",
        entityType: "import_job",
        entityId: jobId,
        severity: "important",
        title: "Import completed",
        description: `${auth.fullName} confirmed import job ${jobRecord.job.fileName}.`,
        metadata: {
          importType: jobRecord.job.importType,
          duplicateMode: jobRecord.job.duplicateMode,
        },
      });
    } catch (error) {
      await this.repository.updateImportJob(jobId, {
        status: "failed",
        completedAt: new Date(),
      });

      await this.auditLogsService.record({
        actor: auth,
        module: "data_management",
        action: "import.failed",
        entityType: "import_job",
        entityId: jobId,
        severity: "critical",
        title: "Import failed",
        description: `${auth.fullName} attempted to confirm an import that failed.`,
        metadata: {
          importType: jobRecord.job.importType,
          error:
            error instanceof Error ? error.message : "Unknown import confirmation error",
        },
      });

      throw error;
    }

    return this.getImportJobDetail(auth.shopId, jobId);
  }

  async listImportJobs(shopId: string, query: ListImportJobsQuery) {
    const [items, total] = await Promise.all([
      this.repository.listImportJobs(shopId, query),
      this.repository.countImportJobs(shopId, query),
    ]);

    return buildPaginatedResponse(
      items.map((item) => ({
        id: item.job.id,
        importType: item.job.importType,
        fileName: item.job.fileName,
        fileFormat: item.job.fileFormat,
        status: item.job.status,
        duplicateMode: item.job.duplicateMode,
        totalRows: item.job.totalRows,
        validRows: item.job.validRows,
        invalidRows: item.job.invalidRows,
        duplicateRows: item.job.duplicateRows,
        successRows: item.job.successRows,
        failedRows: item.job.failedRows,
        createdAt: item.job.createdAt,
        startedAt: item.job.startedAt,
        completedAt: item.job.completedAt,
        createdBy: item.createdBy,
      })),
      total,
      query.page,
      query.pageSize,
    );
  }

  async getImportJobDetail(shopId: string, jobId: string) {
    const jobRecord = await this.repository.findImportJobById(shopId, jobId);

    if (!jobRecord) {
      throw buildAppError(404, "IMPORT_JOB_NOT_FOUND", "Import job not found.");
    }

    const rows = await this.repository.listImportRows(shopId, jobId);

    return {
      id: jobRecord.job.id,
      importType: jobRecord.job.importType,
      fileName: jobRecord.job.fileName,
      fileFormat: jobRecord.job.fileFormat,
      status: jobRecord.job.status,
      duplicateMode: jobRecord.job.duplicateMode,
      totalRows: jobRecord.job.totalRows,
      validRows: jobRecord.job.validRows,
      invalidRows: jobRecord.job.invalidRows,
      duplicateRows: jobRecord.job.duplicateRows,
      warningRows: jobRecord.job.warningRows,
      successRows: jobRecord.job.successRows,
      failedRows: jobRecord.job.failedRows,
      summary: jobRecord.job.summary,
      startedAt: jobRecord.job.startedAt,
      confirmedAt: jobRecord.job.confirmedAt,
      completedAt: jobRecord.job.completedAt,
      createdAt: jobRecord.job.createdAt,
      createdBy: jobRecord.createdBy,
      rows: rows.map(mapImportRowResponse),
    };
  }

  async exportDataset(auth: AuthContext, query: ExportDatasetQuery) {
    const dataset = await this.buildDatasetExport(auth.shopId, query);

    await this.auditLogsService.record({
      actor: auth,
      module: "data_management",
      action: "export.generated",
      entityType: "export_dataset",
      entityId: query.dataset,
      title: "Dataset exported",
      description: `${auth.fullName} exported ${query.dataset} data.`,
      metadata: {
        dataset: query.dataset,
        format: query.format,
      },
    });

    return {
      buffer:
        query.format === "csv"
          ? buildCsvBuffer(dataset.headers, dataset.rows)
          : await buildWorkbookBuffer(dataset.sheetName, dataset.headers, dataset.rows),
      contentType:
        query.format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName: `${dataset.fileName}.${query.format}`,
    };
  }

  async createBackup(auth: AuthContext, input: CreateBackupInput) {
    const [shopRecord, settingsRecord, categoriesData, manufacturersData, medicinesData, suppliersData, customersData] =
      await Promise.all([
        db.query.shops.findFirst({
          where: eq(shops.id, auth.shopId),
        }),
        db.query.shopSettings.findFirst({
          where: eq(shopSettings.shopId, auth.shopId),
        }),
        input.includeMasters
          ? db
              .select()
              .from(medicineCategories)
              .where(eq(medicineCategories.shopId, auth.shopId))
              .orderBy(asc(medicineCategories.normalizedName))
          : Promise.resolve([]),
        input.includeMasters
          ? db
              .select()
              .from(manufacturers)
              .where(eq(manufacturers.shopId, auth.shopId))
              .orderBy(asc(manufacturers.normalizedName))
          : Promise.resolve([]),
        input.includeMasters
          ? db
              .select()
              .from(medicines)
              .where(eq(medicines.shopId, auth.shopId))
              .orderBy(asc(medicines.medicineNameNormalized))
          : Promise.resolve([]),
        input.includeContacts
          ? db
              .select()
              .from(suppliers)
              .where(eq(suppliers.shopId, auth.shopId))
              .orderBy(asc(suppliers.supplierNameNormalized))
          : Promise.resolve([]),
        input.includeContacts
          ? db
              .select()
              .from(customers)
              .where(eq(customers.shopId, auth.shopId))
              .orderBy(asc(customers.fullNameNormalized))
          : Promise.resolve([]),
      ]);

    if (!shopRecord) {
      throw buildAppError(404, "SHOP_NOT_FOUND", "Shop not found.");
    }

    const categoryNameById = new Map(categoriesData.map((item) => [item.id, item.name]));
    const manufacturerNameById = new Map(
      manufacturersData.map((item) => [item.id, item.name]),
    );

    const payload: BackupPayload = {
      version: 1,
      type: "shop_snapshot",
      generatedAt: new Date().toISOString(),
      shop: {
        id: shopRecord.id,
        name: shopRecord.name,
        slug: shopRecord.slug,
        ...(input.includeShopProfile
          ? {
              profile: {
                name: shopRecord.name,
                phone: shopRecord.phone,
                email: shopRecord.email,
                addressLine1: shopRecord.addressLine1,
                addressLine2: shopRecord.addressLine2,
                city: shopRecord.city,
                state: shopRecord.state,
                pincode: shopRecord.pincode,
                gstNumber: shopRecord.gstNumber,
                licenseNumber: shopRecord.licenseNumber,
                invoicePrefix: shopRecord.invoicePrefix,
              },
            }
          : {}),
        ...(input.includeSettings ? { settings: settingsRecord ?? null } : {}),
      },
      data: {
        ...(input.includeMasters
          ? {
              categories: categoriesData.map((item) => ({ ...item })),
              manufacturers: manufacturersData.map((item) => ({ ...item })),
              medicines: medicinesData.map((item) => ({
                ...item,
                categoryName: categoryNameById.get(item.categoryId) ?? null,
                manufacturerName:
                  manufacturerNameById.get(item.manufacturerId) ?? null,
              })),
            }
          : {}),
        ...(input.includeContacts
          ? {
              suppliers: suppliersData.map((item) => ({ ...item })),
              customers: customersData.map((item) => ({ ...item })),
            }
          : {}),
      },
      metadata: {
        includeShopProfile: input.includeShopProfile,
        includeSettings: input.includeSettings,
        includeMasters: input.includeMasters,
        includeContacts: input.includeContacts,
        counts: {
          categories: categoriesData.length,
          manufacturers: manufacturersData.length,
          medicines: medicinesData.length,
          suppliers: suppliersData.length,
          customers: customersData.length,
        },
      },
    };

    await mkdir(BACKUP_DIRECTORY, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeSlug = toSlug(auth.shopSlug ?? auth.shopName) || "shop";
    const fileName = `${safeSlug}-backup-${timestamp}.json`;
    const storagePath = path.join(BACKUP_DIRECTORY, fileName);
    const fileContent = Buffer.from(JSON.stringify(payload, null, 2), "utf8");

    await writeFile(storagePath, fileContent);

    const record = await this.repository.createBackupRecord({
      shopId: auth.shopId,
      type: "shop_snapshot",
      status: "ready",
      fileName,
      storagePath,
      fileSizeBytes: fileContent.byteLength,
      metadata: payload.metadata as Record<string, unknown>,
      createdByUserId: auth.id,
    });

    if (!record) {
      throw buildAppError(
        500,
        "BACKUP_CREATE_FAILED",
        "Backup record could not be created.",
      );
    }

    await this.auditLogsService.record({
      actor: auth,
      module: "data_management",
      action: "backup.created",
      entityType: "backup_record",
      entityId: record.id,
      severity: "important",
      title: "Backup created",
      description: `${auth.fullName} created a manual backup.`,
      metadata: {
        fileName,
        counts: payload.metadata.counts,
      },
    });

    return this.getBackupDetail(auth.shopId, record.id);
  }

  async listBackups(shopId: string, query: ListBackupsQuery) {
    const [items, total] = await Promise.all([
      this.repository.listBackups(shopId, query),
      this.repository.countBackups(shopId, query),
    ]);

    return buildPaginatedResponse(
      items.map((item) => ({
        id: item.backup.id,
        fileName: item.backup.fileName,
        type: item.backup.type,
        status: item.backup.status,
        fileSizeBytes: item.backup.fileSizeBytes,
        metadata: item.backup.metadata,
        restoredAt: item.backup.restoredAt,
        createdAt: item.backup.createdAt,
        createdBy: item.createdBy,
      })),
      total,
      query.page,
      query.pageSize,
    );
  }

  async getBackupDetail(shopId: string, backupId: string) {
    const record = await this.repository.findBackupById(shopId, backupId);

    if (!record) {
      throw buildAppError(404, "BACKUP_NOT_FOUND", "Backup record not found.");
    }

    return {
      id: record.backup.id,
      fileName: record.backup.fileName,
      type: record.backup.type,
      status: record.backup.status,
      fileSizeBytes: record.backup.fileSizeBytes,
      metadata: record.backup.metadata,
      restoredAt: record.backup.restoredAt,
      createdAt: record.backup.createdAt,
      createdBy: record.createdBy,
      confirmationText: `RESTORE ${record.backup.fileName}`,
    };
  }

  async downloadBackup(auth: AuthContext, backupId: string) {
    const record = await this.repository.findBackupById(auth.shopId, backupId);

    if (!record) {
      throw buildAppError(404, "BACKUP_NOT_FOUND", "Backup record not found.");
    }

    let buffer: Buffer;

    try {
      buffer = await readFile(record.backup.storagePath);
    } catch {
      throw buildAppError(
        404,
        "BACKUP_FILE_MISSING",
        "The backup file is no longer available on the server.",
      );
    }

    await this.auditLogsService.record({
      actor: auth,
      module: "data_management",
      action: "backup.downloaded",
      entityType: "backup_record",
      entityId: record.backup.id,
      title: "Backup downloaded",
      description: `${auth.fullName} downloaded a backup file.`,
      metadata: {
        fileName: record.backup.fileName,
      },
    });

    return {
      buffer,
      contentType: "application/json; charset=utf-8",
      fileName: record.backup.fileName,
    };
  }

  async restoreBackup(
    auth: AuthContext,
    backupId: string,
    input: RestoreBackupInput,
  ) {
    const record = await this.repository.findBackupById(auth.shopId, backupId);

    if (!record) {
      throw buildAppError(404, "BACKUP_NOT_FOUND", "Backup record not found.");
    }

    const requiredConfirmation = `RESTORE ${record.backup.fileName}`;
    if (input.confirmationText !== requiredConfirmation) {
      throw buildAppError(
        422,
        "RESTORE_CONFIRMATION_INVALID",
        "Please enter the exact restore confirmation text to continue.",
      );
    }

    let payload: BackupPayload;

    try {
      payload = JSON.parse(
        await readFile(record.backup.storagePath, "utf8"),
      ) as BackupPayload;
    } catch {
      throw buildAppError(
        422,
        "BACKUP_FILE_INVALID",
        "The selected backup file could not be read or parsed.",
      );
    }

    this.assertBackupPayload(payload, auth.shopId);

    await this.auditLogsService.record({
      actor: auth,
      module: "data_management",
      action: "restore.started",
      entityType: "backup_record",
      entityId: record.backup.id,
      severity: "critical",
      title: "Restore started",
      description: `${auth.fullName} started a controlled restore from backup.`,
      metadata: {
        fileName: record.backup.fileName,
      },
    });

    try {
      const summary = await db.transaction(async (tx) => {
        const restoreSummary = {
          categoriesCreated: 0,
          categoriesUpdated: 0,
          manufacturersCreated: 0,
          manufacturersUpdated: 0,
          medicinesCreated: 0,
          medicinesUpdated: 0,
          medicinesSkipped: 0,
          suppliersCreated: 0,
          suppliersUpdated: 0,
          suppliersSkipped: 0,
          customersCreated: 0,
          customersUpdated: 0,
          customersSkipped: 0,
        };

        if (payload.shop.profile) {
          await tx
            .update(shops)
            .set({
              name: String(payload.shop.profile.name ?? auth.shopName),
              phone: (payload.shop.profile.phone as string | null | undefined) ?? null,
              email: (payload.shop.profile.email as string | null | undefined) ?? null,
              addressLine1:
                (payload.shop.profile.addressLine1 as string | null | undefined) ??
                null,
              addressLine2:
                (payload.shop.profile.addressLine2 as string | null | undefined) ??
                null,
              city: (payload.shop.profile.city as string | null | undefined) ?? null,
              state: (payload.shop.profile.state as string | null | undefined) ?? null,
              pincode:
                (payload.shop.profile.pincode as string | null | undefined) ?? null,
              gstNumber:
                (payload.shop.profile.gstNumber as string | null | undefined) ?? null,
              licenseNumber:
                (payload.shop.profile.licenseNumber as string | null | undefined) ??
                null,
              invoicePrefix:
                (payload.shop.profile.invoicePrefix as string | null | undefined) ??
                "INV",
              updatedAt: new Date(),
            })
            .where(eq(shops.id, auth.shopId));
        }

        if (payload.shop.settings && typeof payload.shop.settings === "object") {
          const { shopId: _shopId, createdAt: _createdAt, ...settingsPayload } =
            payload.shop.settings as typeof shopSettings.$inferInsert;

          await tx
            .insert(shopSettings)
            .values({
              shopId: auth.shopId,
              ...settingsPayload,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: shopSettings.shopId,
              set: {
                ...settingsPayload,
                updatedAt: new Date(),
              },
            });
        }

        const categoryMap = await this.restoreCategories(
          auth.shopId,
          payload.data.categories ?? [],
          restoreSummary,
          tx,
        );
        const manufacturerMap = await this.restoreManufacturers(
          auth.shopId,
          payload.data.manufacturers ?? [],
          restoreSummary,
          tx,
        );
        const backupCategoryNameById = buildBackupReferenceNameMap(
          payload.data.categories,
        );
        const backupManufacturerNameById = buildBackupReferenceNameMap(
          payload.data.manufacturers,
        );

        await this.restoreMedicines(
          auth.shopId,
          payload.data.medicines ?? [],
          categoryMap,
          manufacturerMap,
          backupCategoryNameById,
          backupManufacturerNameById,
          restoreSummary,
          tx,
        );
        await this.restoreSuppliers(
          auth.shopId,
          payload.data.suppliers ?? [],
          restoreSummary,
          tx,
        );
        await this.restoreCustomers(
          auth.shopId,
          payload.data.customers ?? [],
          restoreSummary,
          tx,
        );

        await this.repository.updateBackupRecord(
          backupId,
          {
            status: "restored",
            restoredAt: new Date(),
          },
          tx,
        );

        return restoreSummary;
      });

      await this.auditLogsService.record({
        actor: auth,
        module: "data_management",
        action: "restore.completed",
        entityType: "backup_record",
        entityId: record.backup.id,
        severity: "critical",
        title: "Restore completed",
        description: `${auth.fullName} completed a controlled restore.`,
        metadata: summary,
      });

      return {
        backup: await this.getBackupDetail(auth.shopId, backupId),
        summary,
      };
    } catch (error) {
      await this.repository.updateBackupRecord(backupId, {
        status: "failed",
      });

      await this.auditLogsService.record({
        actor: auth,
        module: "data_management",
        action: "restore.failed",
        entityType: "backup_record",
        entityId: record.backup.id,
        severity: "critical",
        title: "Restore failed",
        description: `${auth.fullName} attempted a restore that failed.`,
        metadata: {
          error:
            error instanceof Error ? error.message : "Unknown restore error",
        },
      });

      throw error;
    }
  }

  private async buildPreviewRows(
    shopId: string,
    importType: ImportType,
    duplicateMode: DuplicateMode,
    rows: Array<{ rowNumber: number; rawData: JsonRecord }>,
  ) {
    if (importType === "medicines") {
      return this.buildMedicinePreviewRows(shopId, duplicateMode, rows);
    }

    if (importType === "suppliers") {
      return this.buildSupplierPreviewRows(shopId, duplicateMode, rows);
    }

    return this.buildCustomerPreviewRows(shopId, duplicateMode, rows);
  }

  private async buildMedicinePreviewRows(
    shopId: string,
    duplicateMode: DuplicateMode,
    rows: Array<{ rowNumber: number; rawData: JsonRecord }>,
  ) {
    const [categoriesData, manufacturersData, medicinesData] = await Promise.all([
      db
        .select()
        .from(medicineCategories)
        .where(eq(medicineCategories.shopId, shopId)),
      db.select().from(manufacturers).where(eq(manufacturers.shopId, shopId)),
      db.select().from(medicines).where(eq(medicines.shopId, shopId)),
    ]);

    const categoryMap = new Map(
      categoriesData.map((item) => [item.normalizedName, item]),
    );
    const manufacturerMap = new Map(
      manufacturersData.map((item) => [item.normalizedName, item]),
    );
    const existingByKey = new Map(
      medicinesData.map((item) => [
        `${item.medicineNameNormalized}|${item.strengthNormalized}|${item.form}|${item.manufacturerId}`,
        item,
      ]),
    );
    const existingByBarcode = new Map(
      medicinesData
        .filter((item) => item.barcode)
        .map((item) => [item.barcode!, item]),
    );
    const seenKeys = new Set<string>();
    const seenBarcodes = new Map<string, number>();

    return rows.map(({ rowNumber, rawData }) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const medicineName = requireString(
        rawData.medicineName,
        "Medicine name",
        2,
        180,
        errors,
      );
      const genericName = requireString(
        rawData.genericName,
        "Generic name",
        2,
        180,
        errors,
      );
      const brandName = toOptionalString(rawData.brandName, 160);
      const strength = toOptionalString(rawData.strength, 80);
      const form = parseEnumValue(
        rawData.form,
        "Form",
        MEDICINE_FORMS,
        errors,
      );
      const unit = parseEnumValue(
        rawData.unit,
        "Unit",
        MEDICINE_UNITS,
        errors,
      );
      const categoryName = requireString(
        rawData.categoryName,
        "Category name",
        2,
        120,
        errors,
      );
      const manufacturerName = requireString(
        rawData.manufacturerName,
        "Manufacturer name",
        2,
        160,
        errors,
      );
      const hsnCode = toOptionalTrimmed(rawData.hsnCode, 20);
      if (hsnCode && !/^\d{4,8}$/.test(hsnCode)) {
        errors.push("HSN code must be 4 to 8 digits.");
      }

      const gstPercent = parseIntegerValue(rawData.gstPercent);
      if (gstPercent === null || gstPercent === undefined) {
        errors.push("GST percent is required.");
      } else if (!GST_PERCENTAGES.includes(gstPercent)) {
        errors.push("GST percent must be 0, 5, 12, 18, or 28.");
      }

      const reorderLevel = parseIntegerValue(rawData.reorderLevel);
      if (reorderLevel === null || reorderLevel === undefined) {
        errors.push("Reorder level is required.");
      } else if (reorderLevel < 0) {
        errors.push("Reorder level must be zero or greater.");
      }

      const prescriptionRequiredValue = String(
        rawData.prescriptionRequired ?? "",
      ).trim();
      const prescriptionRequired = prescriptionRequiredValue.length
        ? parseBooleanValue(rawData.prescriptionRequired)
        : false;
      if (prescriptionRequired === null) {
        errors.push("Prescription required must be true/false.");
      }

      const status = rawData.status
        ? parseEnumValue(rawData.status, "Status", MASTER_STATUSES, errors)
        : "active";
      const notes = toOptionalTrimmed(rawData.notes, 2000);
      const barcode = toOptionalTrimmed(rawData.barcode, 100);

      const normalizedCategory = categoryName ? normalizeName(categoryName) : "";
      const normalizedManufacturer = manufacturerName
        ? normalizeName(manufacturerName)
        : "";
      const category = categoryMap.get(normalizedCategory);
      const manufacturer = manufacturerMap.get(normalizedManufacturer);

      if (categoryName && !category) {
        errors.push("Category name does not match an existing category.");
      }

      if (manufacturerName && !manufacturer) {
        errors.push("Manufacturer name does not match an existing manufacturer.");
      }

      if (errors.length || !medicineName || !genericName || !form || !unit || !category || !manufacturer || gstPercent === null || gstPercent === undefined || reorderLevel === null || reorderLevel === undefined || prescriptionRequired === null || !status) {
        return {
          rowNumber,
          status: "invalid",
          action: "fail",
          identifier: null,
          rawData,
          normalizedData: null,
          errors,
          warnings,
          targetEntityId: null,
        } satisfies PreviewRowRecord;
      }

      const identifier = `${normalizeName(medicineName)}|${normalizeName(
        strength ?? "",
      )}|${form}|${manufacturer.id}`;

      if (seenKeys.has(identifier)) {
        return {
          rowNumber,
          status: "duplicate",
          action: "skip",
          identifier,
          rawData,
          normalizedData: {
            medicineName: medicineName!,
            genericName: genericName!,
            brandName,
            strength,
            form: form!,
            unit: unit!,
            categoryName: categoryName!,
            categoryId: category.id,
            manufacturerName: manufacturerName!,
            manufacturerId: manufacturer.id,
            hsnCode,
            gstPercent,
            barcode,
            reorderLevel,
            prescriptionRequired: prescriptionRequired!,
            status: status!,
            notes,
            duplicateKind: "file",
          } satisfies MedicineImportRecord,
          errors: ["Duplicate medicine row found in the uploaded file."],
          warnings,
          targetEntityId: null,
        } satisfies PreviewRowRecord;
      }

      seenKeys.add(identifier);

      if (barcode) {
        const seenBarcodeRow = seenBarcodes.get(barcode);
        if (seenBarcodeRow) {
          return {
            rowNumber,
            status: "duplicate",
            action: "skip",
            identifier,
            rawData,
            normalizedData: {
              medicineName: medicineName!,
              genericName: genericName!,
              brandName,
              strength,
              form: form!,
              unit: unit!,
              categoryName: categoryName!,
              categoryId: category.id,
              manufacturerName: manufacturerName!,
              manufacturerId: manufacturer.id,
              hsnCode,
              gstPercent,
              barcode,
              reorderLevel,
              prescriptionRequired: prescriptionRequired!,
              status: status!,
              notes,
              duplicateKind: "file",
            } satisfies MedicineImportRecord,
            errors: [
              `Barcode is duplicated inside the file and was first seen on row ${seenBarcodeRow}.`,
            ],
            warnings,
            targetEntityId: null,
          } satisfies PreviewRowRecord;
        }

        seenBarcodes.set(barcode, rowNumber);
      }

      const existingRecord = existingByKey.get(identifier);
      const barcodeConflict =
        barcode && existingByBarcode.get(barcode)?.id !== existingRecord?.id
          ? existingByBarcode.get(barcode)
          : null;

      if (barcodeConflict) {
        return {
          rowNumber,
          status: "invalid",
          action: "fail",
          identifier,
          rawData,
          normalizedData: null,
          errors: ["Barcode already belongs to another medicine in this shop."],
          warnings,
          targetEntityId: null,
        } satisfies PreviewRowRecord;
      }

      if (existingRecord) {
        warnings.push(
          duplicateMode === "update_existing" || duplicateMode === "upsert"
            ? "Existing medicine will be updated on confirm."
            : duplicateMode === "skip_duplicates"
              ? "Existing medicine will be skipped on confirm."
              : "Duplicate medicine blocks confirmation in current mode.",
        );

        return {
          rowNumber,
          status: "duplicate",
          action:
            duplicateMode === "update_existing" || duplicateMode === "upsert"
              ? "update"
              : duplicateMode === "skip_duplicates"
                ? "skip"
                : "fail",
          identifier,
          rawData,
          normalizedData: {
            medicineName: medicineName!,
            genericName: genericName!,
            brandName,
            strength,
            form: form!,
            unit: unit!,
            categoryName: categoryName!,
            categoryId: category.id,
            manufacturerName: manufacturerName!,
            manufacturerId: manufacturer.id,
            hsnCode,
            gstPercent,
            barcode,
            reorderLevel,
            prescriptionRequired: prescriptionRequired!,
            status: status!,
            notes,
            duplicateKind: "database",
          } satisfies MedicineImportRecord,
          errors: ["Medicine already exists in this shop."],
          warnings,
          targetEntityId: existingRecord.id,
        } satisfies PreviewRowRecord;
      }

      return {
        rowNumber,
        status: "valid",
        action: "create",
        identifier,
        rawData,
        normalizedData: {
          medicineName: medicineName!,
          genericName: genericName!,
          brandName,
          strength,
          form: form!,
          unit: unit!,
          categoryName: categoryName!,
          categoryId: category.id,
          manufacturerName: manufacturerName!,
          manufacturerId: manufacturer.id,
          hsnCode,
          gstPercent,
          barcode,
          reorderLevel,
          prescriptionRequired: prescriptionRequired!,
          status: status!,
          notes,
          duplicateKind: undefined,
        } satisfies MedicineImportRecord,
        errors,
        warnings,
        targetEntityId: null,
      } satisfies PreviewRowRecord;
    });
  }

  private async buildSupplierPreviewRows(
    shopId: string,
    duplicateMode: DuplicateMode,
    rows: Array<{ rowNumber: number; rawData: JsonRecord }>,
  ) {
    const suppliersData = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.shopId, shopId));

    const existingByMobile = new Map(
      suppliersData.map((item) => [item.mobileNumber, item]),
    );
    const existingByEmail = new Map(
      suppliersData
        .filter((item) => item.email)
        .map((item) => [normalizeEmail(item.email!), item]),
    );
    const existingByGst = new Map(
      suppliersData
        .filter((item) => item.gstNumber)
        .map((item) => [item.gstNumber!, item]),
    );
    const seenMobiles = new Map<string, number>();
    const seenEmails = new Map<string, number>();
    const seenGst = new Map<string, number>();

    return rows.map(({ rowNumber, rawData }) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const supplierName = requireString(
        rawData.supplierName,
        "Supplier name",
        2,
        180,
        errors,
      );
      const companyName = toOptionalString(rawData.companyName, 180);
      const contactPerson = toOptionalString(rawData.contactPerson, 160);
      const mobileNumber = normalizePhoneNumber(String(rawData.mobileNumber ?? ""));
      if (!mobileNumber) {
        errors.push("Mobile number is invalid.");
      }

      const alternateMobileNumber = toOptionalTrimmed(
        rawData.alternateMobileNumber,
        20,
      );
      const normalizedAlternateMobile = alternateMobileNumber
        ? normalizePhoneNumber(alternateMobileNumber) ?? undefined
        : undefined;
      if (alternateMobileNumber && !normalizedAlternateMobile) {
        errors.push("Alternate mobile number is invalid.");
      }

      if (mobileNumber && normalizedAlternateMobile === mobileNumber) {
        errors.push("Alternate mobile number must be different from mobile number.");
      }

      const email = toOptionalTrimmed(rawData.email, 320);
      const normalizedEmail =
        email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          ? normalizeEmail(email)
          : email
            ? null
            : undefined;
      if (email && !normalizedEmail) {
        errors.push("Email address is invalid.");
      }

      const gstNumber = toOptionalTrimmed(rawData.gstNumber, 15)?.toUpperCase();
      if (gstNumber && !/^[0-9A-Z]{15}$/.test(gstNumber)) {
        errors.push("GST number must be 15 uppercase alphanumeric characters.");
      }

      const drugLicenseNumber = toOptionalString(rawData.drugLicenseNumber, 100);
      const addressLine1 = toOptionalString(rawData.addressLine1, 255);
      const addressLine2 = toOptionalString(rawData.addressLine2, 255);
      const city = toOptionalString(rawData.city, 100);
      const state = toOptionalString(rawData.state, 100);
      const pincode = toOptionalTrimmed(rawData.pincode, 20);
      if (pincode && !/^\d{6}$/.test(pincode)) {
        errors.push("Pincode must be a valid 6-digit code.");
      }

      const openingBalance = parseMoneyValue(rawData.openingBalance ?? "0");
      if (openingBalance === null || openingBalance === undefined) {
        errors.push("Opening balance must be a valid amount.");
      }

      const status = rawData.status
        ? parseEnumValue(rawData.status, "Status", MASTER_STATUSES, errors)
        : "active";
      const notes = toOptionalTrimmed(rawData.notes, 2000);

      if (errors.length || !supplierName || !mobileNumber || openingBalance === null || openingBalance === undefined || !status) {
        return {
          rowNumber,
          status: "invalid",
          action: "fail",
          identifier: null,
          rawData,
          normalizedData: null,
          errors,
          warnings,
          targetEntityId: null,
        } satisfies PreviewRowRecord;
      }

      const identifier = mobileNumber;
      if (seenMobiles.has(identifier)) {
        return {
          rowNumber,
          status: "duplicate",
          action: "skip",
          identifier,
          rawData,
          normalizedData: {
            supplierName,
            companyName,
            contactPerson,
            mobileNumber,
            alternateMobileNumber: normalizedAlternateMobile ?? undefined,
            email: normalizedEmail ?? undefined,
            gstNumber,
            drugLicenseNumber,
            addressLine1,
            addressLine2,
            city,
            state,
            pincode,
            openingBalance,
            status,
            notes,
            duplicateKind: "file",
          } satisfies SupplierImportRecord,
          errors: ["Supplier mobile number is duplicated inside the file."],
          warnings,
          targetEntityId: null,
        } satisfies PreviewRowRecord;
      }

      seenMobiles.set(identifier, rowNumber);

      if (normalizedEmail) {
        const seenAt = seenEmails.get(normalizedEmail);
        if (seenAt) {
          return {
            rowNumber,
            status: "duplicate",
            action: "skip",
            identifier,
            rawData,
            normalizedData: {
              supplierName,
              companyName,
              contactPerson,
              mobileNumber,
              alternateMobileNumber: normalizedAlternateMobile ?? undefined,
              email: normalizedEmail,
              gstNumber,
              drugLicenseNumber,
              addressLine1,
              addressLine2,
              city,
              state,
              pincode,
              openingBalance,
              status,
              notes,
              duplicateKind: "file",
            } satisfies SupplierImportRecord,
            errors: [`Supplier email is duplicated inside the file on row ${seenAt}.`],
            warnings,
            targetEntityId: null,
          } satisfies PreviewRowRecord;
        }

        seenEmails.set(normalizedEmail, rowNumber);
      }

      if (gstNumber) {
        const seenAt = seenGst.get(gstNumber);
        if (seenAt) {
          return {
            rowNumber,
            status: "duplicate",
            action: "skip",
            identifier,
            rawData,
            normalizedData: {
              supplierName,
              companyName,
              contactPerson,
              mobileNumber,
              alternateMobileNumber: normalizedAlternateMobile ?? undefined,
              email: normalizedEmail ?? undefined,
              gstNumber,
              drugLicenseNumber,
              addressLine1,
              addressLine2,
              city,
              state,
              pincode,
              openingBalance,
              status,
              notes,
              duplicateKind: "file",
            } satisfies SupplierImportRecord,
            errors: [`Supplier GST number is duplicated inside the file on row ${seenAt}.`],
            warnings,
            targetEntityId: null,
          } satisfies PreviewRowRecord;
        }

        seenGst.set(gstNumber, rowNumber);
      }

      const existingByMobileRecord = existingByMobile.get(mobileNumber);
      const emailConflict =
        normalizedEmail &&
        existingByEmail.get(normalizedEmail) &&
        existingByEmail.get(normalizedEmail)?.id !== existingByMobileRecord?.id
          ? existingByEmail.get(normalizedEmail)
          : null;
      const gstConflict =
        gstNumber &&
        existingByGst.get(gstNumber) &&
        existingByGst.get(gstNumber)?.id !== existingByMobileRecord?.id
          ? existingByGst.get(gstNumber)
          : null;

      if (emailConflict) {
        errors.push("Email already belongs to another supplier in this shop.");
      }

      if (gstConflict) {
        errors.push("GST number already belongs to another supplier in this shop.");
      }

      if (errors.length) {
        return {
          rowNumber,
          status: "invalid",
          action: "fail",
          identifier,
          rawData,
          normalizedData: null,
          errors,
          warnings,
          targetEntityId: null,
        } satisfies PreviewRowRecord;
      }

      if (existingByMobileRecord) {
        warnings.push(
          duplicateMode === "update_existing" || duplicateMode === "upsert"
            ? "Existing supplier will be updated on confirm."
            : duplicateMode === "skip_duplicates"
              ? "Existing supplier will be skipped on confirm."
              : "Duplicate supplier blocks confirmation in current mode.",
        );

        return {
          rowNumber,
          status: "duplicate",
          action:
            duplicateMode === "update_existing" || duplicateMode === "upsert"
              ? "update"
              : duplicateMode === "skip_duplicates"
                ? "skip"
                : "fail",
          identifier,
          rawData,
          normalizedData: {
            supplierName,
            companyName,
            contactPerson,
            mobileNumber,
            alternateMobileNumber: normalizedAlternateMobile ?? undefined,
            email: normalizedEmail ?? undefined,
            gstNumber,
            drugLicenseNumber,
            addressLine1,
            addressLine2,
            city,
            state,
            pincode,
            openingBalance,
            status,
            notes,
            duplicateKind: "database",
          } satisfies SupplierImportRecord,
          errors: ["Supplier already exists in this shop."],
          warnings,
          targetEntityId: existingByMobileRecord.id,
        } satisfies PreviewRowRecord;
      }

      return {
        rowNumber,
        status: "valid",
        action: "create",
        identifier,
        rawData,
        normalizedData: {
          supplierName,
          companyName,
          contactPerson,
          mobileNumber,
          alternateMobileNumber: normalizedAlternateMobile ?? undefined,
          email: normalizedEmail ?? undefined,
          gstNumber,
          drugLicenseNumber,
          addressLine1,
          addressLine2,
          city,
          state,
          pincode,
          openingBalance,
          status,
          notes,
          duplicateKind: undefined,
        } satisfies SupplierImportRecord,
        errors,
        warnings,
        targetEntityId: null,
      } satisfies PreviewRowRecord;
    });
  }

  private async buildCustomerPreviewRows(
    shopId: string,
    duplicateMode: DuplicateMode,
    rows: Array<{ rowNumber: number; rawData: JsonRecord }>,
  ) {
    const customersData = await db
      .select()
      .from(customers)
      .where(eq(customers.shopId, shopId));

    const existingByMobile = new Map(
      customersData.map((item) => [item.mobileNumber, item]),
    );
    const existingByEmail = new Map(
      customersData
        .filter((item) => item.emailNormalized)
        .map((item) => [item.emailNormalized!, item]),
    );
    const seenMobiles = new Map<string, number>();
    const seenEmails = new Map<string, number>();

    return rows.map(({ rowNumber, rawData }) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const fullName = requireString(rawData.fullName, "Full name", 2, 160, errors);
      const mobileNumber = normalizePhoneNumber(String(rawData.mobileNumber ?? ""));
      if (!mobileNumber) {
        errors.push("Mobile number is invalid.");
      }

      const alternateMobileNumber = toOptionalTrimmed(
        rawData.alternateMobileNumber,
        20,
      );
      const normalizedAlternateMobile = alternateMobileNumber
        ? normalizePhoneNumber(alternateMobileNumber) ?? undefined
        : undefined;
      if (alternateMobileNumber && !normalizedAlternateMobile) {
        errors.push("Alternate mobile number is invalid.");
      }

      if (mobileNumber && normalizedAlternateMobile === mobileNumber) {
        errors.push("Alternate mobile number must be different from mobile number.");
      }

      const email = toOptionalTrimmed(rawData.email, 320);
      const normalizedEmail =
        email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          ? normalizeEmail(email)
          : email
            ? null
            : undefined;
      if (email && !normalizedEmail) {
        errors.push("Email address is invalid.");
      }

      const gender = rawData.gender
        ? parseEnumValue(rawData.gender, "Gender", CUSTOMER_GENDERS, errors)
        : undefined;
      const age = parseIntegerValue(rawData.age);
      if (age === null) {
        errors.push("Age must be a whole number.");
      } else if (age !== undefined && (age < 0 || age > 130)) {
        errors.push("Age must be between 0 and 130.");
      }

      const dateOfBirth = parseDateValue(rawData.dateOfBirth);
      if (dateOfBirth === null) {
        errors.push("Date of birth must be a valid date.");
      }

      const addressLine1 = toOptionalString(rawData.addressLine1, 255);
      const addressLine2 = toOptionalString(rawData.addressLine2, 255);
      const city = toOptionalString(rawData.city, 100);
      const state = toOptionalString(rawData.state, 100);
      const pincode = toOptionalTrimmed(rawData.pincode, 20);
      if (pincode && !/^\d{6}$/.test(pincode)) {
        errors.push("Pincode must be a valid 6-digit code.");
      }

      const status = rawData.status
        ? parseEnumValue(rawData.status, "Status", MASTER_STATUSES, errors)
        : "active";
      const notes = toOptionalTrimmed(rawData.notes, 2000);

      if (errors.length || !fullName || !mobileNumber || !status) {
        return {
          rowNumber,
          status: "invalid",
          action: "fail",
          identifier: null,
          rawData,
          normalizedData: null,
          errors,
          warnings,
          targetEntityId: null,
        } satisfies PreviewRowRecord;
      }

      const identifier = mobileNumber;
      if (seenMobiles.has(identifier)) {
        return {
          rowNumber,
          status: "duplicate",
          action: "skip",
          identifier,
          rawData,
          normalizedData: {
            fullName,
            mobileNumber,
            alternateMobileNumber: normalizedAlternateMobile ?? undefined,
            email: normalizedEmail ?? undefined,
            gender,
            age: age ?? undefined,
            dateOfBirth: dateOfBirth ?? undefined,
            addressLine1,
            addressLine2,
            city,
            state,
            pincode,
            status,
            notes,
            duplicateKind: "file",
          } satisfies CustomerImportRecord,
          errors: ["Customer mobile number is duplicated inside the file."],
          warnings,
          targetEntityId: null,
        } satisfies PreviewRowRecord;
      }

      seenMobiles.set(identifier, rowNumber);

      if (normalizedEmail) {
        const seenAt = seenEmails.get(normalizedEmail);
        if (seenAt) {
          return {
            rowNumber,
            status: "duplicate",
            action: "skip",
            identifier,
            rawData,
            normalizedData: {
              fullName,
              mobileNumber,
              alternateMobileNumber: normalizedAlternateMobile ?? undefined,
              email: normalizedEmail,
              gender,
              age: age ?? undefined,
              dateOfBirth: dateOfBirth ?? undefined,
              addressLine1,
              addressLine2,
              city,
              state,
              pincode,
              status,
              notes,
              duplicateKind: "file",
            } satisfies CustomerImportRecord,
            errors: [`Customer email is duplicated inside the file on row ${seenAt}.`],
            warnings,
            targetEntityId: null,
          } satisfies PreviewRowRecord;
        }

        seenEmails.set(normalizedEmail, rowNumber);
      }

      const existingByMobileRecord = existingByMobile.get(mobileNumber);
      const emailConflict =
        normalizedEmail &&
        existingByEmail.get(normalizedEmail) &&
        existingByEmail.get(normalizedEmail)?.id !== existingByMobileRecord?.id
          ? existingByEmail.get(normalizedEmail)
          : null;

      if (emailConflict) {
        return {
          rowNumber,
          status: "invalid",
          action: "fail",
          identifier,
          rawData,
          normalizedData: null,
          errors: ["Email already belongs to another customer in this shop."],
          warnings,
          targetEntityId: null,
        } satisfies PreviewRowRecord;
      }

      if (existingByMobileRecord) {
        warnings.push(
          duplicateMode === "update_existing" || duplicateMode === "upsert"
            ? "Existing customer will be updated on confirm."
            : duplicateMode === "skip_duplicates"
              ? "Existing customer will be skipped on confirm."
              : "Duplicate customer blocks confirmation in current mode.",
        );

        return {
          rowNumber,
          status: "duplicate",
          action:
            duplicateMode === "update_existing" || duplicateMode === "upsert"
              ? "update"
              : duplicateMode === "skip_duplicates"
                ? "skip"
                : "fail",
          identifier,
          rawData,
          normalizedData: {
            fullName,
            mobileNumber,
            alternateMobileNumber: normalizedAlternateMobile ?? undefined,
            email: normalizedEmail ?? undefined,
            gender,
            age: age ?? undefined,
            dateOfBirth: dateOfBirth ?? undefined,
            addressLine1,
            addressLine2,
            city,
            state,
            pincode,
            status,
            notes,
            duplicateKind: "database",
          } satisfies CustomerImportRecord,
          errors: ["Customer already exists in this shop."],
          warnings,
          targetEntityId: existingByMobileRecord.id,
        } satisfies PreviewRowRecord;
      }

      return {
        rowNumber,
        status: "valid",
        action: "create",
        identifier,
        rawData,
        normalizedData: {
          fullName,
          mobileNumber,
          alternateMobileNumber: normalizedAlternateMobile ?? undefined,
          email: normalizedEmail ?? undefined,
          gender,
          age: age ?? undefined,
          dateOfBirth: dateOfBirth ?? undefined,
          addressLine1,
          addressLine2,
          city,
          state,
          pincode,
          status,
          notes,
          duplicateKind: undefined,
        } satisfies CustomerImportRecord,
        errors,
        warnings,
        targetEntityId: null,
      } satisfies PreviewRowRecord;
    });
  }

  private async applyImportRow(
    shopId: string,
    importType: ImportType,
    duplicateMode: DuplicateMode,
    row: typeof importJobRows.$inferSelect,
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) {
    if (importType === "medicines") {
      return this.applyMedicineImportRow(shopId, duplicateMode, row, tx);
    }

    if (importType === "suppliers") {
      return this.applySupplierImportRow(shopId, duplicateMode, row, tx);
    }

    return this.applyCustomerImportRow(shopId, duplicateMode, row, tx);
  }

  private async applyMedicineImportRow(
    shopId: string,
    duplicateMode: DuplicateMode,
    row: typeof importJobRows.$inferSelect,
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) {
    const payload = row.normalizedData as unknown as MedicineImportRecord;

    if (row.targetEntityId && (duplicateMode === "update_existing" || duplicateMode === "upsert")) {
      const [updated] = await tx
        .update(medicines)
        .set({
          medicineName: payload.medicineName,
          medicineNameNormalized: normalizeName(payload.medicineName),
          genericName: payload.genericName,
          genericNameNormalized: normalizeName(payload.genericName),
          brandName: payload.brandName ?? null,
          brandNameNormalized: payload.brandName
            ? normalizeName(payload.brandName)
            : null,
          strength: payload.strength ?? null,
          strengthNormalized: payload.strength
            ? normalizeName(payload.strength)
            : "",
          form: payload.form,
          unit: payload.unit,
          categoryId: payload.categoryId,
          manufacturerId: payload.manufacturerId,
          hsnCode: payload.hsnCode ?? null,
          gstPercent: payload.gstPercent,
          barcode: payload.barcode ?? null,
          reorderLevel: payload.reorderLevel,
          prescriptionRequired: payload.prescriptionRequired,
          status: payload.status,
          notes: payload.notes ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(medicines.id, row.targetEntityId), eq(medicines.shopId, shopId)))
        .returning();

      if (!updated) {
        throw buildAppError(
          409,
          "IMPORT_MEDICINE_TARGET_MISSING",
          "A medicine targeted for update no longer exists.",
        );
      }

      return {
        rowNumber: row.rowNumber,
        status: "imported",
        action: "update",
        identifier: row.identifier,
        rawData: row.rawData,
        normalizedData: row.normalizedData as JsonRecord,
        errors: [],
        warnings: row.warnings,
        targetEntityId: updated.id,
      } satisfies PreviewRowRecord;
    }

    const [created] = await tx
      .insert(medicines)
      .values({
        shopId,
        medicineName: payload.medicineName,
        medicineNameNormalized: normalizeName(payload.medicineName),
        genericName: payload.genericName,
        genericNameNormalized: normalizeName(payload.genericName),
        brandName: payload.brandName ?? null,
        brandNameNormalized: payload.brandName
          ? normalizeName(payload.brandName)
          : null,
        strength: payload.strength ?? null,
        strengthNormalized: payload.strength ? normalizeName(payload.strength) : "",
        form: payload.form,
        unit: payload.unit,
        categoryId: payload.categoryId,
        manufacturerId: payload.manufacturerId,
        hsnCode: payload.hsnCode ?? null,
        gstPercent: payload.gstPercent,
        barcode: payload.barcode ?? null,
        reorderLevel: payload.reorderLevel,
        prescriptionRequired: payload.prescriptionRequired,
        status: payload.status,
        notes: payload.notes ?? null,
      })
      .returning();

    if (!created) {
      throw buildAppError(
        500,
        "IMPORT_MEDICINE_CREATE_FAILED",
        "Medicine could not be created from import.",
      );
    }

    return {
      rowNumber: row.rowNumber,
      status: "imported",
      action: "create",
      identifier: row.identifier,
      rawData: row.rawData,
      normalizedData: row.normalizedData as JsonRecord,
      errors: [],
      warnings: row.warnings,
      targetEntityId: created.id,
    } satisfies PreviewRowRecord;
  }

  private async applySupplierImportRow(
    shopId: string,
    duplicateMode: DuplicateMode,
    row: typeof importJobRows.$inferSelect,
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) {
    const payload = row.normalizedData as unknown as SupplierImportRecord;

    if (row.targetEntityId && (duplicateMode === "update_existing" || duplicateMode === "upsert")) {
      const [updated] = await tx
        .update(suppliers)
        .set({
          supplierName: payload.supplierName,
          supplierNameNormalized: normalizeName(payload.supplierName),
          companyName: payload.companyName ?? null,
          companyNameNormalized: payload.companyName
            ? normalizeName(payload.companyName)
            : null,
          contactPerson: payload.contactPerson ?? null,
          mobileNumber: payload.mobileNumber,
          alternateMobileNumber: payload.alternateMobileNumber ?? null,
          email: payload.email ?? null,
          gstNumber: payload.gstNumber ?? null,
          drugLicenseNumber: payload.drugLicenseNumber ?? null,
          addressLine1: payload.addressLine1 ?? null,
          addressLine2: payload.addressLine2 ?? null,
          city: payload.city ?? null,
          state: payload.state ?? null,
          pincode: payload.pincode ?? null,
          openingBalance: payload.openingBalance,
          status: payload.status,
          notes: payload.notes ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(suppliers.id, row.targetEntityId), eq(suppliers.shopId, shopId)))
        .returning();

      if (!updated) {
        throw buildAppError(
          409,
          "IMPORT_SUPPLIER_TARGET_MISSING",
          "A supplier targeted for update no longer exists.",
        );
      }

      return {
        rowNumber: row.rowNumber,
        status: "imported",
        action: "update",
        identifier: row.identifier,
        rawData: row.rawData,
        normalizedData: row.normalizedData as JsonRecord,
        errors: [],
        warnings: row.warnings,
        targetEntityId: updated.id,
      } satisfies PreviewRowRecord;
    }

    const [created] = await tx
      .insert(suppliers)
      .values({
        shopId,
        supplierName: payload.supplierName,
        supplierNameNormalized: normalizeName(payload.supplierName),
        companyName: payload.companyName ?? null,
        companyNameNormalized: payload.companyName
          ? normalizeName(payload.companyName)
          : null,
        contactPerson: payload.contactPerson ?? null,
        mobileNumber: payload.mobileNumber,
        alternateMobileNumber: payload.alternateMobileNumber ?? null,
        email: payload.email ?? null,
        gstNumber: payload.gstNumber ?? null,
        drugLicenseNumber: payload.drugLicenseNumber ?? null,
        addressLine1: payload.addressLine1 ?? null,
        addressLine2: payload.addressLine2 ?? null,
        city: payload.city ?? null,
        state: payload.state ?? null,
        pincode: payload.pincode ?? null,
        openingBalance: payload.openingBalance,
        status: payload.status,
        notes: payload.notes ?? null,
      })
      .returning();

    if (!created) {
      throw buildAppError(
        500,
        "IMPORT_SUPPLIER_CREATE_FAILED",
        "Supplier could not be created from import.",
      );
    }

    return {
      rowNumber: row.rowNumber,
      status: "imported",
      action: "create",
      identifier: row.identifier,
      rawData: row.rawData,
      normalizedData: row.normalizedData as JsonRecord,
      errors: [],
      warnings: row.warnings,
      targetEntityId: created.id,
    } satisfies PreviewRowRecord;
  }

  private async applyCustomerImportRow(
    shopId: string,
    duplicateMode: DuplicateMode,
    row: typeof importJobRows.$inferSelect,
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) {
    const payload = row.normalizedData as unknown as CustomerImportRecord;

    if (row.targetEntityId && (duplicateMode === "update_existing" || duplicateMode === "upsert")) {
      const [updated] = await tx
        .update(customers)
        .set({
          fullName: payload.fullName,
          fullNameNormalized: normalizeName(payload.fullName),
          mobileNumber: payload.mobileNumber,
          alternateMobileNumber: payload.alternateMobileNumber ?? null,
          email: payload.email ?? null,
          emailNormalized: payload.email ?? null,
          gender: payload.gender ?? null,
          age: payload.age ?? null,
          dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
          addressLine1: payload.addressLine1 ?? null,
          addressLine2: payload.addressLine2 ?? null,
          city: payload.city ?? null,
          state: payload.state ?? null,
          pincode: payload.pincode ?? null,
          status: payload.status,
          notes: payload.notes ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(customers.id, row.targetEntityId), eq(customers.shopId, shopId)))
        .returning();

      if (!updated) {
        throw buildAppError(
          409,
          "IMPORT_CUSTOMER_TARGET_MISSING",
          "A customer targeted for update no longer exists.",
        );
      }

      return {
        rowNumber: row.rowNumber,
        status: "imported",
        action: "update",
        identifier: row.identifier,
        rawData: row.rawData,
        normalizedData: row.normalizedData as JsonRecord,
        errors: [],
        warnings: row.warnings,
        targetEntityId: updated.id,
      } satisfies PreviewRowRecord;
    }

    const nextSequence = await this.getNextCustomerSequence(shopId, tx);
    const [created] = await tx
      .insert(customers)
      .values({
        shopId,
        customerSequence: nextSequence,
        customerCode: `CUST-${nextSequence.toString().padStart(4, "0")}`,
        fullName: payload.fullName,
        fullNameNormalized: normalizeName(payload.fullName),
        mobileNumber: payload.mobileNumber,
        alternateMobileNumber: payload.alternateMobileNumber ?? null,
        email: payload.email ?? null,
        emailNormalized: payload.email ?? null,
        gender: payload.gender ?? null,
        age: payload.age ?? null,
        dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
        addressLine1: payload.addressLine1 ?? null,
        addressLine2: payload.addressLine2 ?? null,
        city: payload.city ?? null,
        state: payload.state ?? null,
        pincode: payload.pincode ?? null,
        status: payload.status,
        notes: payload.notes ?? null,
      })
      .returning();

    if (!created) {
      throw buildAppError(
        500,
        "IMPORT_CUSTOMER_CREATE_FAILED",
        "Customer could not be created from import.",
      );
    }

    return {
      rowNumber: row.rowNumber,
      status: "imported",
      action: "create",
      identifier: row.identifier,
      rawData: row.rawData,
      normalizedData: row.normalizedData as JsonRecord,
      errors: [],
      warnings: row.warnings,
      targetEntityId: created.id,
    } satisfies PreviewRowRecord;
  }

  private async getNextCustomerSequence(
    shopId: string,
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) {
    const [existingCustomerSequence] = await tx
      .select({
        maxSequence: sql<number>`coalesce(max(${customers.customerSequence}), 0)`,
      })
      .from(customers)
      .where(eq(customers.shopId, shopId));

    const baselineNextSequence =
      Number(existingCustomerSequence?.maxSequence ?? 0) + 1;

    const [counter] = await tx
      .insert(customerCounters)
      .values({
        shopId,
        lastSequence: baselineNextSequence,
      })
      .onConflictDoUpdate({
        target: customerCounters.shopId,
        set: {
          lastSequence: sql`greatest(${customerCounters.lastSequence} + 1, ${baselineNextSequence})`,
          updatedAt: new Date(),
        },
      })
      .returning({
        lastSequence: customerCounters.lastSequence,
      });

    return counter?.lastSequence ?? baselineNextSequence;
  }

  private async buildDatasetExport(shopId: string, query: ExportDatasetQuery) {
    if (query.dataset === "medicines") {
      const search = normalizeSearch(query.search);
      const filters = [eq(medicines.shopId, shopId)];

      if (search) {
        filters.push(
          or(
            like(medicines.medicineNameNormalized, `%${search}%`),
            like(medicines.genericNameNormalized, `%${search}%`),
          )!,
        );
      }

      if (query.status) {
        filters.push(eq(medicines.status, query.status));
      }

      const rows = await db
        .select({
          medicineName: medicines.medicineName,
          genericName: medicines.genericName,
          brandName: medicines.brandName,
          strength: medicines.strength,
          form: medicines.form,
          unit: medicines.unit,
          categoryName: medicineCategories.name,
          manufacturerName: manufacturers.name,
          gstPercent: medicines.gstPercent,
          reorderLevel: medicines.reorderLevel,
          barcode: medicines.barcode,
          status: medicines.status,
          createdAt: medicines.createdAt,
          updatedAt: medicines.updatedAt,
        })
        .from(medicines)
        .innerJoin(medicineCategories, eq(medicines.categoryId, medicineCategories.id))
        .innerJoin(manufacturers, eq(medicines.manufacturerId, manufacturers.id))
        .where(and(...filters))
        .orderBy(asc(medicines.medicineNameNormalized), asc(medicines.id));

      return {
        sheetName: "Medicines",
        fileName: "medicines-export",
        headers: [
          "medicineName",
          "genericName",
          "brandName",
          "strength",
          "form",
          "unit",
          "categoryName",
          "manufacturerName",
          "gstPercent",
          "reorderLevel",
          "barcode",
          "status",
          "createdAt",
          "updatedAt",
        ],
        rows: rows.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        })),
      };
    }

    if (query.dataset === "suppliers") {
      const search = normalizeSearch(query.search);
      const filters = [eq(suppliers.shopId, shopId)];

      if (search) {
        filters.push(
          or(
            like(suppliers.supplierNameNormalized, `%${search}%`),
            like(suppliers.mobileNumber, `%${search.replace(/\D/g, "") || search}%`),
          )!,
        );
      }

      if (query.status) {
        filters.push(eq(suppliers.status, query.status));
      }

      const rows = await db
        .select()
        .from(suppliers)
        .where(and(...filters))
        .orderBy(asc(suppliers.supplierNameNormalized), asc(suppliers.id));

      return {
        sheetName: "Suppliers",
        fileName: "suppliers-export",
        headers: [
          "supplierName",
          "companyName",
          "contactPerson",
          "mobileNumber",
          "alternateMobileNumber",
          "email",
          "gstNumber",
          "drugLicenseNumber",
          "city",
          "state",
          "pincode",
          "openingBalance",
          "status",
          "createdAt",
          "updatedAt",
        ],
        rows: rows.map((row) => ({
          supplierName: row.supplierName,
          companyName: row.companyName,
          contactPerson: row.contactPerson,
          mobileNumber: row.mobileNumber,
          alternateMobileNumber: row.alternateMobileNumber,
          email: row.email,
          gstNumber: row.gstNumber,
          drugLicenseNumber: row.drugLicenseNumber,
          city: row.city,
          state: row.state,
          pincode: row.pincode,
          openingBalance: row.openingBalance,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        })),
      };
    }

    if (query.dataset === "customers") {
      const search = normalizeSearch(query.search);
      const filters = [eq(customers.shopId, shopId)];

      if (search) {
        const digits = search.replace(/\D/g, "");
        filters.push(
          or(
            like(customers.fullNameNormalized, `%${search}%`),
            like(customers.mobileNumber, `%${digits || search}%`),
            like(customers.emailNormalized, `%${search}%`),
          )!,
        );
      }

      if (query.status) {
        filters.push(eq(customers.status, query.status));
      }

      const rows = await db
        .select()
        .from(customers)
        .where(and(...filters))
        .orderBy(asc(customers.fullNameNormalized), asc(customers.id));

      return {
        sheetName: "Customers",
        fileName: "customers-export",
        headers: [
          "customerCode",
          "fullName",
          "mobileNumber",
          "alternateMobileNumber",
          "email",
          "gender",
          "age",
          "dateOfBirth",
          "city",
          "state",
          "pincode",
          "status",
          "createdAt",
          "updatedAt",
        ],
        rows: rows.map((row) => ({
          customerCode: row.customerCode,
          fullName: row.fullName,
          mobileNumber: row.mobileNumber,
          alternateMobileNumber: row.alternateMobileNumber,
          email: row.email,
          gender: row.gender,
          age: row.age,
          dateOfBirth: row.dateOfBirth?.toISOString() ?? "",
          city: row.city,
          state: row.state,
          pincode: row.pincode,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        })),
      };
    }

    const defaultBranch = await this.branchesRepository.findDefaultBranchByShopId(shopId);

    if (!defaultBranch) {
      throw buildAppError(
        500,
        "DEFAULT_BRANCH_MISSING",
        "Default branch configuration is missing for this shop.",
      );
    }

    await this.inventoryRepository.syncBatchStatuses(shopId, defaultBranch.id);
    const defaultThreshold = (
      await this.branchesService.getResolvedBranchSettings(shopId, defaultBranch.id)
    ).defaultLowStockThreshold;
    const pageSize = 500;
    const inventoryQuery = {
      search: query.search,
      sortBy: "medicineName" as const,
      sortOrder: "asc" as const,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.manufacturerId ? { manufacturerId: query.manufacturerId } : {}),
      ...(query.lowStockOnly ? { lowStockOnly: true } : {}),
      ...(query.status ? { medicineStatus: query.status } : {}),
    };

    const count = await this.inventoryRepository.countInventorySummary(
      shopId,
      defaultBranch.id,
      {
        page: 1,
        pageSize: 1,
        search: inventoryQuery.search,
        sortBy: "medicineName",
        sortOrder: "asc",
        ...(inventoryQuery.categoryId ? { categoryId: inventoryQuery.categoryId } : {}),
        ...(inventoryQuery.manufacturerId
          ? { manufacturerId: inventoryQuery.manufacturerId }
          : {}),
        ...(inventoryQuery.lowStockOnly ? { lowStockOnly: true } : {}),
        ...(inventoryQuery.medicineStatus
          ? { medicineStatus: inventoryQuery.medicineStatus }
          : {}),
      },
      defaultThreshold,
    );

    const pages = Math.max(1, Math.ceil(count / pageSize));
    const items: Awaited<
      ReturnType<InventoryRepository["listInventorySummary"]>
    > = [];

    for (let page = 1; page <= pages; page += 1) {
      const chunk = await this.inventoryRepository.listInventorySummary(
        shopId,
        defaultBranch.id,
        {
          page,
          pageSize,
          ...inventoryQuery,
        },
        defaultThreshold,
      );
      items.push(...chunk);
    }

    return {
      sheetName: "Stock Summary",
      fileName: "stock-summary-export",
      headers: [
        "medicineName",
        "genericName",
        "categoryName",
        "manufacturerName",
        "availableQuantity",
        "reorderLevel",
        "activeBatchCount",
        "isLowStock",
        "status",
      ],
      rows: items.map((item) => ({
        medicineName: item.medicine.medicineName,
        genericName: item.medicine.genericName,
        categoryName: item.category.name,
        manufacturerName: item.manufacturer.name,
        availableQuantity: Number(item.availableQuantity ?? 0),
        reorderLevel: Number(item.effectiveReorderLevel ?? 0),
        activeBatchCount: Number(item.activeBatchCount ?? 0),
        isLowStock:
          Number(item.availableQuantity ?? 0) <= Number(item.effectiveReorderLevel ?? 0),
        status: item.medicine.status,
      })),
    };
  }

  private assertBackupPayload(payload: BackupPayload, shopId: string) {
    if (
      !payload ||
      payload.version !== 1 ||
      payload.type !== "shop_snapshot" ||
      payload.shop.id !== shopId ||
      typeof payload.data !== "object"
    ) {
      throw buildAppError(
        422,
        "BACKUP_STRUCTURE_INVALID",
        "The selected backup file is not valid for this shop restore.",
      );
    }
  }

  private async restoreCategories(
    shopId: string,
    rows: Array<Record<string, unknown>>,
    summary: RestoreSummary,
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) {
    const existing = await tx
      .select()
      .from(medicineCategories)
      .where(eq(medicineCategories.shopId, shopId));
    const map = new Map(existing.map((item) => [item.normalizedName, item]));

    for (const row of rows) {
      const name = toOptionalString(row.name, 120);
      if (!name) {
        continue;
      }

      const normalizedName = normalizeName(name);
      const current = map.get(normalizedName);
      if (current) {
        const [updated] = await tx
          .update(medicineCategories)
          .set({
            name,
            description: toOptionalString(row.description, 255) ?? null,
            status:
              (row.status as MasterStatus | undefined) && MASTER_STATUSES.includes(row.status as MasterStatus)
                ? (row.status as MasterStatus)
                : "active",
            updatedAt: new Date(),
          })
          .where(eq(medicineCategories.id, current.id))
          .returning();

        if (updated) {
          map.set(normalizedName, updated);
          summary.categoriesUpdated += 1;
        }
      } else {
        const [created] = await tx
          .insert(medicineCategories)
          .values({
            shopId,
            name,
            normalizedName,
            description: toOptionalString(row.description, 255) ?? null,
            status:
              (row.status as MasterStatus | undefined) && MASTER_STATUSES.includes(row.status as MasterStatus)
                ? (row.status as MasterStatus)
                : "active",
          })
          .returning();

        if (created) {
          map.set(normalizedName, created);
          summary.categoriesCreated += 1;
        }
      }
    }

    return map;
  }

  private async restoreManufacturers(
    shopId: string,
    rows: Array<Record<string, unknown>>,
    summary: RestoreSummary,
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) {
    const existing = await tx
      .select()
      .from(manufacturers)
      .where(eq(manufacturers.shopId, shopId));
    const map = new Map(existing.map((item) => [item.normalizedName, item]));

    for (const row of rows) {
      const name = toOptionalString(row.name, 160);
      if (!name) {
        continue;
      }

      const normalizedName = normalizeName(name);
      const current = map.get(normalizedName);
      if (current) {
        const [updated] = await tx
          .update(manufacturers)
          .set({
            name,
            status:
              (row.status as MasterStatus | undefined) && MASTER_STATUSES.includes(row.status as MasterStatus)
                ? (row.status as MasterStatus)
                : "active",
            updatedAt: new Date(),
          })
          .where(eq(manufacturers.id, current.id))
          .returning();

        if (updated) {
          map.set(normalizedName, updated);
          summary.manufacturersUpdated += 1;
        }
      } else {
        const [created] = await tx
          .insert(manufacturers)
          .values({
            shopId,
            name,
            normalizedName,
            status:
              (row.status as MasterStatus | undefined) && MASTER_STATUSES.includes(row.status as MasterStatus)
                ? (row.status as MasterStatus)
                : "active",
          })
          .returning();

        if (created) {
          map.set(normalizedName, created);
          summary.manufacturersCreated += 1;
        }
      }
    }

    return map;
  }

  private async restoreMedicines(
    shopId: string,
    rows: Array<Record<string, unknown>>,
    categoryMap: Map<string, typeof medicineCategories.$inferSelect>,
    manufacturerMap: Map<string, typeof manufacturers.$inferSelect>,
    backupCategoryNameById: Map<string, string>,
    backupManufacturerNameById: Map<string, string>,
    summary: RestoreSummary,
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) {
    const existing = await tx
      .select()
      .from(medicines)
      .where(eq(medicines.shopId, shopId));
    const existingMap = new Map(
      existing.map((item) => [
        `${item.medicineNameNormalized}|${item.strengthNormalized}|${item.form}|${item.manufacturerId}`,
        item,
      ]),
    );

    for (const row of rows) {
      const medicineName = toOptionalString(row.medicineName, 180);
      const genericName = toOptionalString(row.genericName, 180);
      const form =
        row.form && MEDICINE_FORMS.includes(row.form as MedicineForm)
          ? (row.form as MedicineForm)
          : undefined;
      const unit =
        row.unit && MEDICINE_UNITS.includes(row.unit as MedicineUnit)
          ? (row.unit as MedicineUnit)
          : undefined;
      const categoryName =
        toOptionalString(row.categoryName, 120) ??
        backupCategoryNameById.get(String(row.categoryId ?? ""));
      const manufacturerName =
        toOptionalString(row.manufacturerName, 160) ??
        backupManufacturerNameById.get(String(row.manufacturerId ?? ""));
      const category = categoryName
        ? categoryMap.get(normalizeName(categoryName))
        : undefined;
      const manufacturer = manufacturerName
        ? manufacturerMap.get(normalizeName(manufacturerName))
        : undefined;

      if (!medicineName || !genericName || !form || !unit || !category || !manufacturer) {
        summary.medicinesSkipped += 1;
        continue;
      }

      const strength = toOptionalString(row.strength, 80);
      const key = `${normalizeName(medicineName)}|${normalizeName(
        strength ?? "",
      )}|${form}|${manufacturer.id}`;
      const current = existingMap.get(key);
      const payload = {
        medicineName,
        medicineNameNormalized: normalizeName(medicineName),
        genericName,
        genericNameNormalized: normalizeName(genericName),
        brandName: toOptionalString(row.brandName, 160) ?? null,
        brandNameNormalized: toOptionalString(row.brandName, 160)
          ? normalizeName(String(row.brandName))
          : null,
        strength: strength ?? null,
        strengthNormalized: strength ? normalizeName(strength) : "",
        form,
        unit,
        categoryId: category.id,
        manufacturerId: manufacturer.id,
        hsnCode: toOptionalTrimmed(row.hsnCode, 20) ?? null,
        gstPercent:
          typeof row.gstPercent === "number"
            ? row.gstPercent
            : Number(row.gstPercent ?? 0),
        barcode: toOptionalTrimmed(row.barcode, 100) ?? null,
        reorderLevel:
          typeof row.reorderLevel === "number"
            ? row.reorderLevel
            : Number(row.reorderLevel ?? 0),
        prescriptionRequired: Boolean(row.prescriptionRequired),
        notes: toOptionalTrimmed(row.notes, 2000) ?? null,
        status:
          (row.status as MasterStatus | undefined) && MASTER_STATUSES.includes(row.status as MasterStatus)
            ? (row.status as MasterStatus)
            : "active",
      };

      if (current) {
        const [updated] = await tx
          .update(medicines)
          .set({
            ...payload,
            updatedAt: new Date(),
          })
          .where(eq(medicines.id, current.id))
          .returning();

        if (updated) {
          existingMap.set(key, updated);
          summary.medicinesUpdated += 1;
        }
      } else {
        const [created] = await tx
          .insert(medicines)
          .values({
            shopId,
            ...payload,
          })
          .returning();

        if (created) {
          existingMap.set(key, created);
          summary.medicinesCreated += 1;
        }
      }
    }
  }

  private async restoreSuppliers(
    shopId: string,
    rows: Array<Record<string, unknown>>,
    summary: RestoreSummary,
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) {
    const existing = await tx.select().from(suppliers).where(eq(suppliers.shopId, shopId));
    const mobileMap = new Map(existing.map((item) => [item.mobileNumber, item]));
    const emailMap = new Map(
      existing
        .filter((item) => item.email)
        .map((item) => [normalizeEmail(item.email!), item]),
    );
    const gstMap = new Map(
      existing.filter((item) => item.gstNumber).map((item) => [item.gstNumber!, item]),
    );

    for (const row of rows) {
      const mobile = toOptionalTrimmed(row.mobileNumber, 20);
      const mobileNumber = mobile ? normalizePhoneNumber(mobile) : null;
      const supplierName = toOptionalString(row.supplierName, 180);

      if (!supplierName || !mobileNumber) {
        summary.suppliersSkipped += 1;
        continue;
      }

      const email = toOptionalTrimmed(row.email, 320);
      const normalizedEmail = email ? normalizeEmail(email) : undefined;
      const gstNumber = toOptionalTrimmed(row.gstNumber, 15)?.toUpperCase();
      const current = mobileMap.get(mobileNumber);
      const emailConflict =
        normalizedEmail &&
        emailMap.get(normalizedEmail) &&
        emailMap.get(normalizedEmail)?.id !== current?.id;
      const gstConflict =
        gstNumber && gstMap.get(gstNumber) && gstMap.get(gstNumber)?.id !== current?.id;

      if (emailConflict || gstConflict) {
        summary.suppliersSkipped += 1;
        continue;
      }

      const payload = {
        supplierName,
        supplierNameNormalized: normalizeName(supplierName),
        companyName: toOptionalString(row.companyName, 180) ?? null,
        companyNameNormalized: toOptionalString(row.companyName, 180)
          ? normalizeName(String(row.companyName))
          : null,
        contactPerson: toOptionalString(row.contactPerson, 160) ?? null,
        mobileNumber,
        alternateMobileNumber: toOptionalTrimmed(row.alternateMobileNumber, 20)
          ? normalizePhoneNumber(String(row.alternateMobileNumber)) ?? null
          : null,
        email: normalizedEmail ?? null,
        gstNumber: gstNumber ?? null,
        drugLicenseNumber: toOptionalString(row.drugLicenseNumber, 100) ?? null,
        addressLine1: toOptionalString(row.addressLine1, 255) ?? null,
        addressLine2: toOptionalString(row.addressLine2, 255) ?? null,
        city: toOptionalString(row.city, 100) ?? null,
        state: toOptionalString(row.state, 100) ?? null,
        pincode: toOptionalTrimmed(row.pincode, 20) ?? null,
        openingBalance:
          parseMoneyValue(row.openingBalance ?? "0.00") ?? "0.00",
        notes: toOptionalTrimmed(row.notes, 2000) ?? null,
        status:
          (row.status as MasterStatus | undefined) && MASTER_STATUSES.includes(row.status as MasterStatus)
            ? (row.status as MasterStatus)
            : "active",
      };

      if (current) {
        const [updated] = await tx
          .update(suppliers)
          .set({
            ...payload,
            updatedAt: new Date(),
          })
          .where(eq(suppliers.id, current.id))
          .returning();

        if (updated) {
          summary.suppliersUpdated += 1;
          mobileMap.set(mobileNumber, updated);
        }
      } else {
        const [created] = await tx
          .insert(suppliers)
          .values({
            shopId,
            ...payload,
          })
          .returning();

        if (created) {
          summary.suppliersCreated += 1;
          mobileMap.set(mobileNumber, created);
        }
      }
    }
  }

  private async restoreCustomers(
    shopId: string,
    rows: Array<Record<string, unknown>>,
    summary: RestoreSummary,
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) {
    const existing = await tx.select().from(customers).where(eq(customers.shopId, shopId));
    const mobileMap = new Map(existing.map((item) => [item.mobileNumber, item]));
    const emailMap = new Map(
      existing
        .filter((item) => item.emailNormalized)
        .map((item) => [item.emailNormalized!, item]),
    );

    for (const row of rows) {
      const mobile = toOptionalTrimmed(row.mobileNumber, 20);
      const mobileNumber = mobile ? normalizePhoneNumber(mobile) : null;
      const fullName = toOptionalString(row.fullName, 160);
      if (!fullName || !mobileNumber) {
        summary.customersSkipped += 1;
        continue;
      }

      const email = toOptionalTrimmed(row.email, 320);
      const normalizedEmail = email ? normalizeEmail(email) : undefined;
      const current = mobileMap.get(mobileNumber);
      const emailConflict =
        normalizedEmail &&
        emailMap.get(normalizedEmail) &&
        emailMap.get(normalizedEmail)?.id !== current?.id;

      if (emailConflict) {
        summary.customersSkipped += 1;
        continue;
      }

      const payload = {
        fullName,
        fullNameNormalized: normalizeName(fullName),
        mobileNumber,
        alternateMobileNumber: toOptionalTrimmed(row.alternateMobileNumber, 20)
          ? normalizePhoneNumber(String(row.alternateMobileNumber)) ?? null
          : null,
        email: normalizedEmail ?? null,
        emailNormalized: normalizedEmail ?? null,
        gender:
          row.gender && CUSTOMER_GENDERS.includes(row.gender as CustomerGender)
            ? (row.gender as CustomerGender)
            : null,
        age:
          typeof row.age === "number"
            ? row.age
            : row.age
              ? Number(row.age)
              : null,
        dateOfBirth: row.dateOfBirth ? new Date(String(row.dateOfBirth)) : null,
        addressLine1: toOptionalString(row.addressLine1, 255) ?? null,
        addressLine2: toOptionalString(row.addressLine2, 255) ?? null,
        city: toOptionalString(row.city, 100) ?? null,
        state: toOptionalString(row.state, 100) ?? null,
        pincode: toOptionalTrimmed(row.pincode, 20) ?? null,
        notes: toOptionalTrimmed(row.notes, 2000) ?? null,
        status:
          (row.status as MasterStatus | undefined) && MASTER_STATUSES.includes(row.status as MasterStatus)
            ? (row.status as MasterStatus)
            : "active",
      };

      if (current) {
        const [updated] = await tx
          .update(customers)
          .set({
            ...payload,
            updatedAt: new Date(),
          })
          .where(eq(customers.id, current.id))
          .returning();

        if (updated) {
          summary.customersUpdated += 1;
          mobileMap.set(mobileNumber, updated);
        }
      } else {
        const sequence = await this.getNextCustomerSequence(shopId, tx);
        const [created] = await tx
          .insert(customers)
          .values({
            shopId,
            customerSequence: sequence,
            customerCode: `CUST-${sequence.toString().padStart(4, "0")}`,
            ...payload,
          })
          .returning();

        if (created) {
          summary.customersCreated += 1;
          mobileMap.set(mobileNumber, created);
        }
      }
    }
  }
}
