import { and, asc, eq } from "drizzle-orm";

import { lowStockAlertStates, shops, users } from "../../db/schema";
import { getDbExecutor, type DbExecutor } from "../../shared/db/executor";

export class AlertsRepository {
  async findLowStockAlertState(
    shopId: string,
    medicineId: string,
    executor?: DbExecutor,
  ) {
    const [state] = await getDbExecutor(executor)
      .select()
      .from(lowStockAlertStates)
      .where(
        and(
          eq(lowStockAlertStates.shopId, shopId),
          eq(lowStockAlertStates.medicineId, medicineId),
        ),
      )
      .limit(1);

    return state ?? null;
  }

  async upsertLowStockAlertState(
    payload: {
      shopId: string;
      medicineId: string;
      isLowStock: boolean;
      currentAvailableQuantity: number;
      reorderLevel: number;
      enteredLowStockAt: Date | null;
      resolvedAt: Date | null;
      lastAlertSentAt: Date | null;
    },
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const now = new Date();
    const [state] = await database
      .insert(lowStockAlertStates)
      .values({
        ...payload,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [lowStockAlertStates.shopId, lowStockAlertStates.medicineId],
        set: {
          isLowStock: payload.isLowStock,
          currentAvailableQuantity: payload.currentAvailableQuantity,
          reorderLevel: payload.reorderLevel,
          enteredLowStockAt: payload.enteredLowStockAt,
          resolvedAt: payload.resolvedAt,
          lastAlertSentAt: payload.lastAlertSentAt,
          updatedAt: now,
        },
      })
      .returning();

    return state ?? null;
  }

  async listAdminEmailRecipients(shopId: string, executor?: DbExecutor) {
    return getDbExecutor(executor)
      .select({
        shop: {
          id: shops.id,
          name: shops.name,
        },
        user: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
        },
      })
      .from(users)
      .innerJoin(shops, eq(users.shopId, shops.id))
      .where(
        and(
          eq(users.shopId, shopId),
          eq(users.role, "admin"),
          eq(users.isActive, true),
        ),
      )
      .orderBy(asc(users.createdAt), asc(users.id));
  }
}
