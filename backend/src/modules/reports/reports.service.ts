import { AdminSettingsService } from "../admin-settings/admin-settings.service";
import { BranchesService } from "../branches/branches.service";
import { InventoryRepository } from "../inventory/inventory.repository";
import { ReportsRepository } from "./reports.repository";
import {
  buildExcelReport,
  buildPdfReport,
} from "./reports.export";
import type {
  DashboardSummaryQuery,
  ExpiryReportQuery,
  LowStockReportQuery,
  ProfitReportQuery,
  SalesReportQuery,
  StockReportQuery,
  SupplierReportQuery,
  UsageReportQuery,
} from "./reports.validation";

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

const normalizeSearch = (value?: string) => value?.trim().toLowerCase() || undefined;

const normalizeRange = <T>(query: T, defaultToCurrentMonth = false): T => {
  const current = query as T & {
    dateFrom?: Date;
    dateTo?: Date;
  };
  let dateFrom = current.dateFrom;
  let dateTo = current.dateTo;

  if (!dateFrom && !dateTo && defaultToCurrentMonth) {
    dateFrom = new Date();
    dateFrom.setDate(1);
    dateFrom.setHours(0, 0, 0, 0);
    dateTo = new Date();
  }

  if (dateFrom) {
    dateFrom = new Date(dateFrom);
    dateFrom.setHours(0, 0, 0, 0);
  }

  if (dateTo) {
    dateTo = new Date(dateTo);
    dateTo.setHours(23, 59, 59, 999);
  }

  return {
    ...(query as object),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  } as T;
};

const formatDateRangeLabel = (dateFrom?: Date, dateTo?: Date) => {
  const formatter = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  });

  if (dateFrom && dateTo) {
    return `${formatter.format(dateFrom)} - ${formatter.format(dateTo)}`;
  }

  if (dateFrom) {
    return `From ${formatter.format(dateFrom)}`;
  }

  if (dateTo) {
    return `Until ${formatter.format(dateTo)}`;
  }

  return "All available records";
};

const toMoneyNumber = (value?: string | number | null) => Number(value ?? 0);
const toPercentString = (numerator: number, denominator: number) =>
  denominator > 0 ? ((numerator / denominator) * 100).toFixed(2) : "0.00";

type SequentialTasks<T extends readonly unknown[]> = {
  [K in keyof T]: () => Promise<T[K]>;
};

const runReportReadsSequentially = async <T extends readonly unknown[]>(
  tasks: SequentialTasks<T>,
): Promise<T> => {
  const results: unknown[] = [];

  for (const task of tasks) {
    // Report endpoints aggregate multiple DB reads; serializing them avoids
    // overlapping queries on the same pg client.
    results.push(await task());
  }

  return results as unknown as T;
};

export class ReportsService {
  constructor(
    private readonly reportsRepository = new ReportsRepository(),
    private readonly inventoryRepository = new InventoryRepository(),
    private readonly adminSettingsService = new AdminSettingsService(),
    private readonly branchesService = new BranchesService(),
  ) {}

