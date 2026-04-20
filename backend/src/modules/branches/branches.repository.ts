import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

import {
  branches,
  branchSettings,
  userBranches,
  users,
} from "../../db/schema";
import { getDbExecutor, type DbExecutor } from "../../shared/db/executor";

export class BranchesRepository {
  async findDefaultBranchByShopId(shopId: string, executor?: DbExecutor) {
    const [branch] = await getDbExecutor(executor)
      .select()
      .from(branches)
      .where(and(eq(branches.shopId, shopId), eq(branches.isDefault, true)))
      .limit(1);

    return branch ?? null;
  }

  async findBranchById(shopId: string, branchId: string, executor?: DbExecutor) {
    const [branch] = await getDbExecutor(executor)
      .select()
      .from(branches)
      .where(and(eq(branches.shopId, shopId), eq(branches.id, branchId)))
      .limit(1);

    return branch ?? null;
  }

  async listBranchesByShop(shopId: string, executor?: DbExecutor) {
    return getDbExecutor(executor)
      .select({
        branch: branches,
        settings: branchSettings,
        assignedUsers: sql<number>`count(${userBranches.id})`,
      })
      .from(branches)
      .leftJoin(branchSettings, eq(branchSettings.branchId, branches.id))
      .leftJoin(userBranches, eq(userBranches.branchId, branches.id))
      .where(eq(branches.shopId, shopId))
      .groupBy(branches.id, branchSettings.branchId)
      .orderBy(desc(branches.isDefault), asc(branches.name), asc(branches.id));
  }

  async listActiveBranchesByShop(shopId: string, executor?: DbExecutor) {
    return getDbExecutor(executor)
      .select()
      .from(branches)
      .where(and(eq(branches.shopId, shopId), eq(branches.status, "active")))
      .orderBy(desc(branches.isDefault), asc(branches.name), asc(branches.id));
  }

  async listAssignedBranchesForUser(
    shopId: string,
    userId: string,
    executor?: DbExecutor,
  ) {
    return getDbExecutor(executor)
      .select({
        branch: branches,
        settings: branchSettings,
      })
      .from(userBranches)
      .innerJoin(branches, eq(branches.id, userBranches.branchId))
      .leftJoin(branchSettings, eq(branchSettings.branchId, branches.id))
      .where(and(eq(userBranches.shopId, shopId), eq(userBranches.userId, userId)))
      .orderBy(desc(branches.isDefault), asc(branches.name), asc(branches.id));
  }

  async clearDefaultFlag(shopId: string, executor: DbExecutor) {
    await getDbExecutor(executor)
      .update(branches)
      .set({
        isDefault: false,
        updatedAt: new Date(),
      })
      .where(and(eq(branches.shopId, shopId), eq(branches.isDefault, true)));
  }

  async createBranch(
    payload: typeof branches.$inferInsert,
    settings: Partial<typeof branchSettings.$inferInsert>,
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [branch] = await database.insert(branches).values(payload).returning();

    if (!branch) {
      throw new Error("Failed to create branch.");
    }

    await database
      .insert(branchSettings)
      .values({
        branchId: branch.id,
        ...settings,
      })
      .onConflictDoUpdate({
        target: branchSettings.branchId,
        set: {
          ...settings,
          updatedAt: new Date(),
        },
      });

    return branch;
  }

  async updateBranch(
    branchId: string,
    payload: Partial<typeof branches.$inferInsert>,
    settings: Partial<typeof branchSettings.$inferInsert> | undefined,
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [branch] = await database
      .update(branches)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(branches.id, branchId))
      .returning();

    if (!branch) {
      return null;
    }

    if (settings) {
      await database
        .insert(branchSettings)
        .values({
          branchId,
          ...settings,
        })
        .onConflictDoUpdate({
          target: branchSettings.branchId,
          set: {
            ...settings,
            updatedAt: new Date(),
          },
        });
    }

    return branch;
  }

  async replaceUserBranchAssignments(
    shopId: string,
    userId: string,
    branchIds: string[],
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    await database
      .delete(userBranches)
      .where(and(eq(userBranches.shopId, shopId), eq(userBranches.userId, userId)));

    if (!branchIds.length) {
      return [];
    }

    return database
      .insert(userBranches)
      .values(
        branchIds.map((branchId) => ({
          shopId,
          userId,
          branchId,
        })),
      )
      .returning();
  }

  async findBranchSettings(branchId: string, executor?: DbExecutor) {
    const [settings] = await getDbExecutor(executor)
      .select()
      .from(branchSettings)
      .where(eq(branchSettings.branchId, branchId))
      .limit(1);

    return settings ?? null;
  }

  async listUsersByIds(ids: string[], executor?: DbExecutor) {
    if (!ids.length) {
      return [];
    }

    return getDbExecutor(executor)
      .select()
      .from(users)
      .where(inArray(users.id, ids));
  }

  async countActiveBranches(shopId: string, executor?: DbExecutor) {
    const [result] = await getDbExecutor(executor)
      .select({ total: count() })
      .from(branches)
      .where(and(eq(branches.shopId, shopId), eq(branches.status, "active")));

    return result?.total ?? 0;
  }
}
