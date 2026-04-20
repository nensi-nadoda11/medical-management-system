import { AppError } from "../../shared/errors/app-error";
import type { DbExecutor } from "../../shared/db/executor";
import type { PublicUser } from "../auth/auth.types";
import { AuditLogsRepository } from "./audit-logs.repository";
import type {
  ListAuditLogsQuery,
  ListRecentActivityQuery,
} from "./audit-logs.validation";

const buildAppError = (statusCode: number, code: string, message: string) =>
  new AppError({
    statusCode,
    code,
    message,
  });

type JsonRecord = Record<string, unknown>;

export interface AuditActor {
  id: string;
  shopId: string;
  role: "admin" | "staff" | "accountant";
}

export interface CreateAuditLogInput {
  actor: AuditActor | PublicUser;
  module:
    | "users"
    | "permissions"
    | "settings"
    | "medicines"
    | "suppliers"
    | "customers"
    | "purchases"
    | "inventory"
    | "billing"
    | "sales_returns"
    | "purchase_returns"
    | "accounting"
    | "notifications"
    | "data_management";
  action: string;
  entityType: string;
  entityId: string;
  severity?: "normal" | "important" | "critical";
  title: string;
  description: string;
  beforeData?: JsonRecord | null;
  afterData?: JsonRecord | null;
  metadata?: JsonRecord | null;
}

const cloneJsonRecord = (value?: JsonRecord | null) =>
  value === undefined || value === null
    ? null
    : (JSON.parse(JSON.stringify(value)) as JsonRecord);

export class AuditLogsService {
  constructor(private readonly auditLogsRepository = new AuditLogsRepository()) {}

  async record(input: CreateAuditLogInput, executor?: DbExecutor) {
    return this.auditLogsRepository.createAuditLog(
      {
        shopId: input.actor.shopId,
        actorUserId: input.actor.id,
        actorRole: input.actor.role,
        module: input.module,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        severity: input.severity ?? "normal",
        title: input.title,
        description: input.description,
        beforeData: cloneJsonRecord(input.beforeData),
        afterData: cloneJsonRecord(input.afterData),
        metadata: cloneJsonRecord(input.metadata),
      },
      executor,
    );
  }

  async listAuditLogs(shopId: string, query: ListAuditLogsQuery) {
    const [items, total] = await Promise.all([
      this.auditLogsRepository.listAuditLogs(shopId, query),
      this.auditLogsRepository.countAuditLogs(shopId, query),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize) || 1,
      },
    };
  }

  async getAuditLogById(shopId: string, auditLogId: string) {
    const record = await this.auditLogsRepository.findAuditLogById(shopId, auditLogId);

    if (!record) {
      throw buildAppError(404, "AUDIT_LOG_NOT_FOUND", "Audit log not found.");
    }

    return this.toResponse(record);
  }

  async listRecentActivity(shopId: string, query: ListRecentActivityQuery) {
    const items = await this.auditLogsRepository.listRecentActivity(shopId, query);

    return {
      items: items.map((item) => this.toResponse(item)),
    };
  }

  private toResponse(
    record: Awaited<ReturnType<AuditLogsRepository["findAuditLogById"]>> extends infer T
      ? Exclude<T, null>
      : never,
  ) {
    return {
      id: record.log.id,
      shopId: record.log.shopId,
      actorUserId: record.log.actorUserId,
      actorRole: record.log.actorRole,
      actor: record.actor,
      action: record.log.action,
      module: record.log.module,
      entityType: record.log.entityType,
      entityId: record.log.entityId,
      severity: record.log.severity,
      title: record.log.title,
      description: record.log.description,
      beforeData: record.log.beforeData,
      afterData: record.log.afterData,
      metadata: record.log.metadata,
      createdAt: record.log.createdAt,
    };
  }
}