  async getDashboardSummary(
    shopId: string,
    branchIds: string[],
    accessScope: { userId: string; role: "admin" | "staff" | "accountant" },
    _query: DashboardSummaryQuery,
  ) {
    await Promise.all(
      branchIds.map((branchId) => this.inventoryRepository.syncBatchStatuses(shopId, branchId)),
    );
    const branchThresholds = await this.branchesService.listResolvedBranchLowStockThresholds(
      shopId,
      branchIds,
    );

    const [todaySales, monthlySales, lowStockCount, expirySummary, monthlyProfit] =
      await runReportReadsSequentially([
        () => this.reportsRepository.getTodaySalesSummary(shopId, branchIds, accessScope),
        () => this.reportsRepository.getMonthlySalesSummary(shopId, branchIds, accessScope),
        async () => {
          const counts = await runReportReadsSequentially(
            branchIds.map(
              (branchId) => () =>
                this.inventoryRepository.countInventorySummary(
                  shopId,
                  branchId,
                  {
                    page: 1,
                    pageSize: 1,
                    sortBy: "availableQuantity",
                    sortOrder: "asc",
                    search: undefined,
                    lowStockOnly: true,
                  },
                  branchThresholds.get(branchId) ?? 10,
                ),
            ) as SequentialTasks<readonly number[]>,
          );

          return counts.reduce((sum, count) => sum + count, 0);
        },
        () => this.reportsRepository.getExpirySummary(shopId, branchIds),
        () =>
          this.reportsRepository.getProfitSummary(
            shopId,
            branchIds,
            normalizeRange<Pick<ProfitReportQuery, "search" | "dateFrom" | "dateTo">>(
              {
                search: undefined,
              },
              true,
            ),
            accessScope,
          ),
      ]);

    return {
      todaySales: {
        totalSales: todaySales?.totalSales ?? "0.00",
        totalBills: todaySales?.totalBills ?? 0,
      },
      monthlySales: {
        totalSales: monthlySales?.totalSales ?? "0.00",
        totalBills: monthlySales?.totalBills ?? 0,
      },
      totalProfit: monthlyProfit?.profit ?? "0.00",
      lowStockCount,
      expiryCount:
        Number(expirySummary?.expiredCount ?? 0) +
        Number(expirySummary?.next30Count ?? 0),
      expiryBreakdown: {
        expired: Number(expirySummary?.expiredCount ?? 0),
        next30Days: Number(expirySummary?.next30Count ?? 0),
        next60Days: Number(expirySummary?.next60Count ?? 0),
        next90Days: Number(expirySummary?.next90Count ?? 0),
      },
    };
  }

  async getSalesReport(
    shopId: string,
    branchIds: string[],
    accessScope: { userId: string; role: "admin" | "staff" | "accountant" },
    query: SalesReportQuery,
  ) {
    const normalizedQuery = normalizeRange<SalesReportQuery>(
      { ...query, search: normalizeSearch(query.search) },
      true,
    );

    const [summary, paymentBreakdown, trend, rows, total] =
      await runReportReadsSequentially([
        () =>
          this.reportsRepository.getSalesSummary(
            shopId,
            branchIds,
            normalizedQuery,
            accessScope,
          ),
        () =>
          this.reportsRepository.getSalesPaymentBreakdown(
            shopId,
            branchIds,
            normalizedQuery,
            accessScope,
          ),
        () =>
          this.reportsRepository.getSalesTrend(
            shopId,
            branchIds,
            normalizedQuery,
            accessScope,
          ),
        () =>
          this.reportsRepository.listSalesReportRows(
            shopId,
            branchIds,
            normalizedQuery,
            accessScope,
          ),
        () =>
          this.reportsRepository.countSalesReportRows(
            shopId,
            branchIds,
            normalizedQuery,
            accessScope,
          ),
      ]);

    return {
      filters: {
        dateRangeLabel: formatDateRangeLabel(
          normalizedQuery.dateFrom,
          normalizedQuery.dateTo,
        ),
        groupBy: normalizedQuery.groupBy,
      },
      summary: {
        totalSales: summary?.totalSales ?? "0.00",
        totalBills: summary?.totalBills ?? 0,
        averageBillValue: summary?.averageBillValue ?? "0.00",
        paymentBreakdown: paymentBreakdown.map((item) => ({
          paymentMethod: item.paymentMethod,
          totalSales: item.totalSales,
          totalBills: item.totalBills,
        })),
      },
      trend: trend.map((item) => ({
        periodStart: item.periodStart,
        totalSales: item.totalSales,
        totalBills: item.totalBills,
        averageBillValue: item.averageBillValue,
      })),
      rows: buildPaginatedResponse(
        rows.map((record) => ({
          id: record.sale.id,
          billNumber: record.sale.billNumber,
          customerName: record.sale.customerName ?? "Walk-in",
          paymentMethod: record.sale.paymentMethod,
          paymentStatus: record.sale.paymentStatus,
          grandTotal: record.sale.grandTotal,
          paidAmount: record.sale.paidAmount,
          dueAmount: record.sale.dueAmount,
          completedAt: record.sale.completedAt,
          createdBy: record.createdBy,
        })),
        total,
        normalizedQuery.page,
        normalizedQuery.pageSize,
      ),
    };
  }

