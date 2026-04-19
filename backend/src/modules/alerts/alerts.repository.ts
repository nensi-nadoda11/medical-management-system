import { and, asc, eq, gt, sql, lte } from "drizzle-orm";

import {
  lowStockAlertStates,
  medicineBatches,
  medicines,
  shops,
  users,
} from "../../db/schema";
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

  async listCurrentLowStockMedicines(
    shopId: string,
    defaultThreshold: number,
    executor?: DbExecutor,
  ) {
    const availableQuantityExpr = sql<number>`
      coalesce(
        sum(
          case
            when ${medicineBatches.quantityAvailable} > 0
             and ${medicineBatches.expiryDate} >= now()
            then ${medicineBatches.quantityAvailable}
            else 0
          end
        ),
        0
      )
    `;
    const reorderLevelExpr = sql<number>`
      case
        when ${medicines.reorderLevel} > 0 then ${medicines.reorderLevel}
        else ${defaultThreshold}
      end
    `;

    return getDbExecutor(executor)
      .select({
        medicineId: medicines.id,
        medicineName: medicines.medicineName,
        availableQuantity: availableQuantityExpr,
        reorderLevel: reorderLevelExpr,
      })
      .from(medicines)
      .leftJoin(
        medicineBatches,
        and(
          eq(medicineBatches.shopId, shopId),
          eq(medicineBatches.medicineId, medicines.id),
        ),
      )
      .where(eq(medicines.shopId, shopId))
      .groupBy(medicines.id)
      .having(sql`${availableQuantityExpr} <= ${reorderLevelExpr}`)
      .orderBy(asc(medicines.medicineNameNormalized), asc(medicines.id));
  }

  async listCurrentExpiryBatches(
    shopId: string,
    nearExpiryDays: number,
    executor?: DbExecutor,
  ) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const nearExpiryLimit = new Date(todayStart);
    nearExpiryLimit.setDate(nearExpiryLimit.getDate() + nearExpiryDays);

    return getDbExecutor(executor)
      .select({
        batchId: medicineBatches.id,
        batchNumber: medicineBatches.batchNumber,
        expiryDate: medicineBatches.expiryDate,
        quantityAvailable: medicineBatches.quantityAvailable,
        medicineId: medicines.id,
        medicineName: medicines.medicineName,
      })
      .from(medicineBatches)
      .innerJoin(medicines, eq(medicineBatches.medicineId, medicines.id))
      .where(
        and(
          eq(medicineBatches.shopId, shopId),
          gt(medicineBatches.quantityAvailable, 0),
          lte(medicineBatches.expiryDate, nearExpiryLimit),
        ),
      )
      .orderBy(asc(medicineBatches.expiryDate), asc(medicineBatches.id));
  }
}
