import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import {
  manufacturers,
  medicineBatches,
  medicineCategories,
  medicines,
  saleItems,
  sales,
  shops,
  suppliers,
  users,
  purchases,
} from "../../db/schema";
import { getDbExecutor } from "../../shared/db/executor";
import type {
  ExpiryReportQuery,
  LowStockReportQuery,
  ProfitReportQuery,
  SalesReportQuery,
  StockReportQuery,
  SupplierReportQuery,
  UsageReportQuery,
} from "./reports.validation";

interface ReportAccessScope {
  role: "admin" | "staff" | "accountant";
  userId: string;
}

const todayStart = () => {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
};

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

const onHandQuantityExpr = sql<number>`
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

const currentStockValueExpr = sql<string>`
  coalesce(sum(${medicineBatches.purchaseRate} * ${medicineBatches.quantityAvailable}), 0)::text
`;

const resolvedReorderLevelExpr = (defaultThreshold: number) => sql<number>`
  case
    when ${medicines.reorderLevel} > 0 then ${medicines.reorderLevel}
    else ${defaultThreshold}
  end
`;

const buildLowStockHavingExpr = (
  reorderLevelExpr: ReturnType<typeof resolvedReorderLevelExpr>,
) => sql`
  ${availableQuantityExpr} <= ${reorderLevelExpr}
  and not (${availableQuantityExpr} = 0 and ${onHandQuantityExpr} > 0)