  async getProfitReport(
    shopId: string,
    branchIds: string[],
    accessScope: { userId: string; role: "admin" | "staff" | "accountant" },
    query: ProfitReportQuery,
  ) {
    const normalizedQuery = normalizeRange<ProfitReportQuery>(
      { ...query, search: normalizeSearch(query.search) },
      true,
    );

    const [summary, trend, rows, total] = await runReportReadsSequentially([
      () =>
        this.reportsRepository.getProfitSummary(
          shopId,
          branchIds,
          normalizedQuery,
          accessScope,
        ),
      () =>
        this.reportsRepository.getProfitTrend(
          shopId,
          branchIds,
          normalizedQuery,
          accessScope,
        ),
      () =>
        this.reportsRepository.listProfitRows(
          shopId,
          branchIds,
          normalizedQuery,
          accessScope,
        ),
      () =>
        this.reportsRepository.countProfitRows(
          shopId,
          branchIds,
          normalizedQuery,
          accessScope,
        ),
    ]);

    const revenue = toMoneyNumber(summary?.revenue);
    const cost = toMoneyNumber(summary?.cost);
    const profit = toMoneyNumber(summary?.profit);

    return {
      filters: {
        dateRangeLabel: formatDateRangeLabel(
          normalizedQuery.dateFrom,
          normalizedQuery.dateTo,
        ),
        groupBy: normalizedQuery.groupBy,
      },
      summary: {
        revenue: summary?.revenue ?? "0.00",
        cost: summary?.cost ?? "0.00",
        profit: summary?.profit ?? "0.00",
        profitPercent: toPercentString(profit, revenue),
      },
      trend: trend.map((item) => {
        const periodRevenue = toMoneyNumber(item.revenue);
        const periodProfit = toMoneyNumber(item.profit);

        return {
          periodStart: item.periodStart,
          revenue: item.revenue,
          cost: item.cost,
          profit: item.profit,
          profitPercent: toPercentString(periodProfit, periodRevenue),
        };
      }),
      rows: buildPaginatedResponse(
        rows.map((record) => {
          const rowRevenue = toMoneyNumber(record.revenue);
          const rowProfit = toMoneyNumber(record.profit);

          return {
            saleId: record.saleId,
            billNumber: record.billNumber,
            customerName: record.customerName ?? "Walk-in",
            completedAt: record.completedAt,
            createdBy: record.createdBy,
            revenue: record.revenue,
            cost: record.cost,
            profit: record.profit,
            profitPercent: toPercentString(rowProfit, rowRevenue),
          };
        }),
        total,
        normalizedQuery.page,
        normalizedQuery.pageSize,
      ),
    };
  }

  async getStockReport(shopId: string, branchIds: string[], query: StockReportQuery) {
    await Promise.all(
      branchIds.map((branchId) => this.inventoryRepository.syncBatchStatuses(shopId, branchId)),
    );

    const normalizedQuery = {
      ...query,
      search: normalizeSearch(query.search),
    };
    const branchThresholds = await this.branchesService.listResolvedBranchLowStockThresholds(
      shopId,
      branchIds,
    );

    const [summary, lowStockCount, rows, total] = await runReportReadsSequentially([
      () => this.reportsRepository.getStockSummary(shopId, branchIds, normalizedQuery),
      async () => {
        const counts = await runReportReadsSequentially(
          branchIds.map(
            (branchId) => () =>
              this.inventoryRepository.countInventorySummary(
                shopId,
                branchId,
                {
                  page: 1,
                  pageSize: 1,
                  sortBy: "availableQuantity",
                  sortOrder: "asc",
                  lowStockOnly: true,
                  search: normalizedQuery.search,
                  ...(normalizedQuery.categoryId
                    ? { categoryId: normalizedQuery.categoryId }
                    : {}),
                  ...(normalizedQuery.manufacturerId
                    ? { manufacturerId: normalizedQuery.manufacturerId }
                    : {}),
                  ...(normalizedQuery.search ? { search: normalizedQuery.search } : {}),
                },
                branchThresholds.get(branchId) ?? 10,
              ),
          ) as SequentialTasks<readonly number[]>,
        );

        return counts.reduce((sum, count) => sum + count, 0);
      },
      () => this.reportsRepository.listStockRows(shopId, branchIds, normalizedQuery),
      () => this.reportsRepository.countStockRows(shopId, branchIds, normalizedQuery),
    ]);

    return {
      summary: {
        totalMedicines: summary?.totalMedicines ?? 0,
        totalBatches: summary?.totalBatches ?? 0,
        totalUnits: summary?.totalUnits ?? 0,
        stockValuation: summary?.stockValuation ?? "0.00",
        lowStockCount,
      },
      rows: buildPaginatedResponse(
        rows.map((record) => ({
          batch: {
            id: record.batch.id,
            batchNumber: record.batch.batchNumber,
            expiryDate: record.batch.expiryDate,
            purchaseRate: record.batch.purchaseRate,
            saleRate: record.batch.saleRate,
            quantityAvailable: record.batch.quantityAvailable,
            status: record.batch.status,
          },
          medicine: record.medicine,
          category: record.category,
          manufacturer: record.manufacturer,
          stockValue: record.stockValue,
        })),
        total,
        normalizedQuery.page,
        normalizedQuery.pageSize,
      ),
    };
  }

