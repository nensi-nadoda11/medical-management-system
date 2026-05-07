import { db } from "../../db/client";
import { AppError } from "../../shared/errors/app-error";
import type { DbExecutor } from "../../shared/db/executor";
import { runDbReads } from "../../shared/db/run-db-reads";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { AdminSettingsService } from "../admin-settings/admin-settings.service";
import type { PublicUser, UserRole } from "../auth/auth.types";
import { UsersRepository } from "../users/users.repository";
import { BranchesRepository } from "./branches.repository";
import type {
  CreateBranchInput,
  UpdateBranchInput,
  UpdateUserBranchAssignmentsInput,
} from "./branches.validation";

const buildAppError = (statusCode: number, code: string, message: string) =>
  new AppError({
    statusCode,
    code,
    message,
  });

export interface AccessibleBranch {
  id: string;
  shopId: string;
  name: string;
  code: string;
  address: string | null;
  contactNumber: string | null;
  status: "active" | "inactive";
  isDefault: boolean;
}

export interface BranchRequestContext {
  currentBranch: AccessibleBranch;
  defaultBranch: AccessibleBranch;
  accessibleBranches: AccessibleBranch[];
}

const toAccessibleBranch = (branch: {
  id: string;
  shopId: string;
  name: string;
  code: string;
  address: string | null;
  contactNumber: string | null;
  status: "active" | "inactive";
  isDefault: boolean;
}): AccessibleBranch => ({
  id: branch.id,
  shopId: branch.shopId,
  name: branch.name,
  code: branch.code,
  address: branch.address ?? null,
  contactNumber: branch.contactNumber ?? null,
  status: branch.status,
  isDefault: branch.isDefault,
});

export class BranchesService {
  constructor(
    private readonly branchesRepository = new BranchesRepository(),
    private readonly usersRepository = new UsersRepository(),
    private readonly adminSettingsService = new AdminSettingsService(),
    private readonly auditLogsService = new AuditLogsService(),
  ) {}

  async resolveRequestBranchContext(input: {
    shopId: string;
    userId: string;
    role: UserRole;
    requestedBranchId?: string;
  }): Promise<BranchRequestContext> {
    const [defaultBranchRow, activeBranches] = await Promise.all([
      this.branchesRepository.findDefaultBranchByShopId(input.shopId),
      this.branchesRepository.listActiveBranchesByShop(input.shopId),
    ]);

    if (!defaultBranchRow) {
      throw buildAppError(
        500,
        "DEFAULT_BRANCH_MISSING",
        "Default branch configuration is missing for this shop.",
      );
    }

    const defaultBranch = toAccessibleBranch(defaultBranchRow);
    let accessibleBranches = activeBranches.map(toAccessibleBranch);

    if (input.role !== "admin") {
      const assigned = await this.branchesRepository.listAssignedBranchesForUser(
        input.shopId,
        input.userId,
      );

      if (assigned.length) {
        accessibleBranches = assigned
          .map((row) => toAccessibleBranch(row.branch))
          .filter((branch) => branch.status === "active");
      } else if (input.role === "accountant") {
        accessibleBranches = activeBranches.map(toAccessibleBranch);
      } else {
        accessibleBranches = [defaultBranch];
      }
    }

    const uniqueBranches = [
      ...new Map(accessibleBranches.map((branch) => [branch.id, branch])).values(),
    ];
    const currentBranch =
      uniqueBranches.find((branch) => branch.id === input.requestedBranchId) ??
      uniqueBranches.find((branch) => branch.id === defaultBranch.id) ??
      uniqueBranches[0];

    if (!currentBranch) {
      throw buildAppError(
        403,
        "BRANCH_ACCESS_DENIED",
        "No active branch access is available for this user.",
      );
    }

    return {
      currentBranch,
      defaultBranch,
      accessibleBranches: uniqueBranches,
    };
  }

  async listBranches(
    shopId: string,
    auth: { userId: string; role: UserRole; requestedBranchId?: string },
  ) {
    const [rows, context] = await Promise.all([
      this.branchesRepository.listBranchesByShop(shopId),
      this.resolveRequestBranchContext({
        shopId,
        userId: auth.userId,
        role: auth.role,
        ...(auth.requestedBranchId
          ? { requestedBranchId: auth.requestedBranchId }
          : {}),
      }),
    ]);

    const allowedIds =
      auth.role === "admin"
        ? null
        : new Set(context.accessibleBranches.map((branch) => branch.id));

    return {
      selectedBranchId: context.currentBranch.id,
      defaultBranchId: context.defaultBranch.id,
      items: rows
        .filter((row) => !allowedIds || allowedIds.has(row.branch.id))
        .map((row) => ({
          id: row.branch.id,
          shopId: row.branch.shopId,
          name: row.branch.name,
          code: row.branch.code,
          address: row.branch.address,
          contactNumber: row.branch.contactNumber,
          status: row.branch.status,
          isDefault: row.branch.isDefault,
          assignedUsers: Number(row.assignedUsers ?? 0),
          settings: {
            lowStockThreshold: row.settings?.lowStockThreshold ?? null,
            lowStockAlertsEnabled: row.settings?.lowStockAlertsEnabled ?? null,
            lowStockEmailAlertsEnabled:
              row.settings?.lowStockEmailAlertsEnabled ?? null,
            nearExpiryAlertDays: row.settings?.nearExpiryAlertDays ?? null,
            expiryAlertsEnabled: row.settings?.expiryAlertsEnabled ?? null,
            expiryEmailAlertsEnabled:
              row.settings?.expiryEmailAlertsEnabled ?? null,
            invoicePrefix: row.settings?.invoicePrefix ?? null,
          },
        })),
    };
  }