`;

const buildBranchScopeFilter = (column: AnyPgColumn, branchIds: string[]) =>
  branchIds.length === 1 ? eq(column, branchIds[0]!) : inArray(column, branchIds);

const buildCompletedSalesFilters = (
  shopId: string,
  branchIds: string[],
  query: Pick<SalesReportQuery, "search" | "paymentMethod" | "dateFrom" | "dateTo">,
  accessScope: ReportAccessScope,
) => {
  const filters = [
    eq(sales.shopId, shopId),
    buildBranchScopeFilter(sales.branchId, branchIds),
    eq(sales.status, "completed"),
  ];

  if (accessScope.role === "staff") {
    filters.push(eq(sales.createdByUserId, accessScope.userId));
  }

  if (query.search) {
    filters.push(
      or(
        like(sales.billNumberNormalized, `%${query.search}%`),
        sql`lower(coalesce(${sales.customerName}, '')) like ${`%${query.search}%`}`,
        like(sales.customerPhone, `%${query.search}%`),
      )!,
    );
  }

  if (query.paymentMethod) {
    filters.push(eq(sales.paymentMethod, query.paymentMethod));
  }

  if (query.dateFrom) {
    filters.push(gte(sales.completedAt, query.dateFrom));
  }

  if (query.dateTo) {
    filters.push(lte(sales.completedAt, query.dateTo));
  }

  return and(...filters);
};

const buildProfitFilters = (
  shopId: string,
  branchIds: string[],
  query: Pick<ProfitReportQuery, "search" | "dateFrom" | "dateTo">,
  accessScope: ReportAccessScope,
) => {
  const filters = [
    eq(sales.shopId, shopId),
    buildBranchScopeFilter(sales.branchId, branchIds),
    eq(sales.status, "completed"),
  ];

  if (accessScope.role === "staff") {
    filters.push(eq(sales.createdByUserId, accessScope.userId));
  }

  if (query.search) {
    filters.push(
      or(
        like(sales.billNumberNormalized, `%${query.search}%`),
        sql`lower(coalesce(${sales.customerName}, '')) like ${`%${query.search}%`}`,
      )!,
    );
  }

  if (query.dateFrom) {
    filters.push(gte(sales.completedAt, query.dateFrom));
  }

  if (query.dateTo) {
    filters.push(lte(sales.completedAt, query.dateTo));
  }

  return and(...filters);
};

const buildStockFilters = (shopId: string, branchIds: string[], query: StockReportQuery) => {
  const filters = [
    eq(medicineBatches.shopId, shopId),
    buildBranchScopeFilter(medicineBatches.branchId, branchIds),
    sql`${medicineBatches.quantityAvailable} > 0`,
  ];

  if (query.search) {
    filters.push(
      or(
        like(medicines.medicineNameNormalized, `%${query.search}%`),
        like(medicines.genericNameNormalized, `%${query.search}%`),
        like(medicineBatches.batchNumberNormalized, `%${query.search}%`),
        like(medicines.barcode, `%${query.search}%`),
      )!,
    );
  }

  if (query.categoryId) {
    filters.push(eq(medicines.categoryId, query.categoryId));
  }

  if (query.manufacturerId) {
    filters.push(eq(medicines.manufacturerId, query.manufacturerId));
  }

  if (query.batchStatus) {
    filters.push(eq(medicineBatches.status, query.batchStatus));
  }

  return and(...filters);
};

const buildLowStockFilters = (
  shopId: string,
  _branchIds: string[],
  query: LowStockReportQuery,
) => {
  const filters = [eq(medicines.shopId, shopId)];

  if (query.search) {
    filters.push(
      or(
        like(medicines.medicineNameNormalized, `%${query.search}%`),
        like(medicines.genericNameNormalized, `%${query.search}%`),
        like(medicines.barcode, `%${query.search}%`),
      )!,
    );
  }

  if (query.categoryId) {
    filters.push(eq(medicines.categoryId, query.categoryId));
  }

  if (query.manufacturerId) {
    filters.push(eq(medicines.manufacturerId, query.manufacturerId));
  }

  return and(...filters);
};

const buildExpiryFilters = (
  shopId: string,
  branchIds: string[],
  query: ExpiryReportQuery,
) => {
  const filters = [
    eq(medicineBatches.shopId, shopId),
    buildBranchScopeFilter(medicineBatches.branchId, branchIds),
    sql`${medicineBatches.quantityAvailable} > 0`,
  ];

  if (query.medicineId) {
    filters.push(eq(medicineBatches.medicineId, query.medicineId));
  }

  if (query.search) {
    filters.push(
      or(
        like(medicines.medicineNameNormalized, `%${query.search}%`),
        like(medicines.genericNameNormalized, `%${query.search}%`),
        like(medicineBatches.batchNumberNormalized, `%${query.search}%`),
        like(medicines.barcode, `%${query.search}%`),
      )!,
    );
  }

  if (query.expiryWindow === "expired") {
    filters.push(lte(medicineBatches.expiryDate, new Date()));
  } else {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + Number.parseInt(query.expiryWindow, 10));
    filters.push(gte(medicineBatches.expiryDate, new Date()));
    filters.push(lte(medicineBatches.expiryDate, futureDate));
  }

  return and(...filters);
};

const buildSupplierFilters = (
  shopId: string,
  branchIds: string[],
  query: SupplierReportQuery,
) => {
  const filters = [
    eq(purchases.shopId, shopId),
    buildBranchScopeFilter(purchases.branchId, branchIds),
    eq(purchases.status, "finalized"),
  ];

  if (query.search) {
    filters.push(
      or(
        like(suppliers.supplierNameNormalized, `%${query.search}%`),
        like(suppliers.companyNameNormalized, `%${query.search}%`),
      )!,
    );
  }

  if (query.supplierId) {
    filters.push(eq(purchases.supplierId, query.supplierId));
  }

  if (query.dateFrom) {
    filters.push(gte(purchases.purchaseDate, query.dateFrom));
  }

  if (query.dateTo) {
    filters.push(lte(purchases.purchaseDate, query.dateTo));
  }

  return and(...filters);
};

const buildUsageFilters = (
  shopId: string,
  branchIds: string[],
  query: Pick<
    UsageReportQuery,
    "search" | "categoryId" | "manufacturerId" | "dateFrom" | "dateTo"
  >,
  accessScope: ReportAccessScope,
) => {
  const filters = [
    eq(sales.shopId, shopId),
    buildBranchScopeFilter(sales.branchId, branchIds),
    eq(sales.status, "completed"),
  ];

  if (accessScope.role === "staff") {
    filters.push(eq(sales.createdByUserId, accessScope.userId));
  }

  if (query.search) {
    filters.push(
      or(
        like(medicines.medicineNameNormalized, `%${query.search}%`),
        like(medicines.genericNameNormalized, `%${query.search}%`),
        like(medicines.barcode, `%${query.search}%`),
      )!,
    );
  }

  if (query.categoryId) {
    filters.push(eq(medicines.categoryId, query.categoryId));
  }

  if (query.manufacturerId) {
    filters.push(eq(medicines.manufacturerId, query.manufacturerId));
  }

  if (query.dateFrom) {
    filters.push(gte(sales.completedAt, query.dateFrom));
  }

  if (query.dateTo) {
    filters.push(lte(sales.completedAt, query.dateTo));
  }

  return and(...filters);
};

export class ReportsRepository {
  async getDashboardShop(shopId: string) {
    const [shop] = await getDbExecutor()
      .select({
        id: shops.id,
        name: shops.name,
      })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1);

    return shop ?? null;
  }

  async getSalesSummary(
    shopId: string,
    branchIds: string[],
    query: Pick<SalesReportQuery, "search" | "paymentMethod" | "dateFrom" | "dateTo">,
    accessScope: ReportAccessScope,
  ) {
    const [result] = await getDbExecutor()
      .select({
        totalSales: sql<string>`coalesce(sum(${sales.grandTotal}), 0)::text`,
        totalBills: sql<number>`count(${sales.id})`,
        averageBillValue: sql<string>`coalesce(avg(${sales.grandTotal}), 0)::text`,
      })
      .from(sales)
      .where(buildCompletedSalesFilters(shopId, branchIds, query, accessScope));

    return result;
  }

  async getSalesPaymentBreakdown(
    shopId: string,
    branchIds: string[],
    query: Pick<SalesReportQuery, "search" | "paymentMethod" | "dateFrom" | "dateTo">,
    accessScope: ReportAccessScope,
  ) {
    return getDbExecutor()
      .select({
        paymentMethod: sales.paymentMethod,
        totalSales: sql<string>`coalesce(sum(${sales.grandTotal}), 0)::text`,
        totalBills: sql<number>`count(${sales.id})`,
      })
      .from(sales)
      .where(buildCompletedSalesFilters(shopId, branchIds, query, accessScope))
      .groupBy(sales.paymentMethod)
      .orderBy(desc(sql`coalesce(sum(${sales.grandTotal}), 0)`));
  }

  async getSalesTrend(
    shopId: string,
    branchIds: string[],
    query: Pick<
      SalesReportQuery,
      "search" | "paymentMethod" | "dateFrom" | "dateTo" | "groupBy"
    >,
    accessScope: ReportAccessScope,
  ) {
    const bucket = query.groupBy === "month" ? "month" : "day";
    const periodExpr = sql<Date>`date_trunc(${sql.raw(`'${bucket}'`)}, ${sales.completedAt})`;

    return getDbExecutor()
      .select({
        periodStart: periodExpr,
        totalSales: sql<string>`coalesce(sum(${sales.grandTotal}), 0)::text`,
        totalBills: sql<number>`count(${sales.id})`,
        averageBillValue: sql<string>`coalesce(avg(${sales.grandTotal}), 0)::text`,
      })
      .from(sales)
      .where(buildCompletedSalesFilters(shopId, branchIds, query, accessScope))
      .groupBy(periodExpr)
      .orderBy(asc(periodExpr));
  }

  async listSalesReportRows(
    shopId: string,
    branchIds: string[],
    query: SalesReportQuery,
    accessScope: ReportAccessScope,
  ) {
    const orderBy =
      query.sortBy === "billNumber"
        ? [
            query.sortOrder === "asc"
              ? asc(sales.billNumberNormalized)
              : desc(sales.billNumberNormalized),
            desc(sales.id),
          ]
        : query.sortBy === "grandTotal"
          ? [
              query.sortOrder === "asc"
                ? asc(sales.grandTotal)
                : desc(sales.grandTotal),
              desc(sales.id),
            ]
          : [
              query.sortOrder === "asc"
                ? asc(sales.completedAt)
                : desc(sales.completedAt),
              desc(sales.id),
            ];

    return getDbExecutor()
      .select({
        sale: sales,
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(sales)
      .innerJoin(users, eq(sales.createdByUserId, users.id))
      .where(buildCompletedSalesFilters(shopId, branchIds, query, accessScope))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countSalesReportRows(
    shopId: string,
    branchIds: string[],
    query: SalesReportQuery,
    accessScope: ReportAccessScope,
  ) {
    const [result] = await getDbExecutor()
      .select({ total: sql<number>`count(${sales.id})` })
      .from(sales)
      .where(buildCompletedSalesFilters(shopId, branchIds, query, accessScope));

    return result?.total ?? 0;
  }

  async getProfitSummary(
    shopId: string,
    branchIds: string[],
    query: Pick<ProfitReportQuery, "search" | "dateFrom" | "dateTo">,
    accessScope: ReportAccessScope,
  ) {
    const [result] = await getDbExecutor()
      .select({
        revenue: sql<string>`coalesce(sum(${saleItems.lineTotal}), 0)::text`,
        cost: sql<string>`coalesce(sum(${medicineBatches.purchaseRate} * ${saleItems.quantity}), 0)::text`,
        profit: sql<string>`coalesce(sum(${saleItems.lineTotal} - (${medicineBatches.purchaseRate} * ${saleItems.quantity})), 0)::text`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(medicineBatches, eq(saleItems.batchId, medicineBatches.id))
      .where(buildProfitFilters(shopId, branchIds, query, accessScope));

    return result;
  }

  async getProfitTrend(
    shopId: string,
    branchIds: string[],
    query: Pick<ProfitReportQuery, "search" | "dateFrom" | "dateTo" | "groupBy">,
    accessScope: ReportAccessScope,
  ) {
    const bucket = query.groupBy === "month" ? "month" : "day";
    const periodExpr = sql<Date>`date_trunc(${sql.raw(`'${bucket}'`)}, ${sales.completedAt})`;

    return getDbExecutor()
      .select({
        periodStart: periodExpr,
        revenue: sql<string>`coalesce(sum(${saleItems.lineTotal}), 0)::text`,
        cost: sql<string>`coalesce(sum(${medicineBatches.purchaseRate} * ${saleItems.quantity}), 0)::text`,
        profit: sql<string>`coalesce(sum(${saleItems.lineTotal} - (${medicineBatches.purchaseRate} * ${saleItems.quantity})), 0)::text`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(medicineBatches, eq(saleItems.batchId, medicineBatches.id))
      .where(buildProfitFilters(shopId, branchIds, query, accessScope))
      .groupBy(periodExpr)
      .orderBy(asc(periodExpr));
  }

  async listProfitRows(
    shopId: string,
    branchIds: string[],
    query: ProfitReportQuery,
    accessScope: ReportAccessScope,
  ) {
    const revenueExpr = sql<string>`coalesce(sum(${saleItems.lineTotal}), 0)::text`;
    const costExpr = sql<string>`coalesce(sum(${medicineBatches.purchaseRate} * ${saleItems.quantity}), 0)::text`;
    const profitExpr = sql<string>`coalesce(sum(${saleItems.lineTotal} - (${medicineBatches.purchaseRate} * ${saleItems.quantity})), 0)::text`;

    const orderBy =
      query.sortBy === "revenue"
        ? [
            query.sortOrder === "asc" ? asc(sql`sum(${saleItems.lineTotal})`) : desc(sql`sum(${saleItems.lineTotal})`),
            desc(sales.id),
          ]
        : query.sortBy === "profit"
          ? [
              query.sortOrder === "asc"
                ? asc(sql`sum(${saleItems.lineTotal} - (${medicineBatches.purchaseRate} * ${saleItems.quantity}))`)
                : desc(sql`sum(${saleItems.lineTotal} - (${medicineBatches.purchaseRate} * ${saleItems.quantity}))`),
              desc(sales.id),
            ]
          : [
              query.sortOrder === "asc" ? asc(sales.completedAt) : desc(sales.completedAt),
              desc(sales.id),
            ];

    return getDbExecutor()
      .select({
        saleId: sales.id,
        billNumber: sales.billNumber,
        customerName: sales.customerName,
        completedAt: sales.completedAt,
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
        revenue: revenueExpr,
        cost: costExpr,
        profit: profitExpr,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(medicineBatches, eq(saleItems.batchId, medicineBatches.id))
      .innerJoin(users, eq(sales.createdByUserId, users.id))
      .where(buildProfitFilters(shopId, branchIds, query, accessScope))
      .groupBy(sales.id, users.id)
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countProfitRows(
    shopId: string,
    branchIds: string[],
    query: ProfitReportQuery,
    accessScope: ReportAccessScope,
  ) {
    const grouped = getDbExecutor()
      .select({ saleId: sales.id })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(medicineBatches, eq(saleItems.batchId, medicineBatches.id))
      .where(buildProfitFilters(shopId, branchIds, query, accessScope))
      .groupBy(sales.id)
      .as("profit_rows");

    const [result] = await getDbExecutor()
      .select({ total: sql<number>`count(*)` })
      .from(grouped);

    return result?.total ?? 0;
  }

  async getStockSummary(shopId: string, branchIds: string[], query: StockReportQuery) {
    const [result] = await getDbExecutor()
      .select({
        totalBatches: sql<number>`count(${medicineBatches.id})`,
        totalUnits: sql<number>`coalesce(sum(${medicineBatches.quantityAvailable}), 0)`,
        stockValuation: currentStockValueExpr,
        totalMedicines: sql<number>`count(distinct ${medicineBatches.medicineId})`,
      })
      .from(medicineBatches)
      .innerJoin(medicines, eq(medicineBatches.medicineId, medicines.id))
      .where(buildStockFilters(shopId, branchIds, query));

    return result;
  }

  async listStockRows(shopId: string, branchIds: string[], query: StockReportQuery) {
    const stockValueExpr = sql<string>`(${medicineBatches.purchaseRate} * ${medicineBatches.quantityAvailable})::text`;
    const orderBy =
      query.sortBy === "medicineName"
        ? [query.sortOrder === "asc" ? asc(medicines.medicineNameNormalized) : desc(medicines.medicineNameNormalized), asc(medicineBatches.expiryDate)]
        : query.sortBy === "quantityAvailable"
          ? [query.sortOrder === "asc" ? asc(medicineBatches.quantityAvailable) : desc(medicineBatches.quantityAvailable), asc(medicineBatches.expiryDate)]
          : query.sortBy === "stockValue"
            ? [query.sortOrder === "asc" ? asc(sql`${medicineBatches.purchaseRate} * ${medicineBatches.quantityAvailable}`) : desc(sql`${medicineBatches.purchaseRate} * ${medicineBatches.quantityAvailable}`), asc(medicineBatches.expiryDate)]
            : [query.sortOrder === "asc" ? asc(medicineBatches.expiryDate) : desc(medicineBatches.expiryDate), asc(medicineBatches.id)];

    return getDbExecutor()
      .select({
        batch: medicineBatches,
        medicine: {
          id: medicines.id,
          medicineName: medicines.medicineName,
          genericName: medicines.genericName,
          barcode: medicines.barcode,
          form: medicines.form,
          unit: medicines.unit,
          reorderLevel: medicines.reorderLevel,
        },
        category: {
          id: medicineCategories.id,
          name: medicineCategories.name,
        },
        manufacturer: {
          id: manufacturers.id,
          name: manufacturers.name,
        },
        stockValue: stockValueExpr,
      })
      .from(medicineBatches)
      .innerJoin(medicines, eq(medicineBatches.medicineId, medicines.id))
      .innerJoin(medicineCategories, eq(medicines.categoryId, medicineCategories.id))
      .innerJoin(manufacturers, eq(medicines.manufacturerId, manufacturers.id))
      .where(buildStockFilters(shopId, branchIds, query))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countStockRows(shopId: string, branchIds: string[], query: StockReportQuery) {
    const [result] = await getDbExecutor()
      .select({ total: sql<number>`count(${medicineBatches.id})` })
      .from(medicineBatches)
      .innerJoin(medicines, eq(medicineBatches.medicineId, medicines.id))
      .where(buildStockFilters(shopId, branchIds, query));

    return result?.total ?? 0;
  }

  async getLowStockSummary(
    shopId: string,
    branchIds: string[],
    query: LowStockReportQuery,
    defaultThreshold: number,
  ) {
    const reorderLevelExpr = resolvedReorderLevelExpr(defaultThreshold);
    const reorderLevelSelectExpr = reorderLevelExpr.as("reorder_level");
    const grouped = getDbExecutor()
      .select({
        medicineId: medicines.id,
        reorderLevel: reorderLevelSelectExpr,
        availableQuantity: availableQuantityExpr.as("available_quantity"),
      })
      .from(medicines)
      .leftJoin(
        medicineBatches,
        and(
          eq(medicineBatches.shopId, shopId),
          buildBranchScopeFilter(medicineBatches.branchId, branchIds),
          eq(medicineBatches.medicineId, medicines.id),
        ),
      )
      .where(buildLowStockFilters(shopId, branchIds, query))
      .groupBy(medicines.id, medicines.reorderLevel)
      .having(buildLowStockHavingExpr(reorderLevelExpr))
      .as("low_stock_summary");

    const [result] = await getDbExecutor()
      .select({
        totalMedicines: sql<number>`count(*)`,
        totalShortage:
          sql<number>`coalesce(sum(greatest(${sql.raw("low_stock_summary.reorder_level")} - ${sql.raw("low_stock_summary.available_quantity")}, 0)), 0)`,
      })
      .from(grouped);

    return result;
  }

  async listLowStockRows(
    shopId: string,
    branchIds: string[],
    query: LowStockReportQuery,
    defaultThreshold: number,
  ) {
    const reorderLevelExpr = resolvedReorderLevelExpr(defaultThreshold);
    const shortageExpr = sql<number>`greatest(${reorderLevelExpr} - ${availableQuantityExpr}, 0)`;
    const orderBy =
      query.sortBy === "medicineName"
        ? [query.sortOrder === "asc" ? asc(medicines.medicineNameNormalized) : desc(medicines.medicineNameNormalized), asc(medicines.id)]
        : query.sortBy === "availableQuantity"
          ? [query.sortOrder === "asc" ? asc(availableQuantityExpr) : desc(availableQuantityExpr), asc(medicines.id)]
          : query.sortBy === "reorderLevel"
            ? [query.sortOrder === "asc" ? asc(reorderLevelExpr) : desc(reorderLevelExpr), asc(medicines.id)]
            : [query.sortOrder === "asc" ? asc(shortageExpr) : desc(shortageExpr), asc(medicines.id)];

    return getDbExecutor()
      .select({
        medicine: {
          id: medicines.id,
          medicineName: medicines.medicineName,
          genericName: medicines.genericName,
          barcode: medicines.barcode,
          form: medicines.form,
          unit: medicines.unit,
        },
        category: {
          id: medicineCategories.id,
          name: medicineCategories.name,
        },
        manufacturer: {
          id: manufacturers.id,
          name: manufacturers.name,
        },
        availableQuantity: availableQuantityExpr,
        reorderLevel: reorderLevelExpr,
        shortage: shortageExpr,
      })
      .from(medicines)
      .innerJoin(medicineCategories, eq(medicines.categoryId, medicineCategories.id))
      .innerJoin(manufacturers, eq(medicines.manufacturerId, manufacturers.id))
      .leftJoin(
        medicineBatches,
        and(
          eq(medicineBatches.shopId, shopId),
          buildBranchScopeFilter(medicineBatches.branchId, branchIds),
          eq(medicineBatches.medicineId, medicines.id),
        ),
      )
      .where(buildLowStockFilters(shopId, branchIds, query))
      .groupBy(medicines.id, medicineCategories.id, manufacturers.id)
      .having(buildLowStockHavingExpr(reorderLevelExpr))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countLowStockRows(
    shopId: string,
    branchIds: string[],
    query: LowStockReportQuery,
    defaultThreshold: number,
  ) {
    const reorderLevelExpr = resolvedReorderLevelExpr(defaultThreshold);
    const grouped = getDbExecutor()
      .select({ medicineId: medicines.id })
      .from(medicines)
      .leftJoin(
        medicineBatches,
        and(
          eq(medicineBatches.shopId, shopId),
          buildBranchScopeFilter(medicineBatches.branchId, branchIds),
          eq(medicineBatches.medicineId, medicines.id),
        ),
      )
      .where(buildLowStockFilters(shopId, branchIds, query))
      .groupBy(medicines.id, medicines.reorderLevel)
      .having(buildLowStockHavingExpr(reorderLevelExpr))
      .as("low_stock_rows");

    const [result] = await getDbExecutor()
      .select({ total: sql<number>`count(*)` })
      .from(grouped);

    return result?.total ?? 0;
  }

  async getExpirySummary(shopId: string, branchIds: string[]) {
    const [result] = await getDbExecutor()
      .select({
        expiredCount: sql<number>`coalesce(sum(case when ${medicineBatches.quantityAvailable} > 0 and ${medicineBatches.expiryDate} < now() then 1 else 0 end), 0)`,
        next30Count: sql<number>`coalesce(sum(case when ${medicineBatches.quantityAvailable} > 0 and ${medicineBatches.expiryDate} >= now() and ${medicineBatches.expiryDate} <= now() + interval '30 day' then 1 else 0 end), 0)`,
        next60Count: sql<number>`coalesce(sum(case when ${medicineBatches.quantityAvailable} > 0 and ${medicineBatches.expiryDate} >= now() and ${medicineBatches.expiryDate} <= now() + interval '60 day' then 1 else 0 end), 0)`,
        next90Count: sql<number>`coalesce(sum(case when ${medicineBatches.quantityAvailable} > 0 and ${medicineBatches.expiryDate} >= now() and ${medicineBatches.expiryDate} <= now() + interval '90 day' then 1 else 0 end), 0)`,
      })
      .from(medicineBatches)
      .where(and(eq(medicineBatches.shopId, shopId), buildBranchScopeFilter(medicineBatches.branchId, branchIds)));

    return result;
  }

  async listExpiryRows(shopId: string, branchIds: string[], query: ExpiryReportQuery) {
    const orderBy =
      query.sortBy === "medicineName"
        ? [asc(medicines.medicineNameNormalized), asc(medicineBatches.expiryDate)]
        : [
            query.sortOrder === "asc"
              ? asc(medicineBatches.expiryDate)
              : desc(medicineBatches.expiryDate),
            asc(medicineBatches.id),
          ];

    return getDbExecutor()
      .select({
        batch: medicineBatches,
        medicine: {
          id: medicines.id,
          medicineName: medicines.medicineName,
          genericName: medicines.genericName,
          barcode: medicines.barcode,
          reorderLevel: medicines.reorderLevel,
        },
      })
      .from(medicineBatches)
      .innerJoin(medicines, eq(medicineBatches.medicineId, medicines.id))
      .where(buildExpiryFilters(shopId, branchIds, query))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countExpiryRows(shopId: string, branchIds: string[], query: ExpiryReportQuery) {
    const [result] = await getDbExecutor()
      .select({ total: sql<number>`count(${medicineBatches.id})` })
      .from(medicineBatches)
      .innerJoin(medicines, eq(medicineBatches.medicineId, medicines.id))
      .where(buildExpiryFilters(shopId, branchIds, query));

    return result?.total ?? 0;
  }

  async getSupplierSummary(
    shopId: string,
    branchIds: string[],
    query: SupplierReportQuery,
  ) {
    const [result] = await getDbExecutor()
      .select({
        supplierCount: sql<number>`count(distinct ${purchases.supplierId})`,
        totalPurchase: sql<string>`coalesce(sum(${purchases.grandTotal}), 0)::text`,
        totalPaid: sql<string>`coalesce(sum(${purchases.paidAmount}), 0)::text`,
        totalDue: sql<string>`coalesce(sum(${purchases.dueAmount}), 0)::text`,
      })
      .from(purchases)
      .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
      .where(buildSupplierFilters(shopId, branchIds, query));

    return result;
  }

  async listSupplierRows(
    shopId: string,
    branchIds: string[],
    query: SupplierReportQuery,
  ) {
    const totalPurchaseExpr = sql<string>`coalesce(sum(${purchases.grandTotal}), 0)::text`;
    const totalPaidExpr = sql<string>`coalesce(sum(${purchases.paidAmount}), 0)::text`;
    const totalDueExpr = sql<string>`coalesce(sum(${purchases.dueAmount}), 0)::text`;
    const purchaseCountExpr = sql<number>`count(${purchases.id})`;

    const orderBy =
      query.sortBy === "supplierName"
        ? [query.sortOrder === "asc" ? asc(suppliers.supplierNameNormalized) : desc(suppliers.supplierNameNormalized), asc(suppliers.id)]
        : query.sortBy === "totalDue"
          ? [query.sortOrder === "asc" ? asc(sql`sum(${purchases.dueAmount})`) : desc(sql`sum(${purchases.dueAmount})`), asc(suppliers.id)]
          : query.sortBy === "purchaseCount"
            ? [query.sortOrder === "asc" ? asc(sql`count(${purchases.id})`) : desc(sql`count(${purchases.id})`), asc(suppliers.id)]
            : [query.sortOrder === "asc" ? asc(sql`sum(${purchases.grandTotal})`) : desc(sql`sum(${purchases.grandTotal})`), asc(suppliers.id)];

    return getDbExecutor()
      .select({
        supplier: {
          id: suppliers.id,
          supplierName: suppliers.supplierName,
          companyName: suppliers.companyName,
          mobileNumber: suppliers.mobileNumber,
          status: suppliers.status,
        },
        purchaseCount: purchaseCountExpr,
        totalPurchase: totalPurchaseExpr,
        totalPaid: totalPaidExpr,
        totalDue: totalDueExpr,
      })
      .from(purchases)
      .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
      .where(buildSupplierFilters(shopId, branchIds, query))
      .groupBy(suppliers.id)
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countSupplierRows(
    shopId: string,
    branchIds: string[],
    query: SupplierReportQuery,
  ) {
    const grouped = getDbExecutor()
      .select({ supplierId: suppliers.id })
      .from(purchases)
      .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
      .where(buildSupplierFilters(shopId, branchIds, query))
      .groupBy(suppliers.id)
      .as("supplier_rows");

    const [result] = await getDbExecutor()
      .select({ total: sql<number>`count(*)` })
      .from(grouped);

    return result?.total ?? 0;
  }

  async getTodaySalesSummary(
    shopId: string,
    branchIds: string[],
    accessScope: ReportAccessScope,
  ) {
    return this.getSalesSummary(
      shopId,
      branchIds,
      {
        search: undefined,
        paymentMethod: undefined,
        dateFrom: todayStart(),
        dateTo: new Date(),
      },
      accessScope,
    );
  }

  async getMonthlySalesSummary(
    shopId: string,
    branchIds: string[],
    accessScope: ReportAccessScope,
  ) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    return this.getSalesSummary(
      shopId,
      branchIds,
      {
        search: undefined,
        paymentMethod: undefined,
        dateFrom: monthStart,
        dateTo: new Date(),
      },
      accessScope,
    );
  }

  async getUsageSummary(
    shopId: string,
    branchIds: string[],
    query: Pick<
      UsageReportQuery,
      "search" | "categoryId" | "manufacturerId" | "dateFrom" | "dateTo"
    >,
    accessScope: ReportAccessScope,
  ) {
    const [result] = await getDbExecutor()
      .select({
        totalUnitsSold: sql<number>`coalesce(sum(${saleItems.quantity}), 0)`,
        uniqueMedicines: sql<number>`count(distinct ${saleItems.medicineId})`,
        revenue: sql<string>`coalesce(sum(${saleItems.lineTotal}), 0)::text`,
        cost: sql<string>`coalesce(sum(${medicineBatches.purchaseRate} * ${saleItems.quantity}), 0)::text`,
        profit: sql<string>`coalesce(sum(${saleItems.lineTotal} - (${medicineBatches.purchaseRate} * ${saleItems.quantity})), 0)::text`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(medicines, eq(saleItems.medicineId, medicines.id))
      .innerJoin(medicineBatches, eq(saleItems.batchId, medicineBatches.id))
      .where(buildUsageFilters(shopId, branchIds, query, accessScope));

    return result;
  }

  async getUsageTrend(
    shopId: string,
    branchIds: string[],
    query: Pick<
      UsageReportQuery,
      | "search"
      | "categoryId"
      | "manufacturerId"
      | "dateFrom"
      | "dateTo"
      | "groupBy"
    >,
    accessScope: ReportAccessScope,
  ) {
    const bucket = query.groupBy === "month" ? "month" : "day";
    const periodExpr = sql<Date>`date_trunc(${sql.raw(`'${bucket}'`)}, ${sales.completedAt})`;

    return getDbExecutor()
      .select({
        periodStart: periodExpr,
        totalUnitsSold: sql<number>`coalesce(sum(${saleItems.quantity}), 0)`,
        revenue: sql<string>`coalesce(sum(${saleItems.lineTotal}), 0)::text`,
        cost: sql<string>`coalesce(sum(${medicineBatches.purchaseRate} * ${saleItems.quantity}), 0)::text`,
        profit: sql<string>`coalesce(sum(${saleItems.lineTotal} - (${medicineBatches.purchaseRate} * ${saleItems.quantity})), 0)::text`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(medicines, eq(saleItems.medicineId, medicines.id))
      .innerJoin(medicineBatches, eq(saleItems.batchId, medicineBatches.id))
      .where(buildUsageFilters(shopId, branchIds, query, accessScope))
      .groupBy(periodExpr)
      .orderBy(asc(periodExpr));
  }

  async listUsageRows(
    shopId: string,
    branchIds: string[],
    query: UsageReportQuery,
    accessScope: ReportAccessScope,
  ) {
    const quantitySoldExpr = sql<number>`coalesce(sum(${saleItems.quantity}), 0)`;
    const revenueExpr = sql<string>`coalesce(sum(${saleItems.lineTotal}), 0)::text`;
    const costExpr = sql<string>`coalesce(sum(${medicineBatches.purchaseRate} * ${saleItems.quantity}), 0)::text`;
    const profitExpr = sql<string>`coalesce(sum(${saleItems.lineTotal} - (${medicineBatches.purchaseRate} * ${saleItems.quantity})), 0)::text`;
    const lastSoldAtExpr = sql<Date | null>`max(${sales.completedAt})`;

    const orderBy =
      query.sortBy === "medicineName"
        ? [
            query.sortOrder === "asc"
              ? asc(medicines.medicineNameNormalized)
              : desc(medicines.medicineNameNormalized),
            asc(medicines.id),
          ]
        : query.sortBy === "revenue"
          ? [
              query.sortOrder === "asc"
                ? asc(sql`sum(${saleItems.lineTotal})`)
                : desc(sql`sum(${saleItems.lineTotal})`),
              asc(medicines.id),
            ]
          : query.sortBy === "profit"
            ? [
                query.sortOrder === "asc"
                  ? asc(
                      sql`sum(${saleItems.lineTotal} - (${medicineBatches.purchaseRate} * ${saleItems.quantity}))`,
                    )
                  : desc(
                      sql`sum(${saleItems.lineTotal} - (${medicineBatches.purchaseRate} * ${saleItems.quantity}))`,
                    ),
                asc(medicines.id),
              ]
            : query.sortBy === "lastSoldAt"
              ? [
                  query.sortOrder === "asc"
                    ? asc(sql`max(${sales.completedAt})`)
                    : desc(sql`max(${sales.completedAt})`),
                  asc(medicines.id),
                ]
              : [
                  query.sortOrder === "asc"
                    ? asc(sql`sum(${saleItems.quantity})`)
                    : desc(sql`sum(${saleItems.quantity})`),
                  asc(medicines.id),
                ];

    return getDbExecutor()
      .select({
        medicine: {
          id: medicines.id,
          medicineName: medicines.medicineName,
          genericName: medicines.genericName,
          barcode: medicines.barcode,
          form: medicines.form,
          unit: medicines.unit,
        },
        category: {
          id: medicineCategories.id,
          name: medicineCategories.name,
        },
        manufacturer: {
          id: manufacturers.id,
          name: manufacturers.name,
        },
        quantitySold: quantitySoldExpr,
        revenue: revenueExpr,
        cost: costExpr,
        profit: profitExpr,
        lastSoldAt: lastSoldAtExpr,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(medicines, eq(saleItems.medicineId, medicines.id))
      .innerJoin(medicineBatches, eq(saleItems.batchId, medicineBatches.id))
      .innerJoin(medicineCategories, eq(medicines.categoryId, medicineCategories.id))
      .innerJoin(manufacturers, eq(medicines.manufacturerId, manufacturers.id))
      .where(buildUsageFilters(shopId, branchIds, query, accessScope))
      .groupBy(medicines.id, medicineCategories.id, manufacturers.id)
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countUsageRows(
    shopId: string,
    branchIds: string[],
    query: UsageReportQuery,
    accessScope: ReportAccessScope,
  ) {
    const grouped = getDbExecutor()
      .select({ medicineId: medicines.id })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(medicines, eq(saleItems.medicineId, medicines.id))
      .innerJoin(medicineBatches, eq(saleItems.batchId, medicineBatches.id))
      .where(buildUsageFilters(shopId, branchIds, query, accessScope))
      .groupBy(medicines.id)
      .as("usage_rows");

    const [result] = await getDbExecutor()
      .select({ total: sql<number>`count(*)` })
      .from(grouped);

    return result?.total ?? 0;
  }
}