  async getLowStockReport(shopId: string, branchIds: string[], query: LowStockReportQuery) {
    await Promise.all(
      branchIds.map((branchId) => this.inventoryRepository.syncBatchStatuses(shopId, branchId)),
    );

    const normalizedQuery = {
      ...query,
      search: normalizeSearch(query.search),
    };
    const defaultThreshold =
      branchIds.length === 1
        ? (
            await this.branchesService.getResolvedBranchSettings(
              shopId,
              branchIds[0]!,
            )
          ).defaultLowStockThreshold
        : (await this.adminSettingsService.getResolvedShopSettings(shopId))
            .defaultLowStockThreshold;

    const [summary, rows, total] = await runReportReadsSequentially([
      () =>
        this.reportsRepository.getLowStockSummary(
          shopId,
          branchIds,
          normalizedQuery,
          defaultThreshold,
        ),
      () =>
        this.reportsRepository.listLowStockRows(
          shopId,
          branchIds,
          normalizedQuery,
          defaultThreshold,
        ),
      () =>
        this.reportsRepository.countLowStockRows(
          shopId,
          branchIds,
          normalizedQuery,
          defaultThreshold,
        ),
    ]);

    return {
      summary: {
        totalMedicines: summary?.totalMedicines ?? 0,
        totalShortage: summary?.totalShortage ?? 0,
      },
      rows: buildPaginatedResponse(
        rows.map((record) => ({
          medicine: {
            ...record.medicine,
            reorderLevel: Number(record.reorderLevel ?? 0),
          },
          category: record.category,
          manufacturer: record.manufacturer,
          availableQuantity: Number(record.availableQuantity ?? 0),
          reorderLevel: Number(record.reorderLevel ?? 0),
          shortage: Number(record.shortage ?? 0),
        })),
        total,
        normalizedQuery.page,
        normalizedQuery.pageSize,
      ),
    };
  }

  async getExpiryReport(shopId: string, branchIds: string[], query: ExpiryReportQuery) {
    await Promise.all(
      branchIds.map((branchId) => this.inventoryRepository.syncBatchStatuses(shopId, branchId)),
    );

    const normalizedQuery = {
      ...query,
      search: normalizeSearch(query.search),
    };

    const [summary, rows, total] = await runReportReadsSequentially([
      () => this.reportsRepository.getExpirySummary(shopId, branchIds),
      () => this.reportsRepository.listExpiryRows(shopId, branchIds, normalizedQuery),
      () => this.reportsRepository.countExpiryRows(shopId, branchIds, normalizedQuery),
    ]);

    return {
      summary: {
        expiredCount: Number(summary?.expiredCount ?? 0),
        next30Count: Number(summary?.next30Count ?? 0),
        next60Count: Number(summary?.next60Count ?? 0),
        next90Count: Number(summary?.next90Count ?? 0),
      },
      rows: buildPaginatedResponse(
        rows.map((record) => ({
          ...record.batch,
          medicine: record.medicine,
          expiryStatus:
            record.batch.expiryDate < new Date()
              ? "expired"
              : normalizedQuery.expiryWindow === "30"
                ? "next_30_days"
                : normalizedQuery.expiryWindow === "60"
                  ? "next_60_days"
                  : normalizedQuery.expiryWindow === "90"
                    ? "next_90_days"
                    : "safe",
        })),
        total,
        normalizedQuery.page,
        normalizedQuery.pageSize,
      ),
    };
  }

