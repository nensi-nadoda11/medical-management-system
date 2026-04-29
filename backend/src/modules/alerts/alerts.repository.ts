import { and, asc, eq, gt, sql, lte } from "drizzle-orm";

import {
  lowStockAlertStates,
  medicineBatches,
  medicines,
  purchaseItems,
  purchases,
  shops,
  suppliers,
  users,
} from "../../db/schema";
import { getDbExecutor, type DbExecutor } from "../../shared/db/executor";

export class AlertsRepository {
  private readonly onHandQuantityExpr = sql<number>`
    coalesce(
      sum(
        case
          when ${medicineBatches.quantityAvailable} > 0
          then ${medicineBatches.quantityAvailable}
          else 0
        end
      ),
      0
    )
  `;

  private buildLowStockHavingExpr(
    reorderLevelExpr: ReturnType<AlertsRepository["buildResolvedReorderLevelExpr"]>,
  ) {
    return sql`
      ${this.buildAvailableQuantityExpr()} <= ${reorderLevelExpr}
      and not (${this.buildAvailableQuantityExpr()} = 0 and ${this.onHandQuantityExpr} > 0)
    `;
  }

  private buildAvailableQuantityExpr() {
    return sql<number>`
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
  }

  private buildResolvedReorderLevelExpr(defaultThreshold: number) {
    return sql<number>`
      case
        when ${medicines.reorderLevel} > 0 then ${medicines.reorderLevel}
        else ${defaultThreshold}
      end
    `;
  }

  private buildLowStockMedicinesQuery(
    shopId: string,
    branchId: string,
    defaultThreshold: number,
    executor?: DbExecutor,
  ) {
    const availableQuantityExpr = this.buildAvailableQuantityExpr();
    const reorderLevelExpr = this.buildResolvedReorderLevelExpr(defaultThreshold);

    return getDbExecutor(executor)
      .select({
        medicineId: medicines.id,
        medicineName: medicines.medicineName,
        medicineNameNormalized: medicines.medicineNameNormalized,
        availableQuantity: availableQuantityExpr.as("available_quantity"),
        reorderLevel: reorderLevelExpr.as("reorder_level"),
      })
      .from(medicines)
      .leftJoin(
        medicineBatches,
        and(
          eq(medicineBatches.shopId, shopId),
          eq(medicineBatches.branchId, branchId),
          eq(medicineBatches.medicineId, medicines.id),
        ),
      )
      .where(eq(medicines.shopId, shopId))
      .groupBy(medicines.id)
      .having(this.buildLowStockHavingExpr(reorderLevelExpr))
      .as("low_stock_medicines");
  }

  private buildPreferredSupplierCandidatesQuery(
    shopId: string,
    branchId: string,
    executor?: DbExecutor,
  ) {
    const supplierRankExpr = sql<number>`
      row_number() over (
        partition by ${purchaseItems.medicineId}
        order by
          case when ${purchases.branchId} = ${branchId} then 0 else 1 end,
          ${purchases.purchaseDate} desc,
          ${purchases.createdAt} desc,
          ${purchaseItems.createdAt} desc,
          ${purchases.id} desc
      )
    `;

    return getDbExecutor(executor)
      .select({
        medicineId: purchaseItems.medicineId,
        supplierId: suppliers.id,
        supplierName: suppliers.supplierName,
        companyName: suppliers.companyName,
        contactPerson: suppliers.contactPerson,
        supplierEmail: suppliers.email,
        supplierMobileNumber: suppliers.mobileNumber,
        supplierAlternateMobileNumber: suppliers.alternateMobileNumber,
        shopName: shops.name,
        supplierRank: supplierRankExpr.as("supplier_rank"),
      })
      .from(purchaseItems)
      .innerJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
      .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
      .innerJoin(shops, eq(purchases.shopId, shops.id))
      .where(
        and(
          eq(purchaseItems.shopId, shopId),
          eq(purchases.shopId, shopId),
          eq(purchases.status, "finalized"),
          eq(suppliers.status, "active"),
        ),
      )
      .as("preferred_suppliers");
  }

  async findLowStockAlertState(
    shopId: string,
    branchId: string,
    medicineId: string,
    executor?: DbExecutor,
  ) {
    const [state] = await getDbExecutor(executor)
      .select()
      .from(lowStockAlertStates)
      .where(
        and(
          eq(lowStockAlertStates.shopId, shopId),
          eq(lowStockAlertStates.branchId, branchId),
          eq(lowStockAlertStates.medicineId, medicineId),
        ),
      )
      .limit(1);

    return state ?? null;
  }

  async upsertLowStockAlertState(
    payload: {
      shopId: string;
      branchId: string;
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
        target: [
          lowStockAlertStates.shopId,
          lowStockAlertStates.branchId,
          lowStockAlertStates.medicineId,
        ],
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
          mobileNumber: users.mobileNumber,
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
    branchId: string,
    defaultThreshold: number,
    executor?: DbExecutor,
  ) {
    const lowStockMedicines = this.buildLowStockMedicinesQuery(
      shopId,
      branchId,
      defaultThreshold,
      executor,
    );

    return getDbExecutor(executor)
      .select({
        medicineId: lowStockMedicines.medicineId,
        medicineName: lowStockMedicines.medicineName,
        availableQuantity: lowStockMedicines.availableQuantity,
        reorderLevel: lowStockMedicines.reorderLevel,
      })
      .from(lowStockMedicines)
      .orderBy(
        asc(lowStockMedicines.medicineNameNormalized),
        asc(lowStockMedicines.medicineId),
      );
  }

  async listCurrentLowStockSupplierReorderTargets(
    shopId: string,
    branchId: string,
    defaultThreshold: number,
    executor?: DbExecutor,
  ) {
    const lowStockMedicines = this.buildLowStockMedicinesQuery(
      shopId,
      branchId,
      defaultThreshold,
      executor,
    );
    const preferredSuppliers = this.buildPreferredSupplierCandidatesQuery(
      shopId,
      branchId,
      executor,
    );

    return getDbExecutor(executor)
      .select({
        medicineId: lowStockMedicines.medicineId,
        medicineName: lowStockMedicines.medicineName,
        availableQuantity: lowStockMedicines.availableQuantity,
        reorderLevel: lowStockMedicines.reorderLevel,
        supplierId: preferredSuppliers.supplierId,
        supplierName: preferredSuppliers.supplierName,
        companyName: preferredSuppliers.companyName,
        contactPerson: preferredSuppliers.contactPerson,
        supplierEmail: preferredSuppliers.supplierEmail,
        supplierMobileNumber: preferredSuppliers.supplierMobileNumber,
        supplierAlternateMobileNumber:
          preferredSuppliers.supplierAlternateMobileNumber,
        shopName: preferredSuppliers.shopName,
      })
      .from(lowStockMedicines)
      .innerJoin(
        preferredSuppliers,
        and(
          eq(preferredSuppliers.medicineId, lowStockMedicines.medicineId),
          sql`${preferredSuppliers.supplierRank} = 1`,
        ),
      )
      .orderBy(
        asc(lowStockMedicines.medicineNameNormalized),
        asc(lowStockMedicines.medicineId),
      );
  }

  async findPreferredSupplierForMedicine(
    shopId: string,
    branchId: string,
    medicineId: string,
    executor?: DbExecutor,
  ) {
    const preferredSuppliers = this.buildPreferredSupplierCandidatesQuery(
      shopId,
      branchId,
      executor,
    );

    const [row] = await getDbExecutor(executor)
      .select({
        medicineId: preferredSuppliers.medicineId,
        supplierId: preferredSuppliers.supplierId,
        supplierName: preferredSuppliers.supplierName,
        companyName: preferredSuppliers.companyName,
        contactPerson: preferredSuppliers.contactPerson,
        supplierEmail: preferredSuppliers.supplierEmail,
        supplierMobileNumber: preferredSuppliers.supplierMobileNumber,
        supplierAlternateMobileNumber:
          preferredSuppliers.supplierAlternateMobileNumber,
        shopName: preferredSuppliers.shopName,
      })
      .from(preferredSuppliers)
      .where(
        and(
          eq(preferredSuppliers.medicineId, medicineId),
          sql`${preferredSuppliers.supplierRank} = 1`,
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async listCurrentExpiryBatches(
    shopId: string,
    branchId: string,
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
          eq(medicineBatches.branchId, branchId),
          gt(medicineBatches.quantityAvailable, 0),
          lte(medicineBatches.expiryDate, nearExpiryLimit),
        ),
      )
      .orderBy(asc(medicineBatches.expiryDate), asc(medicineBatches.id));
  }
}