  async createBranch(shopId: string, input: CreateBranchInput, actor: PublicUser) {
    return db.transaction(async (tx) => {
      const existing = await this.branchesRepository.listBranchesByShop(shopId, tx);

      if (
        existing.some((row) => row.branch.code.toLowerCase() === input.code.toLowerCase())
      ) {
        throw buildAppError(
          409,
          "BRANCH_CODE_EXISTS",
          "Branch code already exists for this shop.",
        );
      }

      if (
        existing.some((row) => row.branch.name.toLowerCase() === input.name.toLowerCase())
      ) {
        throw buildAppError(
          409,
          "BRANCH_NAME_EXISTS",
          "Branch name already exists for this shop.",
        );
      }

      if (input.isDefault) {
        await this.branchesRepository.clearDefaultFlag(shopId, tx);
      }

      const created = await this.branchesRepository.createBranch(
        {
          shopId,
          name: input.name,
          code: input.code,
          address: input.address,
          contactNumber: input.contactNumber,
          status: input.status,
          isDefault: input.isDefault,
        },
        {
          lowStockThreshold: input.settings.lowStockThreshold,
          lowStockAlertsEnabled: input.settings.lowStockAlertsEnabled,
          lowStockEmailAlertsEnabled: input.settings.lowStockEmailAlertsEnabled,
          nearExpiryAlertDays: input.settings.nearExpiryAlertDays,
          expiryAlertsEnabled: input.settings.expiryAlertsEnabled,
          expiryEmailAlertsEnabled: input.settings.expiryEmailAlertsEnabled,
          invoicePrefix: input.settings.invoicePrefix,
        },
        tx,
      );

      await this.auditLogsService.record(
        {
          actor,
          module: "settings",
          action: "branch_created",
          entityType: "branch",
          entityId: created.id,
          severity: "important",
          title: `Branch ${created.name} created`,
          description: `Branch ${created.name} was created.`,
          afterData: {
            name: created.name,
            code: created.code,
            status: created.status,
            isDefault: created.isDefault,
          },
          metadata: {
            branchId: created.id,
          },
        },
        tx,
      );

      return created;
    });
  }

  async updateBranch(
    shopId: string,
    branchId: string,
    input: UpdateBranchInput,
    actor: PublicUser,
  ) {
    return db.transaction(async (tx) => {
      const current = await this.branchesRepository.findBranchById(shopId, branchId, tx);

      if (!current) {
        throw buildAppError(404, "BRANCH_NOT_FOUND", "Branch not found.");
      }

      if (input.isDefault) {
        await this.branchesRepository.clearDefaultFlag(shopId, tx);
      }

      if (current.isDefault && input.status === "inactive") {
        throw buildAppError(
          400,
          "DEFAULT_BRANCH_PROTECTED",
          "Default branch cannot be deactivated.",
        );
      }

      const updated = await this.branchesRepository.updateBranch(
        branchId,
        {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.address !== undefined ? { address: input.address } : {}),
          ...(input.contactNumber !== undefined
            ? { contactNumber: input.contactNumber }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        },
        input.settings
          ? {
              lowStockThreshold: input.settings.lowStockThreshold,
              lowStockAlertsEnabled: input.settings.lowStockAlertsEnabled,
              lowStockEmailAlertsEnabled:
                input.settings.lowStockEmailAlertsEnabled,
              nearExpiryAlertDays: input.settings.nearExpiryAlertDays,
              expiryAlertsEnabled: input.settings.expiryAlertsEnabled,
              expiryEmailAlertsEnabled:
                input.settings.expiryEmailAlertsEnabled,
              invoicePrefix: input.settings.invoicePrefix,
            }
          : undefined,
        tx,
      );

      if (!updated) {
        throw buildAppError(404, "BRANCH_NOT_FOUND", "Branch not found.");
      }

      await this.auditLogsService.record(
        {
          actor,
          module: "settings",
          action: "branch_updated",
          entityType: "branch",
          entityId: updated.id,
          severity: "important",
          title: `Branch ${updated.name} updated`,
          description: `Branch ${updated.name} was updated.`,
          beforeData: {
            name: current.name,
            code: current.code,
            status: current.status,
            isDefault: current.isDefault,
          },
          afterData: {
            name: updated.name,
            code: updated.code,
            status: updated.status,
            isDefault: updated.isDefault,
          },
          metadata: {
            branchId: updated.id,
          },
        },
        tx,
      );

      return updated;
    });
  }