  async getSupplierReport(shopId: string, branchIds: string[], query: SupplierReportQuery) {
    const normalizedQuery = normalizeRange<SupplierReportQuery>(
      { ...query, search: normalizeSearch(query.search) },
      true,
    );

    const [summary, rows, total] = await runReportReadsSequentially([
      () => this.reportsRepository.getSupplierSummary(shopId, branchIds, normalizedQuery),
      () => this.reportsRepository.listSupplierRows(shopId, branchIds, normalizedQuery),
      () => this.reportsRepository.countSupplierRows(shopId, branchIds, normalizedQuery),
    ]);

    return {
      filters: {
        dateRangeLabel: formatDateRangeLabel(
          normalizedQuery.dateFrom,
          normalizedQuery.dateTo,
        ),
      },
      summary: {
        supplierCount: summary?.supplierCount ?? 0,
        totalPurchase: summary?.totalPurchase ?? "0.00",
        totalPaid: summary?.totalPaid ?? "0.00",
        totalDue: summary?.totalDue ?? "0.00",
      },
      rows: buildPaginatedResponse(
        rows.map((record) => ({
          supplier: record.supplier,
          purchaseCount: record.purchaseCount,
          totalPurchase: record.totalPurchase,
          totalPaid: record.totalPaid,
          totalDue: record.totalDue,
        })),
        total,
        normalizedQuery.page,
        normalizedQuery.pageSize,
      ),
    };
  }

  async getUsageReport(
    shopId: string,
    branchIds: string[],
    accessScope: { userId: string; role: "admin" | "staff" | "accountant" },
    query: UsageReportQuery,
  ) {
    const normalizedQuery = normalizeRange<UsageReportQuery>(
      { ...query, search: normalizeSearch(query.search) },
      true,
    );

    const [summary, trend, rows, total] = await runReportReadsSequentially([
      () =>
        this.reportsRepository.getUsageSummary(
          shopId,
          branchIds,
          normalizedQuery,
          accessScope,
        ),
      () =>
        this.reportsRepository.getUsageTrend(
          shopId,
          branchIds,
          normalizedQuery,
          accessScope,
        ),
      () =>
        this.reportsRepository.listUsageRows(
          shopId,
          branchIds,
          normalizedQuery,
          accessScope,
        ),
      () =>
        this.reportsRepository.countUsageRows(
          shopId,
          branchIds,
          normalizedQuery,
          accessScope,
        ),
    ]);

    const revenue = toMoneyNumber(summary?.revenue);
    const profit = toMoneyNumber(summary?.profit);

    return {
      filters: {
        dateRangeLabel: formatDateRangeLabel(
          normalizedQuery.dateFrom,
          normalizedQuery.dateTo,
        ),
        groupBy: normalizedQuery.groupBy,
      },
      summary: {
        totalUnitsSold: summary?.totalUnitsSold ?? 0,
        uniqueMedicines: summary?.uniqueMedicines ?? 0,
        revenue: summary?.revenue ?? "0.00",
        cost: summary?.cost ?? "0.00",
        profit: summary?.profit ?? "0.00",
        profitPercent: toPercentString(profit, revenue),
      },
      trend: trend.map((item) => {
        const periodRevenue = toMoneyNumber(item.revenue);
        const periodProfit = toMoneyNumber(item.profit);

        return {
          periodStart: item.periodStart,
          totalUnitsSold: item.totalUnitsSold,
          revenue: item.revenue,
          cost: item.cost,
          profit: item.profit,
          profitPercent: toPercentString(periodProfit, periodRevenue),
        };
      }),
      rows: buildPaginatedResponse(
        rows.map((record) => {
          const rowRevenue = toMoneyNumber(record.revenue);
          const rowProfit = toMoneyNumber(record.profit);

          return {
            medicine: record.medicine,
            category: record.category,
            manufacturer: record.manufacturer,
            quantitySold: Number(record.quantitySold ?? 0),
            revenue: record.revenue,
            cost: record.cost,
            profit: record.profit,
            profitPercent: toPercentString(rowProfit, rowRevenue),
            lastSoldAt: record.lastSoldAt,
          };
        }),
        total,
        normalizedQuery.page,
        normalizedQuery.pageSize,
      ),
    };
  }

  async exportSalesReport(
    shopId: string,
    branchIds: string[],
    shopName: string,
    accessScope: { userId: string; role: "admin" | "staff" | "accountant" },
    query: SalesReportQuery & { format: "xlsx" | "pdf" },
  ) {
    const report = await this.getSalesReport(shopId, branchIds, accessScope, {
      ...query,
      page: 1,
      pageSize: 2000,
    });

    return this.buildReportExport(
      query.format,
      shopName,
      "Sales Report",
      report.filters.dateRangeLabel,
      [
        { label: "Total sales", value: report.summary.totalSales },
        { label: "Total bills", value: String(report.summary.totalBills) },
        { label: "Avg bill", value: report.summary.averageBillValue },
      ],
      [
        { header: "Bill Number", key: "billNumber", width: 20 },
        { header: "Customer", key: "customerName", width: 24 },
        { header: "Payment", key: "paymentMethod", width: 16 },
        { header: "Completed", key: "completedAt", width: 16 },
        { header: "Total", key: "grandTotal", width: 16, align: "right" },
        { header: "Paid", key: "paidAmount", width: 16, align: "right" },
        { header: "Due", key: "dueAmount", width: 16, align: "right" },
      ],
      report.rows.items.map((item) => ({
        billNumber: item.billNumber,
        customerName: item.customerName,
        paymentMethod: item.paymentMethod,
        completedAt: item.completedAt
          ? item.completedAt.toISOString().slice(0, 10)
          : "",
        grandTotal: item.grandTotal,
        paidAmount: item.paidAmount,
        dueAmount: item.dueAmount,
      })),
      "sales-report",
    );
  }

  async exportProfitReport(
    shopId: string,
    branchIds: string[],
    shopName: string,
    accessScope: { userId: string; role: "admin" | "staff" | "accountant" },
    query: ProfitReportQuery & { format: "xlsx" | "pdf" },
  ) {
    const report = await this.getProfitReport(shopId, branchIds, accessScope, {
      ...query,
      page: 1,
      pageSize: 2000,
    });

    return this.buildReportExport(
      query.format,
      shopName,
      "Profit Report",
      report.filters.dateRangeLabel,
      [
        { label: "Revenue", value: report.summary.revenue },
        { label: "Cost", value: report.summary.cost },
        { label: "Profit", value: report.summary.profit },
        { label: "Profit %", value: `${report.summary.profitPercent}%` },
      ],
      [
        { header: "Bill Number", key: "billNumber", width: 18 },
        { header: "Customer", key: "customerName", width: 22 },
        { header: "Completed", key: "completedAt", width: 16 },
        { header: "Revenue", key: "revenue", width: 16, align: "right" },
        { header: "Cost", key: "cost", width: 16, align: "right" },
        { header: "Profit", key: "profit", width: 16, align: "right" },
        { header: "Profit %", key: "profitPercent", width: 14, align: "right" },
      ],
      report.rows.items.map((item) => ({
        billNumber: item.billNumber,
        customerName: item.customerName,
        completedAt: item.completedAt
          ? item.completedAt.toISOString().slice(0, 10)
          : "",
        revenue: item.revenue,
        cost: item.cost,
        profit: item.profit,
        profitPercent: item.profitPercent,
      })),
      "profit-report",
    );
  }