  async updateUserBranchAssignments(
    shopId: string,
    userId: string,
    input: UpdateUserBranchAssignmentsInput,
    actor: PublicUser,
  ) {
    const user = await this.usersRepository.findById(userId);

    if (!user || user.shopId !== shopId) {
      throw buildAppError(404, "USER_NOT_FOUND", "User not found.");
    }

    if (user.role === "admin") {
      throw buildAppError(
        400,
        "ADMIN_BRANCH_ASSIGNMENT_BLOCKED",
        "Admin users always retain access to all branches.",
      );
    }

    const defaultBranch = await this.branchesRepository.findDefaultBranchByShopId(shopId);

    if (!defaultBranch) {
      throw buildAppError(
        500,
        "DEFAULT_BRANCH_MISSING",
        "Default branch configuration is missing for this shop.",
      );
    }

    const allBranches = await this.branchesRepository.listBranchesByShop(shopId);
    const branchMap = new Map(allBranches.map((row) => [row.branch.id, row.branch]));
    const nextBranchIds = input.branchIds.length ? input.branchIds : [defaultBranch.id];

    for (const branchId of nextBranchIds) {
      const branch = branchMap.get(branchId);

      if (!branch) {
        throw buildAppError(404, "BRANCH_NOT_FOUND", "Branch not found.");
      }

      if (branch.status !== "active") {
        throw buildAppError(
          400,
          "BRANCH_INACTIVE",
          "Inactive branches cannot be assigned to users.",
        );
      }
    }

    await db.transaction(async (tx) => {
      await this.branchesRepository.replaceUserBranchAssignments(
        shopId,
        userId,
        nextBranchIds,
        tx,
      );

      await this.auditLogsService.record(
        {
          actor,
          module: "users",
          action: "user_branch_assignments_updated",
          entityType: "user",
          entityId: userId,
          severity: "important",
          title: `Branch access updated for ${user.fullName}`,
          description: `Branch assignments were updated for ${user.fullName}.`,
          afterData: {
            branchIds: nextBranchIds,
          },
          metadata: {
            targetUserId: userId,
          },
        },
        tx,
      );
    });

    return this.listUserBranchAssignments(shopId, userId);
  }

  async listUserBranchAssignments(shopId: string, userId: string) {
    const assigned = await this.branchesRepository.listAssignedBranchesForUser(
      shopId,
      userId,
    );

    return {
      branchIds: assigned.map((row) => row.branch.id),
      items: assigned.map((row) => ({
        id: row.branch.id,
        name: row.branch.name,
        code: row.branch.code,
        isDefault: row.branch.isDefault,
        status: row.branch.status,
      })),
    };
  }

  async getResolvedBranchSettings(
    shopId: string,
    branchId: string,
    executor?: DbExecutor,
  ) {
    const [shopSettings, branchOverride] = await runDbReads(
      [
        () => this.adminSettingsService.getResolvedShopSettings(shopId, executor),
        () => this.branchesRepository.findBranchSettings(branchId, executor),
      ] as const,
      executor,
    );

    return {
      ...shopSettings,
      defaultLowStockThreshold:
        branchOverride?.lowStockThreshold ?? shopSettings.defaultLowStockThreshold,
      lowStockAlertsEnabled:
        branchOverride?.lowStockAlertsEnabled ?? shopSettings.lowStockAlertsEnabled,
      lowStockEmailAlertsEnabled:
        branchOverride?.lowStockEmailAlertsEnabled ??
        shopSettings.lowStockEmailAlertsEnabled,
      nearExpiryAlertDays:
        branchOverride?.nearExpiryAlertDays ?? shopSettings.nearExpiryAlertDays,
      expiryAlertsEnabled:
        branchOverride?.expiryAlertsEnabled ?? shopSettings.expiryAlertsEnabled,
      expiryEmailAlertsEnabled:
        branchOverride?.expiryEmailAlertsEnabled ??
        shopSettings.expiryEmailAlertsEnabled,
      invoicePrefix: branchOverride?.invoicePrefix ?? shopSettings.invoicePrefix,
      branchId,
    };
  }

  async listResolvedBranchLowStockThresholds(
    shopId: string,
    branchIds: string[],
    executor?: DbExecutor,
  ) {
    if (!branchIds.length) {
      return new Map<string, number>();
    }

    const [shopSettings, branchOverrides] = await runDbReads(
      [
        () => this.adminSettingsService.getResolvedShopSettings(shopId, executor),
        () => this.branchesRepository.listBranchSettingsByIds(branchIds, executor),
      ] as const,
      executor,
    );
    const branchSettingsMap = new Map(
      branchOverrides.map((settings) => [settings.branchId, settings]),
    );

    return new Map(
      branchIds.map((branchId) => [
        branchId,
        branchSettingsMap.get(branchId)?.lowStockThreshold ??
          shopSettings.defaultLowStockThreshold,
      ]),
    );
  }
}