  async exportStockReport(
    shopId: string,
    branchIds: string[],
    shopName: string,
    query: StockReportQuery & { format: "xlsx" | "pdf" },
  ) {
    const report = await this.getStockReport(shopId, branchIds, {
      ...query,
      page: 1,
      pageSize: 2000,
    });

    return this.buildReportExport(
      query.format,
      shopName,
      "Stock Report",
      "Current stock position",
      [
        { label: "Medicines", value: String(report.summary.totalMedicines) },
        { label: "Batches", value: String(report.summary.totalBatches) },
        { label: "Units", value: String(report.summary.totalUnits) },
        { label: "Valuation", value: report.summary.stockValuation },
      ],
      [
        { header: "Medicine", key: "medicineName", width: 24 },
        { header: "Batch", key: "batchNumber", width: 16 },
        { header: "Expiry", key: "expiryDate", width: 16 },
        { header: "Qty", key: "quantityAvailable", width: 12, align: "right" },
        { header: "Purchase Rate", key: "purchaseRate", width: 16, align: "right" },
        { header: "Stock Value", key: "stockValue", width: 16, align: "right" },
      ],
      report.rows.items.map((item) => ({
        medicineName: item.medicine.medicineName,
        batchNumber: item.batch.batchNumber,
        expiryDate: item.batch.expiryDate.toISOString().slice(0, 10),
        quantityAvailable: item.batch.quantityAvailable,
        purchaseRate: item.batch.purchaseRate,
        stockValue: item.stockValue,
      })),
      "stock-report",
    );
  }

  async exportLowStockReport(
    shopId: string,
    branchIds: string[],
    shopName: string,
    query: LowStockReportQuery & { format: "xlsx" | "pdf" },
  ) {
    const report = await this.getLowStockReport(shopId, branchIds, {
      ...query,
      page: 1,
      pageSize: 2000,
    });

    return this.buildReportExport(
      query.format,
      shopName,
      "Low Stock Report",
      "Current shortage against reorder levels",
      [
        { label: "Low stock medicines", value: String(report.summary.totalMedicines) },
        { label: "Total shortage", value: String(report.summary.totalShortage) },
      ],
      [
        { header: "Medicine", key: "medicineName", width: 24 },
        { header: "Category", key: "categoryName", width: 18 },
        { header: "Manufacturer", key: "manufacturerName", width: 18 },
        { header: "Available", key: "availableQuantity", width: 12, align: "right" },
        { header: "Reorder", key: "reorderLevel", width: 12, align: "right" },
        { header: "Shortage", key: "shortage", width: 12, align: "right" },
      ],
      report.rows.items.map((item) => ({
        medicineName: item.medicine.medicineName,
        categoryName: item.category.name,
        manufacturerName: item.manufacturer.name,
        availableQuantity: item.availableQuantity,
        reorderLevel: item.reorderLevel,
        shortage: item.shortage,
      })),
      "low-stock-report",
    );
  }

  async exportExpiryReport(
    shopId: string,
    branchIds: string[],
    shopName: string,
    query: ExpiryReportQuery & { format: "xlsx" | "pdf" },
  ) {
    const report = await this.getExpiryReport(shopId, branchIds, {
      ...query,
      page: 1,
      pageSize: 2000,
    });

    return this.buildReportExport(
      query.format,
      shopName,
      "Expiry Report",
      "Batch expiry status overview",
      [
        { label: "Expired", value: String(report.summary.expiredCount) },
        { label: "Next 30", value: String(report.summary.next30Count) },
        { label: "Next 60", value: String(report.summary.next60Count) },
        { label: "Next 90", value: String(report.summary.next90Count) },
      ],
      [
        { header: "Medicine", key: "medicineName", width: 24 },
        { header: "Batch", key: "batchNumber", width: 16 },
        { header: "Expiry", key: "expiryDate", width: 16 },
        { header: "Status", key: "expiryStatus", width: 14 },
        { header: "Qty", key: "quantityAvailable", width: 12, align: "right" },
      ],
      report.rows.items.map((item) => ({
        medicineName: item.medicine.medicineName,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate.toISOString().slice(0, 10),
        expiryStatus: item.expiryStatus,
        quantityAvailable: item.quantityAvailable,
      })),
      "expiry-report",
    );
  }

  async exportSupplierReport(
    shopId: string,
    branchIds: string[],
    shopName: string,
    query: SupplierReportQuery & { format: "xlsx" | "pdf" },
  ) {
    const report = await this.getSupplierReport(shopId, branchIds, {
      ...query,
      page: 1,
      pageSize: 2000,
    });

    return this.buildReportExport(
      query.format,
      shopName,
      "Supplier Report",
      report.filters.dateRangeLabel,
      [
        { label: "Suppliers", value: String(report.summary.supplierCount) },
        { label: "Total purchase", value: report.summary.totalPurchase },
        { label: "Total paid", value: report.summary.totalPaid },
        { label: "Total due", value: report.summary.totalDue },
      ],
      [
        { header: "Supplier", key: "supplierName", width: 24 },
        { header: "Company", key: "companyName", width: 20 },
        { header: "Purchases", key: "purchaseCount", width: 12, align: "right" },
        { header: "Total Purchase", key: "totalPurchase", width: 16, align: "right" },
        { header: "Paid", key: "totalPaid", width: 16, align: "right" },
        { header: "Due", key: "totalDue", width: 16, align: "right" },
      ],
      report.rows.items.map((item) => ({
        supplierName: item.supplier.supplierName,
        companyName: item.supplier.companyName ?? "",
        purchaseCount: item.purchaseCount,
        totalPurchase: item.totalPurchase,
        totalPaid: item.totalPaid,
        totalDue: item.totalDue,
      })),
      "supplier-report",
    );
  }

  async exportUsageReport(
    shopId: string,
    branchIds: string[],
    shopName: string,
    accessScope: { userId: string; role: "admin" | "staff" | "accountant" },
    query: UsageReportQuery & { format: "xlsx" | "pdf" },
  ) {
    const report = await this.getUsageReport(shopId, branchIds, accessScope, {
      ...query,
      page: 1,
      pageSize: 2000,
    });

    return this.buildReportExport(
      query.format,
      shopName,
      "Medicine Usage Report",
      report.filters.dateRangeLabel,
      [
        { label: "Units sold", value: String(report.summary.totalUnitsSold) },
        { label: "Medicines used", value: String(report.summary.uniqueMedicines) },
        { label: "Revenue", value: report.summary.revenue },
        { label: "Profit", value: report.summary.profit },
      ],
      [
        { header: "Medicine", key: "medicineName", width: 24 },
        { header: "Category", key: "categoryName", width: 18 },
        { header: "Manufacturer", key: "manufacturerName", width: 18 },
        { header: "Qty Sold", key: "quantitySold", width: 12, align: "right" },
        { header: "Revenue", key: "revenue", width: 16, align: "right" },
        { header: "Cost", key: "cost", width: 16, align: "right" },
        { header: "Profit", key: "profit", width: 16, align: "right" },
        { header: "Last Sold", key: "lastSoldAt", width: 16 },
      ],
      report.rows.items.map((item) => ({
        medicineName: item.medicine.medicineName,
        categoryName: item.category.name,
        manufacturerName: item.manufacturer.name,
        quantitySold: item.quantitySold,
        revenue: item.revenue,
        cost: item.cost,
        profit: item.profit,
        lastSoldAt: item.lastSoldAt
          ? item.lastSoldAt.toISOString().slice(0, 10)
          : "",
      })),
      "usage-report",
    );
  }

  private async buildReportExport(
    format: "xlsx" | "pdf",
    shopName: string,
    title: string,
    subtitle: string,
    summary: Array<{ label: string; value: string }>,
    columns: Array<{
      header: string;
      key: string;
      width?: number;
      align?: "left" | "right" | "center";
    }>,
    rows: Array<Record<string, string | number>>,
    fileNamePrefix: string,
  ) {
    const buffer =
      format === "xlsx"
        ? await buildExcelReport({
            shopName,
            title,
            subtitle,
            summary,
            columns,
            rows,
          })
        : await buildPdfReport({
            shopName,
            title,
            subtitle,
            summary,
            columns,
            rows,
          });

    return {
      buffer,
      contentType:
        format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/pdf",
      fileName: `${fileNamePrefix}.${format === "xlsx" ? "xlsx" : "pdf"}`,
    };
  }
}
