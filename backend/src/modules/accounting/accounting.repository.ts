import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  sql,
} from "drizzle-orm";

import {
  customerPaymentAllocations,
  customerPayments,
  customers,
  ledgerEntries,
  purchaseReturns,
  purchases,
  saleReturns,
  sales,
  supplierPaymentAllocations,
  supplierPayments,
  suppliers,
  users,
} from "../../db/schema";
import { getDbExecutor, type DbExecutor } from "../../shared/db/executor";
import { runDbReads } from "../../shared/db/run-db-reads";
import type {
  ListAccountingCustomerPaymentsQuery,
  ListAccountingSupplierPaymentsQuery,
  ListOutstandingCustomersQuery,
  ListOutstandingSuppliersQuery,
} from "./accounting.validation";

const aliasedColumn = (tableAlias: string, columnName: string) =>
  sql.raw(`"${tableAlias}"."${columnName}"`);

const customerReturnAdvanceCredit = () => sql`
  greatest(
    ${saleReturns.totalReturnAmount}
    - case
        when ${saleReturns.refundMethod} is not null
          and ${saleReturns.refundMethod} <> 'adjustment'
          then ${saleReturns.refundAmount}
        else 0.00
      end,
    0.00
  )
`;

const supplierReturnAdvanceCredit = () => sql`
  greatest(
    ${purchaseReturns.totalReturnAmount}
    - case
        when ${purchaseReturns.refundMethod} is not null
          and ${purchaseReturns.refundMethod} <> 'adjustment'
          then ${purchaseReturns.refundAmount}
        else 0.00
      end,
    0.00
  )
`;

const buildCustomerPaymentFilters = (
  shopId: string,
  query: ListAccountingCustomerPaymentsQuery,
) => {
  const filters = [eq(customerPayments.shopId, shopId)];

  if (query.customerId) {
    filters.push(eq(customerPayments.customerId, query.customerId));
  }

  if (query.saleId) {
    filters.push(eq(customerPayments.saleId, query.saleId));
  }

  if (query.paymentMethod) {
    filters.push(eq(customerPayments.paymentMethod, query.paymentMethod));
  }

  if (query.status) {
    filters.push(eq(customerPayments.status, query.status));
  }

  if (query.dateFrom) {
    filters.push(gte(customerPayments.paymentDate, query.dateFrom));
  }

  if (query.dateTo) {
    filters.push(lte(customerPayments.paymentDate, query.dateTo));
  }

  if (query.search) {
    filters.push(
      or(
        like(customers.fullNameNormalized, `%${query.search}%`),
        like(sales.billNumberNormalized, `%${query.search}%`),
        like(customerPayments.referenceNumber, `%${query.search}%`),
      )!,
    );
  }

  return and(...filters);
};

const buildSupplierPaymentFilters = (
  shopId: string,
  query: ListAccountingSupplierPaymentsQuery,
) => {
  const filters = [eq(supplierPayments.shopId, shopId)];

  if (query.supplierId) {
    filters.push(eq(supplierPayments.supplierId, query.supplierId));
  }

  if (query.purchaseId) {
    filters.push(eq(supplierPayments.purchaseId, query.purchaseId));
  }

  if (query.paymentMethod) {
    filters.push(eq(supplierPayments.paymentMethod, query.paymentMethod));
  }

  if (query.status) {
    filters.push(eq(supplierPayments.status, query.status));
  }

  if (query.dateFrom) {
    filters.push(gte(supplierPayments.paymentDate, query.dateFrom));
  }

  if (query.dateTo) {
    filters.push(lte(supplierPayments.paymentDate, query.dateTo));
  }

  if (query.search) {
    filters.push(
      or(
        like(suppliers.supplierNameNormalized, `%${query.search}%`),
        like(purchases.purchaseNumberNormalized, `%${query.search}%`),
        like(supplierPayments.referenceNumber, `%${query.search}%`),
      )!,
    );
  }

  return and(...filters);
};

const customerReturnTotalsBySaleSubquery = (shopId: string, executor?: DbExecutor) =>
  getDbExecutor(executor)
    .select({
      saleId: saleReturns.saleId,
      returnAmount:
        sql<string>`coalesce(sum(${saleReturns.totalReturnAmount}), 0.00)`.as(
          "return_amount",
        ),
    })
    .from(saleReturns)
    .where(
      and(eq(saleReturns.shopId, shopId), eq(saleReturns.status, "completed")),
    )
    .groupBy(saleReturns.saleId)
    .as("customer_return_totals_by_sale");

const customerAllocationTotalsBySaleSubquery = (
  shopId: string,
  executor?: DbExecutor,
) =>
  getDbExecutor(executor)
    .select({
      saleId: customerPaymentAllocations.saleId,
      allocatedAmount:
        sql<string>`coalesce(sum(${customerPaymentAllocations.amount}), 0.00)`.as(
          "allocated_amount",
        ),
    })
    .from(customerPaymentAllocations)
    .innerJoin(
      customerPayments,
      eq(customerPaymentAllocations.customerPaymentId, customerPayments.id),
    )
    .where(
      and(
        eq(customerPaymentAllocations.shopId, shopId),
        eq(customerPayments.status, "completed"),
      ),
    )
    .groupBy(customerPaymentAllocations.saleId)
    .as("customer_allocation_totals_by_sale");

const customerAllocationTotalsByPaymentSubquery = (
  shopId: string,
  executor?: DbExecutor,
) =>
  getDbExecutor(executor)
    .select({
      customerPaymentId: customerPaymentAllocations.customerPaymentId,
      allocatedAmount:
        sql<string>`coalesce(sum(${customerPaymentAllocations.amount}), 0.00)`.as(
          "allocated_amount",
        ),
    })
    .from(customerPaymentAllocations)
    .innerJoin(
      customerPayments,
      eq(customerPaymentAllocations.customerPaymentId, customerPayments.id),
    )
    .where(
      and(
        eq(customerPaymentAllocations.shopId, shopId),
        eq(customerPayments.status, "completed"),
      ),
    )
    .groupBy(customerPaymentAllocations.customerPaymentId)
    .as("customer_allocation_totals_by_payment");

const customerReturnCreditsByCustomerSubquery = (
  shopId: string,
  executor?: DbExecutor,
) =>
  getDbExecutor(executor)
    .select({
      customerId: sales.customerId,
      effectiveReturnCredit:
        sql<string>`coalesce(sum(${customerReturnAdvanceCredit()}), 0.00)`.as(
          "effective_return_credit",
        ),
    })
    .from(saleReturns)
    .innerJoin(sales, eq(saleReturns.saleId, sales.id))
    .where(
      and(
        eq(saleReturns.shopId, shopId),
        eq(saleReturns.status, "completed"),
        sql`${sales.customerId} is not null`,
      ),
    )
    .groupBy(sales.customerId)
    .as("customer_return_credits_by_customer");

const supplierAllocationTotalsByPurchaseSubquery = (
  shopId: string,
  executor?: DbExecutor,
) =>
  getDbExecutor(executor)
    .select({
      purchaseId: supplierPaymentAllocations.purchaseId,
      allocatedAmount:
        sql<string>`coalesce(sum(${supplierPaymentAllocations.amount}), 0.00)`.as(
          "allocated_amount",
        ),
    })
    .from(supplierPaymentAllocations)
    .innerJoin(
      supplierPayments,
      eq(
        supplierPaymentAllocations.supplierPaymentId,
        supplierPayments.id,
      ),
    )
    .where(
      and(
        eq(supplierPaymentAllocations.shopId, shopId),
        eq(supplierPayments.status, "completed"),
      ),
    )
    .groupBy(supplierPaymentAllocations.purchaseId)
    .as("supplier_allocation_totals_by_purchase");

const supplierAllocationTotalsByPaymentSubquery = (
  shopId: string,
  executor?: DbExecutor,
) =>
  getDbExecutor(executor)
    .select({
      supplierPaymentId: supplierPaymentAllocations.supplierPaymentId,
      allocatedAmount:
        sql<string>`coalesce(sum(${supplierPaymentAllocations.amount}), 0.00)`.as(
          "allocated_amount",
        ),
    })
    .from(supplierPaymentAllocations)
    .innerJoin(
      supplierPayments,
      eq(
        supplierPaymentAllocations.supplierPaymentId,
        supplierPayments.id,
      ),
    )
    .where(
      and(
        eq(supplierPaymentAllocations.shopId, shopId),
        eq(supplierPayments.status, "completed"),
      ),
    )
    .groupBy(supplierPaymentAllocations.supplierPaymentId)
    .as("supplier_allocation_totals_by_payment");

const supplierReturnCreditsBySupplierSubquery = (
  shopId: string,
  executor?: DbExecutor,
) =>
  getDbExecutor(executor)
    .select({
      supplierId: purchaseReturns.supplierId,
      effectiveReturnCredit:
        sql<string>`coalesce(sum(${supplierReturnAdvanceCredit()}), 0.00)`.as(
          "effective_return_credit",
        ),
    })
    .from(purchaseReturns)
    .where(
      and(
        eq(purchaseReturns.shopId, shopId),
        eq(purchaseReturns.status, "completed"),
      ),
    )
    .groupBy(purchaseReturns.supplierId)
    .as("supplier_return_credits_by_supplier");

const supplierReturnTotalsByPurchaseSubquery = (
  shopId: string,
  executor?: DbExecutor,
) =>
  getDbExecutor(executor)
    .select({
      purchaseId: purchaseReturns.purchaseId,
      returnAmount:
        sql<string>`coalesce(sum(${purchaseReturns.totalReturnAmount}), 0.00)`.as(
          "return_amount",
        ),
    })
    .from(purchaseReturns)
    .where(
      and(
        eq(purchaseReturns.shopId, shopId),
        eq(purchaseReturns.status, "completed"),
      ),
    )
    .groupBy(purchaseReturns.purchaseId)
    .as("supplier_return_totals_by_purchase");

const customerSummarySubquery = (shopId: string, executor?: DbExecutor) => {
  const completedSalesByCustomer = getDbExecutor(executor)
    .select({
      customerId: sales.customerId,
      totalSales: sql<string>`coalesce(sum(${sales.grandTotal}), 0.00)`.as(
        "total_sales",
      ),
      totalInitialPayments:
        sql<string>`coalesce(sum(${sales.initialPaidAmount}), 0.00)`.as(
          "total_initial_payments",
        ),
      billCount: sql<number>`count(*)`.as("bill_count"),
      lastBillDate:
        sql<Date | null>`max(coalesce(${sales.completedAt}, ${sales.createdAt}))`.as(
          "last_bill_date",
        ),
      lastInitialPaymentDate:
        sql<Date | null>`max(case when ${sales.initialPaidAmount} > 0 then coalesce(${sales.completedAt}, ${sales.createdAt}) else null end)`.as(
          "last_initial_payment_date",
        ),
    })
    .from(sales)
    .where(
      and(
        eq(sales.shopId, shopId),
        eq(sales.status, "completed"),
        sql`${sales.customerId} is not null`,
      ),
    )
    .groupBy(sales.customerId)
    .as("completed_sales_by_customer");

  const returnsByCustomer = getDbExecutor(executor)
    .select({
      customerId: sales.customerId,
      totalReturns:
        sql<string>`coalesce(sum(${saleReturns.totalReturnAmount}), 0.00)`.as(
          "total_returns",
        ),
    })
    .from(saleReturns)
    .innerJoin(sales, eq(saleReturns.saleId, sales.id))
    .where(
      and(
        eq(saleReturns.shopId, shopId),
        eq(saleReturns.status, "completed"),
        sql`${sales.customerId} is not null`,
      ),
    )
    .groupBy(sales.customerId)
    .as("returns_by_customer");

  const paymentsByCustomer = getDbExecutor(executor)
    .select({
      customerId: customerPayments.customerId,
      totalPayments:
        sql<string>`coalesce(sum(${customerPayments.amount}), 0.00)`.as(
          "total_payments",
        ),
      lastPaymentDate:
        sql<Date | null>`max(${customerPayments.paymentDate})`.as(
          "last_payment_date",
        ),
    })
    .from(customerPayments)
    .where(
      and(
        eq(customerPayments.shopId, shopId),
        eq(customerPayments.status, "completed"),
      ),
    )
    .groupBy(customerPayments.customerId)
    .as("payments_by_customer");
  const returnCreditsByCustomer = customerReturnCreditsByCustomerSubquery(
    shopId,
    executor,
  );

  const returnTotals = customerReturnTotalsBySaleSubquery(shopId, executor);
  const allocationTotals = customerAllocationTotalsBySaleSubquery(shopId, executor);

  const openSalesByCustomer = getDbExecutor(executor)
    .select({
      customerId: sales.customerId,
      openBillCount: sql<number>`count(*)`.as("open_bill_count"),
      outstandingAmount: sql<string>`
        coalesce(
          sum(
            greatest(
              ${sales.grandTotal}
              - coalesce(${aliasedColumn("customer_return_totals_by_sale", "return_amount")}, 0.00)
              - ${sales.initialPaidAmount}
              - ${sales.advanceAppliedAmount}
              - coalesce(${aliasedColumn("customer_allocation_totals_by_sale", "allocated_amount")}, 0.00),
              0.00
            )
          ),
          0.00
        )
      `.as("outstanding_amount"),
    })
    .from(sales)
    .leftJoin(returnTotals, eq(returnTotals.saleId, sales.id))
    .leftJoin(allocationTotals, eq(allocationTotals.saleId, sales.id))
    .where(
      and(
        eq(sales.shopId, shopId),
        eq(sales.status, "completed"),
        sql`${sales.customerId} is not null`,
        sql`
          greatest(
            ${sales.grandTotal}
            - coalesce(${aliasedColumn("customer_return_totals_by_sale", "return_amount")}, 0.00)
            - ${sales.initialPaidAmount}
            - ${sales.advanceAppliedAmount}
            - coalesce(${aliasedColumn("customer_allocation_totals_by_sale", "allocated_amount")}, 0.00),
            0.00
          ) > 0
        `,
      ),
    )
    .groupBy(sales.customerId)
    .as("open_sales_by_customer");

  return getDbExecutor(executor)
    .select({
      customerId: customers.id,
      totalSales:
        sql<string>`coalesce(${aliasedColumn("completed_sales_by_customer", "total_sales")}, 0.00)`.as(
          "total_sales",
        ),
      totalReturns:
        sql<string>`coalesce(${aliasedColumn("returns_by_customer", "total_returns")}, 0.00)`.as(
          "total_returns",
        ),
      totalPayments:
        sql<string>`
          coalesce(${aliasedColumn("completed_sales_by_customer", "total_initial_payments")}, 0.00)
          + coalesce(${aliasedColumn("payments_by_customer", "total_payments")}, 0.00)
        `.as(
          "total_payments",
        ),
      billCount:
        sql<number>`coalesce(${aliasedColumn("completed_sales_by_customer", "bill_count")}, 0)`.as(
          "bill_count",
        ),
      openBillCount:
        sql<number>`coalesce(${aliasedColumn("open_sales_by_customer", "open_bill_count")}, 0)`.as(
          "open_bill_count",
        ),
      outstandingAmount:
        sql<string>`coalesce(${aliasedColumn("open_sales_by_customer", "outstanding_amount")}, 0.00)`.as(
          "outstanding_amount",
        ),
      balanceAmount: sql<string>`
        coalesce(${aliasedColumn("completed_sales_by_customer", "total_sales")}, 0.00)
        - coalesce(${aliasedColumn("customer_return_credits_by_customer", "effective_return_credit")}, 0.00)
        - coalesce(${aliasedColumn("completed_sales_by_customer", "total_initial_payments")}, 0.00)
        - coalesce(${aliasedColumn("payments_by_customer", "total_payments")}, 0.00)
      `.as("balance_amount"),
      advanceAmount: sql<string>`
        greatest(
          (
            coalesce(${aliasedColumn("customer_return_credits_by_customer", "effective_return_credit")}, 0.00)
            + coalesce(${aliasedColumn("completed_sales_by_customer", "total_initial_payments")}, 0.00)
            + coalesce(${aliasedColumn("payments_by_customer", "total_payments")}, 0.00)
            - coalesce(${aliasedColumn("completed_sales_by_customer", "total_sales")}, 0.00)
          ),
          0.00
        )
      `.as("advance_amount"),
      lastBillDate:
        sql<Date | null>`${aliasedColumn("completed_sales_by_customer", "last_bill_date")}`.as(
          "last_bill_date",
        ),
      lastPaymentDate:
        sql<Date | null>`
          case
            when ${aliasedColumn("completed_sales_by_customer", "last_initial_payment_date")} is null
              then ${aliasedColumn("payments_by_customer", "last_payment_date")}
            when ${aliasedColumn("payments_by_customer", "last_payment_date")} is null
              then ${aliasedColumn("completed_sales_by_customer", "last_initial_payment_date")}
            else greatest(
              ${aliasedColumn("completed_sales_by_customer", "last_initial_payment_date")},
              ${aliasedColumn("payments_by_customer", "last_payment_date")}
            )
          end
        `.as(
          "last_payment_date",
        ),
    })
    .from(customers)
    .leftJoin(completedSalesByCustomer, eq(completedSalesByCustomer.customerId, customers.id))
    .leftJoin(returnsByCustomer, eq(returnsByCustomer.customerId, customers.id))
    .leftJoin(returnCreditsByCustomer, eq(returnCreditsByCustomer.customerId, customers.id))
    .leftJoin(paymentsByCustomer, eq(paymentsByCustomer.customerId, customers.id))
    .leftJoin(openSalesByCustomer, eq(openSalesByCustomer.customerId, customers.id))
    .where(eq(customers.shopId, shopId))
    .as("customer_financial_summary");
};

const supplierSummarySubquery = (shopId: string, executor?: DbExecutor) => {
  const completedPurchasesBySupplier = getDbExecutor(executor)
    .select({
      supplierId: purchases.supplierId,
      totalPurchases:
        sql<string>`coalesce(sum(${purchases.grandTotal}), 0.00)`.as(
          "total_purchases",
        ),
      totalInitialPayments:
        sql<string>`coalesce(sum(${purchases.initialPaidAmount}), 0.00)`.as(
          "total_initial_payments",
        ),
      purchaseCount: sql<number>`count(*)`.as("purchase_count"),
      lastPurchaseDate:
        sql<Date | null>`max(${purchases.purchaseDate})`.as(
          "last_purchase_date",
        ),
      lastInitialPaymentDate:
        sql<Date | null>`max(case when ${purchases.initialPaidAmount} > 0 then ${purchases.purchaseDate} else null end)`.as(
          "last_initial_payment_date",
        ),
    })
    .from(purchases)
    .where(
      and(eq(purchases.shopId, shopId), eq(purchases.status, "finalized")),
    )
    .groupBy(purchases.supplierId)
    .as("completed_purchases_by_supplier");

  const returnsBySupplier = getDbExecutor(executor)
    .select({
      supplierId: purchaseReturns.supplierId,
      totalReturns:
        sql<string>`coalesce(sum(${purchaseReturns.totalReturnAmount}), 0.00)`.as(
          "total_returns",
        ),
    })
    .from(purchaseReturns)
    .where(
      and(
        eq(purchaseReturns.shopId, shopId),
        eq(purchaseReturns.status, "completed"),
      ),
    )
    .groupBy(purchaseReturns.supplierId)
    .as("returns_by_supplier");

  const paymentsBySupplier = getDbExecutor(executor)
    .select({
      supplierId: supplierPayments.supplierId,
      totalPayments:
        sql<string>`coalesce(sum(${supplierPayments.amount}), 0.00)`.as(
          "total_payments",
        ),
      lastPaymentDate:
        sql<Date | null>`max(${supplierPayments.paymentDate})`.as(
          "last_payment_date",
        ),
    })
    .from(supplierPayments)
    .where(
      and(
        eq(supplierPayments.shopId, shopId),
        eq(supplierPayments.status, "completed"),
      ),
    )
    .groupBy(supplierPayments.supplierId)
    .as("payments_by_supplier");
  const returnCreditsBySupplier = supplierReturnCreditsBySupplierSubquery(
    shopId,
    executor,
  );

  const allocationTotals = supplierAllocationTotalsByPurchaseSubquery(shopId, executor);
  const returnTotals = supplierReturnTotalsByPurchaseSubquery(shopId, executor);

  const openPurchasesBySupplier = getDbExecutor(executor)
    .select({
      supplierId: purchases.supplierId,
      openPurchaseCount: sql<number>`count(*)`.as("open_purchase_count"),
      outstandingAmount: sql<string>`
        coalesce(
          sum(
            greatest(
              ${purchases.grandTotal}
              - coalesce(${aliasedColumn("supplier_return_totals_by_purchase", "return_amount")}, 0.00)
              - ${purchases.initialPaidAmount}
              - ${purchases.advanceAppliedAmount}
              - coalesce(${aliasedColumn("supplier_allocation_totals_by_purchase", "allocated_amount")}, 0.00),
              0.00
            )
          ),
          0.00
        )
      `.as("outstanding_amount"),
    })
    .from(purchases)
    .leftJoin(returnTotals, eq(returnTotals.purchaseId, purchases.id))
    .leftJoin(allocationTotals, eq(allocationTotals.purchaseId, purchases.id))
    .where(
      and(
        eq(purchases.shopId, shopId),
        eq(purchases.status, "finalized"),
        sql`
          greatest(
            ${purchases.grandTotal}
            - coalesce(${aliasedColumn("supplier_return_totals_by_purchase", "return_amount")}, 0.00)
            - ${purchases.initialPaidAmount}
            - ${purchases.advanceAppliedAmount}
            - coalesce(${aliasedColumn("supplier_allocation_totals_by_purchase", "allocated_amount")}, 0.00),
            0.00
          ) > 0
        `,
      ),
    )
    .groupBy(purchases.supplierId)
    .as("open_purchases_by_supplier");

  return getDbExecutor(executor)
    .select({
      supplierId: suppliers.id,
      totalPurchases:
        sql<string>`coalesce(${aliasedColumn("completed_purchases_by_supplier", "total_purchases")}, 0.00)`.as(
          "total_purchases",
        ),
      totalPayments:
        sql<string>`
          coalesce(${aliasedColumn("completed_purchases_by_supplier", "total_initial_payments")}, 0.00)
          + coalesce(${aliasedColumn("payments_by_supplier", "total_payments")}, 0.00)
        `.as(
          "total_payments",
        ),
      purchaseCount:
        sql<number>`coalesce(${aliasedColumn("completed_purchases_by_supplier", "purchase_count")}, 0)`.as(
          "purchase_count",
        ),
      openPurchaseCount:
        sql<number>`coalesce(${aliasedColumn("open_purchases_by_supplier", "open_purchase_count")}, 0)`.as(
          "open_purchase_count",
        ),
      outstandingAmount:
        sql<string>`coalesce(${aliasedColumn("open_purchases_by_supplier", "outstanding_amount")}, 0.00)`.as(
          "outstanding_amount",
        ),
      balanceAmount: sql<string>`
        coalesce(${aliasedColumn("completed_purchases_by_supplier", "total_purchases")}, 0.00)
        - coalesce(${aliasedColumn("supplier_return_credits_by_supplier", "effective_return_credit")}, 0.00)
        - coalesce(${aliasedColumn("completed_purchases_by_supplier", "total_initial_payments")}, 0.00)
        - coalesce(${aliasedColumn("payments_by_supplier", "total_payments")}, 0.00)
        - coalesce(${suppliers.openingBalance}, 0.00)
      `.as("balance_amount"),
      advanceAmount: sql<string>`
        greatest(
          (
            coalesce(${suppliers.openingBalance}, 0.00)
            + coalesce(${aliasedColumn("supplier_return_credits_by_supplier", "effective_return_credit")}, 0.00)
            + coalesce(${aliasedColumn("completed_purchases_by_supplier", "total_initial_payments")}, 0.00)
            + coalesce(${aliasedColumn("payments_by_supplier", "total_payments")}, 0.00)
            - coalesce(${aliasedColumn("completed_purchases_by_supplier", "total_purchases")}, 0.00)
          ),
          0.00
        )
      `.as("advance_amount"),
      lastPurchaseDate:
        sql<Date | null>`${aliasedColumn("completed_purchases_by_supplier", "last_purchase_date")}`.as(
          "last_purchase_date",
        ),
      lastPaymentDate:
        sql<Date | null>`
          case
            when ${aliasedColumn("completed_purchases_by_supplier", "last_initial_payment_date")} is null
              then ${aliasedColumn("payments_by_supplier", "last_payment_date")}
            when ${aliasedColumn("payments_by_supplier", "last_payment_date")} is null
              then ${aliasedColumn("completed_purchases_by_supplier", "last_initial_payment_date")}
            else greatest(
              ${aliasedColumn("completed_purchases_by_supplier", "last_initial_payment_date")},
              ${aliasedColumn("payments_by_supplier", "last_payment_date")}
            )
          end
        `.as(
          "last_payment_date",
        ),
    })
    .from(suppliers)
    .leftJoin(
      completedPurchasesBySupplier,
      eq(completedPurchasesBySupplier.supplierId, suppliers.id),
    )
    .leftJoin(returnsBySupplier, eq(returnsBySupplier.supplierId, suppliers.id))
    .leftJoin(returnCreditsBySupplier, eq(returnCreditsBySupplier.supplierId, suppliers.id))
    .leftJoin(paymentsBySupplier, eq(paymentsBySupplier.supplierId, suppliers.id))
    .leftJoin(
      openPurchasesBySupplier,
      eq(openPurchasesBySupplier.supplierId, suppliers.id),
    )
    .where(eq(suppliers.shopId, shopId))
    .as("supplier_financial_summary");
};

const hasCustomerAccountingBalance = (
  summary: ReturnType<typeof customerSummarySubquery>,
) => sql`(${summary.outstandingAmount} > 0 or ${summary.advanceAmount} > 0)`;

const hasSupplierAccountingBalance = (
  summary: ReturnType<typeof supplierSummarySubquery>,
) => sql`(${summary.outstandingAmount} > 0 or ${summary.advanceAmount} > 0)`;

export class AccountingRepository {
  async findCustomerById(shopId: string, customerId: string, executor?: DbExecutor) {
    const [customer] = await getDbExecutor(executor)
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.shopId, shopId)))
      .limit(1);

    return customer ?? null;
  }

  async findSupplierById(shopId: string, supplierId: string, executor?: DbExecutor) {
    const [supplier] = await getDbExecutor(executor)
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.shopId, shopId)))
      .limit(1);

    return supplier ?? null;
  }

  async listSupplierOptions(shopId: string, search: string | undefined, pageSize: number) {
    const filters = [eq(suppliers.shopId, shopId), eq(suppliers.status, "active")];

    if (search) {
      const digits = search.replace(/\D/g, "");
      filters.push(
        or(
          like(suppliers.supplierNameNormalized, `%${search}%`),
          like(suppliers.mobileNumber, `%${digits || search}%`),
        )!,
      );
    }

    return getDbExecutor()
      .select({
        supplier: suppliers,
      })
      .from(suppliers)
      .where(and(...filters))
      .orderBy(asc(suppliers.supplierNameNormalized), asc(suppliers.id))
      .limit(pageSize);
  }

  async listCustomerPayments(shopId: string, query: ListAccountingCustomerPaymentsQuery) {
    const orderBy =
      query.sortBy === "createdAt"
        ? [
            query.sortOrder === "asc"
              ? asc(customerPayments.createdAt)
              : desc(customerPayments.createdAt),
            desc(customerPayments.id),
          ]
        : query.sortBy === "amount"
          ? [
              query.sortOrder === "asc"
                ? asc(customerPayments.amount)
                : desc(customerPayments.amount),
              desc(customerPayments.id),
            ]
          : [
              query.sortOrder === "asc"
                ? asc(customerPayments.paymentDate)
                : desc(customerPayments.paymentDate),
              desc(customerPayments.id),
            ];

    return getDbExecutor()
      .select({
        payment: customerPayments,
        customer: {
          id: customers.id,
          customerCode: customers.customerCode,
          fullName: customers.fullName,
          mobileNumber: customers.mobileNumber,
        },
        linkedSale: {
          id: sales.id,
          billNumber: sales.billNumber,
          billDate: sql<Date | null>`coalesce(${sales.completedAt}, ${sales.createdAt})`,
        },
        receivedBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(customerPayments)
      .innerJoin(customers, eq(customerPayments.customerId, customers.id))
      .leftJoin(sales, eq(customerPayments.saleId, sales.id))
      .innerJoin(users, eq(customerPayments.receivedByUserId, users.id))
      .where(buildCustomerPaymentFilters(shopId, query))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async findCustomerPaymentById(
    shopId: string,
    paymentId: string,
    executor?: DbExecutor,
  ) {
    const [record] = await getDbExecutor(executor)
      .select({
        payment: customerPayments,
        customer: {
          id: customers.id,
          customerCode: customers.customerCode,
          fullName: customers.fullName,
          mobileNumber: customers.mobileNumber,
        },
        linkedSale: {
          id: sales.id,
          billNumber: sales.billNumber,
          billDate: sql<Date | null>`coalesce(${sales.completedAt}, ${sales.createdAt})`,
        },
        receivedBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(customerPayments)
      .innerJoin(customers, eq(customerPayments.customerId, customers.id))
      .leftJoin(sales, eq(customerPayments.saleId, sales.id))
      .innerJoin(users, eq(customerPayments.receivedByUserId, users.id))
      .where(and(eq(customerPayments.shopId, shopId), eq(customerPayments.id, paymentId)))
      .limit(1);

    return record ?? null;
  }

  async countCustomerPayments(shopId: string, query: ListAccountingCustomerPaymentsQuery) {
    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(customerPayments)
      .innerJoin(customers, eq(customerPayments.customerId, customers.id))
      .leftJoin(sales, eq(customerPayments.saleId, sales.id))
      .where(buildCustomerPaymentFilters(shopId, query));

    return result?.total ?? 0;
  }

  async getCustomerPaymentsSummary(
    shopId: string,
    query: ListAccountingCustomerPaymentsQuery,
  ) {
    const [result] = await getDbExecutor()
      .select({
        totalPayments: count(),
        totalAmount: sql<string>`coalesce(sum(${customerPayments.amount}), 0.00)`,
      })
      .from(customerPayments)
      .innerJoin(customers, eq(customerPayments.customerId, customers.id))
      .leftJoin(sales, eq(customerPayments.saleId, sales.id))
      .where(buildCustomerPaymentFilters(shopId, query));

    return {
      totalPayments: result?.totalPayments ?? 0,
      totalAmount: result?.totalAmount ?? "0.00",
    };
  }

  async listCustomerPaymentAllocationsByPaymentIds(
    shopId: string,
    paymentIds: string[],
    executor?: DbExecutor,
  ) {
    if (!paymentIds.length) {
      return [];
    }

    return getDbExecutor(executor)
      .select({
        allocation: customerPaymentAllocations,
        sale: {
          id: sales.id,
          billNumber: sales.billNumber,
          billDate: sql<Date | null>`coalesce(${sales.completedAt}, ${sales.createdAt})`,
          grandTotal: sales.grandTotal,
          dueAmount: sales.dueAmount,
          paymentStatus: sales.paymentStatus,
        },
      })
      .from(customerPaymentAllocations)
      .innerJoin(sales, eq(customerPaymentAllocations.saleId, sales.id))
      .where(
        and(
          eq(customerPaymentAllocations.shopId, shopId),
          inArray(customerPaymentAllocations.customerPaymentId, paymentIds),
        ),
      )
      .orderBy(
        asc(customerPaymentAllocations.createdAt),
        asc(customerPaymentAllocations.id),
      );
  }

  async listCustomerAdvancePaymentSources(
    shopId: string,
    customerId: string,
    executor?: DbExecutor,
  ) {
    const allocationTotals = customerAllocationTotalsByPaymentSubquery(shopId, executor);

    return getDbExecutor(executor)
      .select({
        payment: customerPayments,
        allocatedAmount:
          sql<string>`coalesce(${aliasedColumn("customer_allocation_totals_by_payment", "allocated_amount")}, 0.00)`.as(
            "allocated_amount",
          ),
        remainingAmount: sql<string>`
          greatest(
            ${customerPayments.amount}
            - coalesce(${aliasedColumn("customer_allocation_totals_by_payment", "allocated_amount")}, 0.00),
            0.00
          )
        `.as("remaining_amount"),
      })
      .from(customerPayments)
      .leftJoin(
        allocationTotals,
        eq(allocationTotals.customerPaymentId, customerPayments.id),
      )
      .where(
        and(
          eq(customerPayments.shopId, shopId),
          eq(customerPayments.customerId, customerId),
          eq(customerPayments.status, "completed"),
          sql`
            greatest(
              ${customerPayments.amount}
              - coalesce(${aliasedColumn("customer_allocation_totals_by_payment", "allocated_amount")}, 0.00),
              0.00
            ) > 0
          `,
        ),
      )
      .orderBy(
        asc(customerPayments.paymentDate),
        asc(customerPayments.createdAt),
        asc(customerPayments.id),
      );
  }

  async listSupplierPayments(shopId: string, query: ListAccountingSupplierPaymentsQuery) {
    const orderBy =
      query.sortBy === "createdAt"
        ? [
            query.sortOrder === "asc"
              ? asc(supplierPayments.createdAt)
              : desc(supplierPayments.createdAt),
            desc(supplierPayments.id),
          ]
        : query.sortBy === "amount"
          ? [
              query.sortOrder === "asc"
                ? asc(supplierPayments.amount)
                : desc(supplierPayments.amount),
              desc(supplierPayments.id),
            ]
          : [
              query.sortOrder === "asc"
                ? asc(supplierPayments.paymentDate)
                : desc(supplierPayments.paymentDate),
              desc(supplierPayments.id),
            ];

    return getDbExecutor()
      .select({
        payment: supplierPayments,
        supplier: {
          id: suppliers.id,
          supplierName: suppliers.supplierName,
          companyName: suppliers.companyName,
          mobileNumber: suppliers.mobileNumber,
        },
        linkedPurchase: {
          id: purchases.id,
          purchaseNumber: purchases.purchaseNumber,
          purchaseDate: purchases.purchaseDate,
        },
        paidBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(supplierPayments)
      .innerJoin(suppliers, eq(supplierPayments.supplierId, suppliers.id))
      .leftJoin(purchases, eq(supplierPayments.purchaseId, purchases.id))
      .innerJoin(users, eq(supplierPayments.paidByUserId, users.id))
      .where(buildSupplierPaymentFilters(shopId, query))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async findSupplierPaymentById(
    shopId: string,
    paymentId: string,
    executor?: DbExecutor,
  ) {
    const [record] = await getDbExecutor(executor)
      .select({
        payment: supplierPayments,
        supplier: {
          id: suppliers.id,
          supplierName: suppliers.supplierName,
          companyName: suppliers.companyName,
          mobileNumber: suppliers.mobileNumber,
        },
        linkedPurchase: {
          id: purchases.id,
          purchaseNumber: purchases.purchaseNumber,
          purchaseDate: purchases.purchaseDate,
        },
        paidBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(supplierPayments)
      .innerJoin(suppliers, eq(supplierPayments.supplierId, suppliers.id))
      .leftJoin(purchases, eq(supplierPayments.purchaseId, purchases.id))
      .innerJoin(users, eq(supplierPayments.paidByUserId, users.id))
      .where(and(eq(supplierPayments.shopId, shopId), eq(supplierPayments.id, paymentId)))
      .limit(1);

    return record ?? null;
  }

  async countSupplierPayments(shopId: string, query: ListAccountingSupplierPaymentsQuery) {
    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(supplierPayments)
      .innerJoin(suppliers, eq(supplierPayments.supplierId, suppliers.id))
      .leftJoin(purchases, eq(supplierPayments.purchaseId, purchases.id))
      .where(buildSupplierPaymentFilters(shopId, query));

    return result?.total ?? 0;
  }

  async getSupplierPaymentsSummary(
    shopId: string,
    query: ListAccountingSupplierPaymentsQuery,
  ) {
    const [result] = await getDbExecutor()
      .select({
        totalPayments: count(),
        totalAmount: sql<string>`coalesce(sum(${supplierPayments.amount}), 0.00)`,
      })
      .from(supplierPayments)
      .innerJoin(suppliers, eq(supplierPayments.supplierId, suppliers.id))
      .leftJoin(purchases, eq(supplierPayments.purchaseId, purchases.id))
      .where(buildSupplierPaymentFilters(shopId, query));

    return {
      totalPayments: result?.totalPayments ?? 0,
      totalAmount: result?.totalAmount ?? "0.00",
    };
  }

  async listSupplierPaymentAllocationsByPaymentIds(
    shopId: string,
    paymentIds: string[],
    executor?: DbExecutor,
  ) {
    if (!paymentIds.length) {
      return [];
    }

    return getDbExecutor(executor)
      .select({
        allocation: supplierPaymentAllocations,
        purchase: {
          id: purchases.id,
          purchaseNumber: purchases.purchaseNumber,
          purchaseDate: purchases.purchaseDate,
          grandTotal: purchases.grandTotal,
          dueAmount: purchases.dueAmount,
          paymentStatus: purchases.paymentStatus,
        },
      })
      .from(supplierPaymentAllocations)
      .innerJoin(purchases, eq(supplierPaymentAllocations.purchaseId, purchases.id))
      .where(
        and(
          eq(supplierPaymentAllocations.shopId, shopId),
          inArray(supplierPaymentAllocations.supplierPaymentId, paymentIds),
        ),
      )
      .orderBy(
        asc(supplierPaymentAllocations.createdAt),
        asc(supplierPaymentAllocations.id),
      );
  }

  async listSupplierAdvancePaymentSources(
    shopId: string,
    supplierId: string,
    executor?: DbExecutor,
  ) {
    const allocationTotals = supplierAllocationTotalsByPaymentSubquery(shopId, executor);

    return getDbExecutor(executor)
      .select({
        payment: supplierPayments,
        allocatedAmount:
          sql<string>`coalesce(${aliasedColumn("supplier_allocation_totals_by_payment", "allocated_amount")}, 0.00)`.as(
            "allocated_amount",
          ),
        remainingAmount: sql<string>`
          greatest(
            ${supplierPayments.amount}
            - coalesce(${aliasedColumn("supplier_allocation_totals_by_payment", "allocated_amount")}, 0.00),
            0.00
          )
        `.as("remaining_amount"),
      })
      .from(supplierPayments)
      .leftJoin(
        allocationTotals,
        eq(allocationTotals.supplierPaymentId, supplierPayments.id),
      )
      .where(
        and(
          eq(supplierPayments.shopId, shopId),
          eq(supplierPayments.supplierId, supplierId),
          eq(supplierPayments.status, "completed"),
          sql`
            greatest(
              ${supplierPayments.amount}
              - coalesce(${aliasedColumn("supplier_allocation_totals_by_payment", "allocated_amount")}, 0.00),
              0.00
            ) > 0
          `,
        ),
      )
      .orderBy(
        asc(supplierPayments.paymentDate),
        asc(supplierPayments.createdAt),
        asc(supplierPayments.id),
      );
  }

  async listOutstandingCustomers(shopId: string, query: ListOutstandingCustomersQuery) {
    const summary = customerSummarySubquery(shopId);
    const orderBy =
      query.sortBy === "fullName"
        ? [
            query.sortOrder === "asc"
              ? asc(customers.fullNameNormalized)
              : desc(customers.fullNameNormalized),
            asc(customers.id),
          ]
        : query.sortBy === "lastBillDate"
          ? [
              query.sortOrder === "asc"
                ? asc(summary.lastBillDate)
                : desc(summary.lastBillDate),
              asc(customers.id),
            ]
          : [
              query.sortOrder === "asc"
                ? asc(summary.outstandingAmount)
                : desc(summary.outstandingAmount),
              asc(customers.id),
            ];

    const filters = [
      eq(customers.shopId, shopId),
      hasCustomerAccountingBalance(summary),
    ];

    if (query.search) {
      const digits = query.search.replace(/\D/g, "");
      filters.push(
        or(
          like(customers.fullNameNormalized, `%${query.search}%`),
          like(customers.customerCode, `%${query.search}%`),
          like(customers.mobileNumber, `%${digits || query.search}%`),
        )!,
      );
    }

    const rows = await getDbExecutor()
      .select({
        customer: customers,
        totalSales: summary.totalSales,
        totalReturns: summary.totalReturns,
        totalPayments: summary.totalPayments,
        billCount: summary.billCount,
        openBillCount: summary.openBillCount,
        outstandingAmount: summary.outstandingAmount,
        balanceAmount: summary.balanceAmount,
        advanceAmount: summary.advanceAmount,
        lastBillDate: summary.lastBillDate,
        lastPaymentDate: summary.lastPaymentDate,
      })
      .from(customers)
      .innerJoin(summary, eq(summary.customerId, customers.id))
      .where(and(...filters))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);

    return rows.map((row) => ({
      customer: row.customer,
      summary: {
        totalSales: row.totalSales,
        totalReturns: row.totalReturns,
        totalPayments: row.totalPayments,
        billCount: row.billCount,
        openBillCount: row.openBillCount,
        outstandingAmount: row.outstandingAmount,
        balanceAmount: row.balanceAmount,
        advanceAmount: row.advanceAmount,
        lastBillDate: row.lastBillDate,
        lastPaymentDate: row.lastPaymentDate,
      },
    }));
  }

  async countOutstandingCustomers(shopId: string, query: ListOutstandingCustomersQuery) {
    const summary = customerSummarySubquery(shopId);
    const filters = [
      eq(customers.shopId, shopId),
      hasCustomerAccountingBalance(summary),
    ];

    if (query.search) {
      const digits = query.search.replace(/\D/g, "");
      filters.push(
        or(
          like(customers.fullNameNormalized, `%${query.search}%`),
          like(customers.customerCode, `%${query.search}%`),
          like(customers.mobileNumber, `%${digits || query.search}%`),
        )!,
      );
    }

    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(customers)
      .innerJoin(summary, eq(summary.customerId, customers.id))
      .where(and(...filters));

    return result?.total ?? 0;
  }

  async getOutstandingCustomersSummary(
    shopId: string,
    query: ListOutstandingCustomersQuery,
  ) {
    const summary = customerSummarySubquery(shopId);
    const filters = [
      eq(customers.shopId, shopId),
      hasCustomerAccountingBalance(summary),
    ];

    if (query.search) {
      const digits = query.search.replace(/\D/g, "");
      filters.push(
        or(
          like(customers.fullNameNormalized, `%${query.search}%`),
          like(customers.customerCode, `%${query.search}%`),
          like(customers.mobileNumber, `%${digits || query.search}%`),
        )!,
      );
    }

    const [result] = await getDbExecutor()
      .select({
        entityCount: count(),
        openBillCount: sql<number>`coalesce(sum(${summary.openBillCount}), 0)`,
        totalOutstandingAmount:
          sql<string>`coalesce(sum(${summary.outstandingAmount}), 0.00)`,
        totalAdvanceAmount: sql<string>`coalesce(sum(${summary.advanceAmount}), 0.00)`,
      })
      .from(customers)
      .innerJoin(summary, eq(summary.customerId, customers.id))
      .where(and(...filters));

    return {
      entityCount: result?.entityCount ?? 0,
      openBillCount: Number(result?.openBillCount ?? 0),
      totalOutstandingAmount: result?.totalOutstandingAmount ?? "0.00",
      totalAdvanceAmount: result?.totalAdvanceAmount ?? "0.00",
    };
  }

  async getCustomerFinancialSummary(
    shopId: string,
    customerId: string,
    executor?: DbExecutor,
  ) {
    const summary = customerSummarySubquery(shopId, executor);
    const [row] = await getDbExecutor(executor)
      .select({
        customer: customers,
        totalSales: summary.totalSales,
        totalReturns: summary.totalReturns,
        totalPayments: summary.totalPayments,
        billCount: summary.billCount,
        openBillCount: summary.openBillCount,
        outstandingAmount: summary.outstandingAmount,
        balanceAmount: summary.balanceAmount,
        advanceAmount: summary.advanceAmount,
        lastBillDate: summary.lastBillDate,
        lastPaymentDate: summary.lastPaymentDate,
      })
      .from(customers)
      .innerJoin(summary, eq(summary.customerId, customers.id))
      .where(and(eq(customers.shopId, shopId), eq(customers.id, customerId)))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      customer: row.customer,
      summary: {
        totalSales: row.totalSales,
        totalReturns: row.totalReturns,
        totalPayments: row.totalPayments,
        billCount: row.billCount,
        openBillCount: row.openBillCount,
        outstandingAmount: row.outstandingAmount,
        balanceAmount: row.balanceAmount,
        advanceAmount: row.advanceAmount,
        lastBillDate: row.lastBillDate,
        lastPaymentDate: row.lastPaymentDate,
      },
    };
  }

  async listOpenSalesForCustomer(shopId: string, customerId: string, executor?: DbExecutor) {
    const returnTotals = customerReturnTotalsBySaleSubquery(shopId, executor);
    const allocationTotals = customerAllocationTotalsBySaleSubquery(shopId, executor);

    return getDbExecutor(executor)
      .select({
        sale: sales,
        openDue: sql<string>`
          greatest(
            ${sales.grandTotal}
            - coalesce(${aliasedColumn("customer_return_totals_by_sale", "return_amount")}, 0.00)
            - ${sales.initialPaidAmount}
            - ${sales.advanceAppliedAmount}
            - coalesce(${aliasedColumn("customer_allocation_totals_by_sale", "allocated_amount")}, 0.00),
            0.00
          )
        `.as("open_due"),
        netTotal: sql<string>`
          greatest(
            ${sales.grandTotal} - coalesce(${aliasedColumn("customer_return_totals_by_sale", "return_amount")}, 0.00),
            0.00
          )
        `.as("net_total"),
        returnedAmount:
          sql<string>`coalesce(${aliasedColumn("customer_return_totals_by_sale", "return_amount")}, 0.00)`.as(
            "returned_amount",
          ),
        allocatedAmount:
          sql<string>`coalesce(${aliasedColumn("customer_allocation_totals_by_sale", "allocated_amount")}, 0.00)`.as(
            "allocated_amount",
          ),
      })
      .from(sales)
      .leftJoin(returnTotals, eq(returnTotals.saleId, sales.id))
      .leftJoin(allocationTotals, eq(allocationTotals.saleId, sales.id))
      .where(
        and(
          eq(sales.shopId, shopId),
          eq(sales.customerId, customerId),
          eq(sales.status, "completed"),
          sql`
            greatest(
            ${sales.grandTotal}
            - coalesce(${aliasedColumn("customer_return_totals_by_sale", "return_amount")}, 0.00)
            - ${sales.initialPaidAmount}
            - ${sales.advanceAppliedAmount}
            - coalesce(${aliasedColumn("customer_allocation_totals_by_sale", "allocated_amount")}, 0.00),
            0.00
          ) > 0
          `,
        ),
      )
      .orderBy(
        asc(sql`coalesce(${sales.completedAt}, ${sales.createdAt})`),
        asc(sales.id),
      );
  }

  async getSalePaymentComputation(shopId: string, saleId: string, executor?: DbExecutor) {
    const returnTotals = customerReturnTotalsBySaleSubquery(shopId, executor);
    const allocationTotals = customerAllocationTotalsBySaleSubquery(shopId, executor);
    const [result] = await getDbExecutor(executor)
      .select({
        sale: sales,
        returnedAmount:
          sql<string>`coalesce(${aliasedColumn("customer_return_totals_by_sale", "return_amount")}, 0.00)`.as(
            "returned_amount",
          ),
        allocatedAmount:
          sql<string>`coalesce(${aliasedColumn("customer_allocation_totals_by_sale", "allocated_amount")}, 0.00)`.as(
            "allocated_amount",
          ),
      })
      .from(sales)
      .leftJoin(returnTotals, eq(returnTotals.saleId, sales.id))
      .leftJoin(allocationTotals, eq(allocationTotals.saleId, sales.id))
      .where(and(eq(sales.shopId, shopId), eq(sales.id, saleId)))
      .limit(1);

    return result ?? null;
  }

  async listOutstandingSuppliers(shopId: string, query: ListOutstandingSuppliersQuery) {
    const summary = supplierSummarySubquery(shopId);
    const orderBy =
      query.sortBy === "supplierName"
        ? [
            query.sortOrder === "asc"
              ? asc(suppliers.supplierNameNormalized)
              : desc(suppliers.supplierNameNormalized),
            asc(suppliers.id),
          ]
        : query.sortBy === "lastPurchaseDate"
          ? [
              query.sortOrder === "asc"
                ? asc(summary.lastPurchaseDate)
                : desc(summary.lastPurchaseDate),
              asc(suppliers.id),
            ]
          : [
              query.sortOrder === "asc"
                ? asc(summary.outstandingAmount)
                : desc(summary.outstandingAmount),
              asc(suppliers.id),
            ];

    const filters = [
      eq(suppliers.shopId, shopId),
      hasSupplierAccountingBalance(summary),
    ];

    if (query.search) {
      const digits = query.search.replace(/\D/g, "");
      filters.push(
        or(
          like(suppliers.supplierNameNormalized, `%${query.search}%`),
          like(suppliers.mobileNumber, `%${digits || query.search}%`),
          like(suppliers.companyNameNormalized, `%${query.search}%`),
        )!,
      );
    }

    const rows = await getDbExecutor()
      .select({
        supplier: suppliers,
        totalPurchases: summary.totalPurchases,
        totalPayments: summary.totalPayments,
        purchaseCount: summary.purchaseCount,
        openPurchaseCount: summary.openPurchaseCount,
        outstandingAmount: summary.outstandingAmount,
        balanceAmount: summary.balanceAmount,
        advanceAmount: summary.advanceAmount,
        lastPurchaseDate: summary.lastPurchaseDate,
        lastPaymentDate: summary.lastPaymentDate,
      })
      .from(suppliers)
      .innerJoin(summary, eq(summary.supplierId, suppliers.id))
      .where(and(...filters))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);

    return rows.map((row) => ({
      supplier: row.supplier,
      summary: {
        totalPurchases: row.totalPurchases,
        totalPayments: row.totalPayments,
        purchaseCount: row.purchaseCount,
        openPurchaseCount: row.openPurchaseCount,
        outstandingAmount: row.outstandingAmount,
        balanceAmount: row.balanceAmount,
        advanceAmount: row.advanceAmount,
        lastPurchaseDate: row.lastPurchaseDate,
        lastPaymentDate: row.lastPaymentDate,
      },
    }));
  }

  async countOutstandingSuppliers(shopId: string, query: ListOutstandingSuppliersQuery) {
    const summary = supplierSummarySubquery(shopId);
    const filters = [
      eq(suppliers.shopId, shopId),
      hasSupplierAccountingBalance(summary),
    ];

    if (query.search) {
      const digits = query.search.replace(/\D/g, "");
      filters.push(
        or(
          like(suppliers.supplierNameNormalized, `%${query.search}%`),
          like(suppliers.mobileNumber, `%${digits || query.search}%`),
          like(suppliers.companyNameNormalized, `%${query.search}%`),
        )!,
      );
    }

    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(suppliers)
      .innerJoin(summary, eq(summary.supplierId, suppliers.id))
      .where(and(...filters));

    return result?.total ?? 0;
  }

  async getOutstandingSuppliersSummary(
    shopId: string,
    query: ListOutstandingSuppliersQuery,
  ) {
    const summary = supplierSummarySubquery(shopId);
    const filters = [
      eq(suppliers.shopId, shopId),
      hasSupplierAccountingBalance(summary),
    ];

    if (query.search) {
      const digits = query.search.replace(/\D/g, "");
      filters.push(
        or(
          like(suppliers.supplierNameNormalized, `%${query.search}%`),
          like(suppliers.mobileNumber, `%${digits || query.search}%`),
          like(suppliers.companyNameNormalized, `%${query.search}%`),
        )!,
      );
    }

    const [result] = await getDbExecutor()
      .select({
        entityCount: count(),
        openPurchaseCount: sql<number>`coalesce(sum(${summary.openPurchaseCount}), 0)`,
        totalOutstandingAmount:
          sql<string>`coalesce(sum(${summary.outstandingAmount}), 0.00)`,
        totalAdvanceAmount: sql<string>`coalesce(sum(${summary.advanceAmount}), 0.00)`,
      })
      .from(suppliers)
      .innerJoin(summary, eq(summary.supplierId, suppliers.id))
      .where(and(...filters));

    return {
      entityCount: result?.entityCount ?? 0,
      openPurchaseCount: Number(result?.openPurchaseCount ?? 0),
      totalOutstandingAmount: result?.totalOutstandingAmount ?? "0.00",
      totalAdvanceAmount: result?.totalAdvanceAmount ?? "0.00",
    };
  }

  async getSupplierFinancialSummary(
    shopId: string,
    supplierId: string,
    executor?: DbExecutor,
  ) {
    const summary = supplierSummarySubquery(shopId, executor);
    const [row] = await getDbExecutor(executor)
      .select({
        supplier: suppliers,
        totalPurchases: summary.totalPurchases,
        totalPayments: summary.totalPayments,
        purchaseCount: summary.purchaseCount,
        openPurchaseCount: summary.openPurchaseCount,
        outstandingAmount: summary.outstandingAmount,
        balanceAmount: summary.balanceAmount,
        advanceAmount: summary.advanceAmount,
        lastPurchaseDate: summary.lastPurchaseDate,
        lastPaymentDate: summary.lastPaymentDate,
      })
      .from(suppliers)
      .innerJoin(summary, eq(summary.supplierId, suppliers.id))
      .where(and(eq(suppliers.shopId, shopId), eq(suppliers.id, supplierId)))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      supplier: row.supplier,
      summary: {
        totalPurchases: row.totalPurchases,
        totalPayments: row.totalPayments,
        purchaseCount: row.purchaseCount,
        openPurchaseCount: row.openPurchaseCount,
        outstandingAmount: row.outstandingAmount,
        balanceAmount: row.balanceAmount,
        advanceAmount: row.advanceAmount,
        lastPurchaseDate: row.lastPurchaseDate,
        lastPaymentDate: row.lastPaymentDate,
      },
    };
  }

  async listOpenPurchasesForSupplier(
    shopId: string,
    supplierId: string,
    executor?: DbExecutor,
  ) {
    const allocationTotals = supplierAllocationTotalsByPurchaseSubquery(shopId, executor);
    const returnTotals = supplierReturnTotalsByPurchaseSubquery(shopId, executor);

    return getDbExecutor(executor)
      .select({
        purchase: purchases,
        openDue: sql<string>`
          greatest(
            ${purchases.grandTotal}
            - coalesce(${aliasedColumn("supplier_return_totals_by_purchase", "return_amount")}, 0.00)
            - ${purchases.initialPaidAmount}
            - ${purchases.advanceAppliedAmount}
            - coalesce(${aliasedColumn("supplier_allocation_totals_by_purchase", "allocated_amount")}, 0.00),
            0.00
          )
        `.as("open_due"),
        netTotal: sql<string>`
          greatest(
            ${purchases.grandTotal}
            - coalesce(${aliasedColumn("supplier_return_totals_by_purchase", "return_amount")}, 0.00),
            0.00
          )
        `.as("net_total"),
        returnedAmount:
          sql<string>`coalesce(${aliasedColumn("supplier_return_totals_by_purchase", "return_amount")}, 0.00)`.as(
            "returned_amount",
          ),
        allocatedAmount:
          sql<string>`coalesce(${aliasedColumn("supplier_allocation_totals_by_purchase", "allocated_amount")}, 0.00)`.as(
            "allocated_amount",
          ),
      })
      .from(purchases)
      .leftJoin(returnTotals, eq(returnTotals.purchaseId, purchases.id))
      .leftJoin(allocationTotals, eq(allocationTotals.purchaseId, purchases.id))
      .where(
        and(
          eq(purchases.shopId, shopId),
          eq(purchases.supplierId, supplierId),
          eq(purchases.status, "finalized"),
          sql`
            greatest(
            ${purchases.grandTotal}
            - coalesce(${aliasedColumn("supplier_return_totals_by_purchase", "return_amount")}, 0.00)
            - ${purchases.initialPaidAmount}
            - ${purchases.advanceAppliedAmount}
            - coalesce(${aliasedColumn("supplier_allocation_totals_by_purchase", "allocated_amount")}, 0.00),
            0.00
          ) > 0
          `,
        ),
      )
      .orderBy(asc(purchases.purchaseDate), asc(purchases.id));
  }

  async getPurchasePaymentComputation(
    shopId: string,
    purchaseId: string,
    executor?: DbExecutor,
  ) {
    const allocationTotals = supplierAllocationTotalsByPurchaseSubquery(shopId, executor);
    const returnTotals = supplierReturnTotalsByPurchaseSubquery(shopId, executor);
    const [result] = await getDbExecutor(executor)
      .select({
        purchase: purchases,
        returnedAmount:
          sql<string>`coalesce(${aliasedColumn("supplier_return_totals_by_purchase", "return_amount")}, 0.00)`.as(
            "returned_amount",
          ),
        allocatedAmount:
          sql<string>`coalesce(${aliasedColumn("supplier_allocation_totals_by_purchase", "allocated_amount")}, 0.00)`.as(
            "allocated_amount",
          ),
      })
      .from(purchases)
      .leftJoin(returnTotals, eq(returnTotals.purchaseId, purchases.id))
      .leftJoin(allocationTotals, eq(allocationTotals.purchaseId, purchases.id))
      .where(and(eq(purchases.shopId, shopId), eq(purchases.id, purchaseId)))
      .limit(1);

    return result ?? null;
  }

  async lockCustomerPayments(customerId: string, executor: DbExecutor) {
    await getDbExecutor(executor).execute(
      sql`select pg_advisory_xact_lock(hashtext(${`accounting-customer:${customerId}`}))`,
    );
  }

  async lockSupplierPayments(supplierId: string, executor: DbExecutor) {
    await getDbExecutor(executor).execute(
      sql`select pg_advisory_xact_lock(hashtext(${`accounting-supplier:${supplierId}`}))`,
    );
  }

  async createCustomerPayment(
    payload: typeof customerPayments.$inferInsert,
    allocations: Array<Omit<typeof customerPaymentAllocations.$inferInsert, "customerPaymentId">>,
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [payment] = await database.insert(customerPayments).values(payload).returning();

    if (!payment) {
      throw new Error("Failed to create customer payment.");
    }

    const createdAllocations = allocations.length
      ? await database
          .insert(customerPaymentAllocations)
          .values(
            allocations.map((allocation) => ({
              ...allocation,
              customerPaymentId: payment.id,
            })),
          )
          .returning()
      : [];

    return {
      payment,
      allocations: createdAllocations,
    };
  }

  async createSupplierPayment(
    payload: typeof supplierPayments.$inferInsert,
    allocations: Array<Omit<typeof supplierPaymentAllocations.$inferInsert, "supplierPaymentId">>,
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [payment] = await database.insert(supplierPayments).values(payload).returning();

    if (!payment) {
      throw new Error("Failed to create supplier payment.");
    }

    const createdAllocations = allocations.length
      ? await database
          .insert(supplierPaymentAllocations)
          .values(
            allocations.map((allocation) => ({
              ...allocation,
              supplierPaymentId: payment.id,
            })),
          )
          .returning()
      : [];

    return {
      payment,
      allocations: createdAllocations,
    };
  }

  async createSupplierPaymentAllocations(
    allocations: Array<typeof supplierPaymentAllocations.$inferInsert>,
    executor: DbExecutor,
  ) {
    if (!allocations.length) {
      return [];
    }

    return getDbExecutor(executor)
      .insert(supplierPaymentAllocations)
      .values(allocations)
      .returning();
  }

  async createCustomerPaymentAllocations(
    allocations: Array<typeof customerPaymentAllocations.$inferInsert>,
    executor: DbExecutor,
  ) {
    if (!allocations.length) {
      return [];
    }

    return getDbExecutor(executor)
      .insert(customerPaymentAllocations)
      .values(allocations)
      .returning();
  }

  async updateSaleFinancials(
    saleId: string,
    payload: Pick<
      typeof sales.$inferInsert,
      "paidAmount" | "dueAmount" | "paymentStatus" | "updatedByUserId"
    >,
    executor: DbExecutor,
  ) {
    const [sale] = await getDbExecutor(executor)
      .update(sales)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(sales.id, saleId))
      .returning();

    return sale ?? null;
  }

  async updateSaleAdvanceAppliedAmount(
    saleId: string,
    advanceAppliedAmount: string,
    updatedByUserId: string,
    executor: DbExecutor,
  ) {
    const [sale] = await getDbExecutor(executor)
      .update(sales)
      .set({
        advanceAppliedAmount,
        updatedByUserId,
        updatedAt: new Date(),
      })
      .where(eq(sales.id, saleId))
      .returning();

    return sale ?? null;
  }

  async updatePurchaseFinancials(
    purchaseId: string,
    payload: Pick<
      typeof purchases.$inferInsert,
      "paidAmount" | "dueAmount" | "paymentStatus" | "updatedByUserId"
    >,
    executor: DbExecutor,
  ) {
    const [purchase] = await getDbExecutor(executor)
      .update(purchases)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(purchases.id, purchaseId))
      .returning();

    return purchase ?? null;
  }

  async updatePurchaseAdvanceAppliedAmount(
    purchaseId: string,
    advanceAppliedAmount: string,
    updatedByUserId: string,
    executor: DbExecutor,
  ) {
    const [purchase] = await getDbExecutor(executor)
      .update(purchases)
      .set({
        advanceAppliedAmount,
        updatedByUserId,
        updatedAt: new Date(),
      })
      .where(eq(purchases.id, purchaseId))
      .returning();

    return purchase ?? null;
  }

  async replaceLedgerEntries(
    shopId: string,
    entityType: "customer" | "supplier",
    entityId: string,
    entries: Array<typeof ledgerEntries.$inferInsert>,
    executor: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    await database
      .delete(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.shopId, shopId),
          eq(ledgerEntries.entityType, entityType),
          eq(ledgerEntries.entityId, entityId),
        ),
      );

    if (!entries.length) {
      return [];
    }

    return database.insert(ledgerEntries).values(entries).returning();
  }

  async listLedgerEntries(
    shopId: string,
    entityType: "customer" | "supplier",
    entityId: string,
    query: {
      page: number;
      pageSize: number;
      sortOrder: "asc" | "desc";
      dateFrom?: Date;
      dateTo?: Date;
    },
  ) {
    const filters = [
      eq(ledgerEntries.shopId, shopId),
      eq(ledgerEntries.entityType, entityType),
      eq(ledgerEntries.entityId, entityId),
    ];

    if (query.dateFrom) {
      filters.push(gte(ledgerEntries.entryDate, query.dateFrom));
    }

    if (query.dateTo) {
      filters.push(lte(ledgerEntries.entryDate, query.dateTo));
    }

    return getDbExecutor()
      .select({
        entry: ledgerEntries,
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(ledgerEntries)
      .leftJoin(users, eq(ledgerEntries.createdByUserId, users.id))
      .where(and(...filters))
      .orderBy(
        query.sortOrder === "asc" ? asc(ledgerEntries.entryDate) : desc(ledgerEntries.entryDate),
        query.sortOrder === "asc" ? asc(ledgerEntries.createdAt) : desc(ledgerEntries.createdAt),
        query.sortOrder === "asc" ? asc(ledgerEntries.id) : desc(ledgerEntries.id),
      )
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countLedgerEntries(
    shopId: string,
    entityType: "customer" | "supplier",
    entityId: string,
    query: {
      dateFrom?: Date;
      dateTo?: Date;
    },
  ) {
    const filters = [
      eq(ledgerEntries.shopId, shopId),
      eq(ledgerEntries.entityType, entityType),
      eq(ledgerEntries.entityId, entityId),
    ];

    if (query.dateFrom) {
      filters.push(gte(ledgerEntries.entryDate, query.dateFrom));
    }

    if (query.dateTo) {
      filters.push(lte(ledgerEntries.entryDate, query.dateTo));
    }

    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(ledgerEntries)
      .where(and(...filters));

    return result?.total ?? 0;
  }

  async listCustomerLedgerSources(
    shopId: string,
    customerId: string,
    executor?: DbExecutor,
  ) {
    const [salesRows, returnRows, paymentRows] = await runDbReads(
      [
        () =>
          getDbExecutor(executor)
            .select({
              id: sales.id,
              billNumber: sales.billNumber,
              amount: sales.grandTotal,
              initialPaidAmount: sales.initialPaidAmount,
              entryDate: sql<Date>`coalesce(${sales.completedAt}, ${sales.createdAt})`,
              createdAt: sales.createdAt,
              createdByUserId: sales.createdByUserId,
            })
            .from(sales)
            .where(
              and(
                eq(sales.shopId, shopId),
                eq(sales.customerId, customerId),
                eq(sales.status, "completed"),
              ),
            ),
        () =>
          getDbExecutor(executor)
            .select({
              id: saleReturns.id,
              returnNumber: saleReturns.returnNumber,
              amount: saleReturns.totalReturnAmount,
              refundAmount: saleReturns.refundAmount,
              refundMethod: saleReturns.refundMethod,
              entryDate: sql<Date>`coalesce(${saleReturns.completedAt}, ${saleReturns.createdAt})`,
              createdAt: saleReturns.createdAt,
              createdByUserId: saleReturns.createdByUserId,
            })
            .from(saleReturns)
            .innerJoin(sales, eq(saleReturns.saleId, sales.id))
            .where(
              and(
                eq(saleReturns.shopId, shopId),
                eq(sales.customerId, customerId),
                eq(saleReturns.status, "completed"),
              ),
            ),
        () =>
          getDbExecutor(executor)
            .select({
              id: customerPayments.id,
              amount: customerPayments.amount,
              paymentMethod: customerPayments.paymentMethod,
              entryDate: customerPayments.paymentDate,
              createdAt: customerPayments.createdAt,
              createdByUserId: customerPayments.receivedByUserId,
            })
            .from(customerPayments)
            .where(
              and(
                eq(customerPayments.shopId, shopId),
                eq(customerPayments.customerId, customerId),
                eq(customerPayments.status, "completed"),
              ),
            ),
      ] as const,
      executor,
    );

    return {
      sales: salesRows,
      returns: returnRows,
      payments: paymentRows,
    };
  }

  async listSupplierLedgerSources(
    shopId: string,
    supplierId: string,
    executor?: DbExecutor,
  ) {
    const [supplier, purchaseRows, returnRows, paymentRows] = await runDbReads(
      [
        () => this.findSupplierById(shopId, supplierId, executor),
        () =>
          getDbExecutor(executor)
            .select({
              id: purchases.id,
              purchaseNumber: purchases.purchaseNumber,
              amount: purchases.grandTotal,
              initialPaidAmount: purchases.initialPaidAmount,
              entryDate: purchases.purchaseDate,
              createdAt: purchases.createdAt,
              createdByUserId: purchases.createdByUserId,
            })
            .from(purchases)
            .where(
              and(
                eq(purchases.shopId, shopId),
                eq(purchases.supplierId, supplierId),
                eq(purchases.status, "finalized"),
              ),
            ),
        () =>
          getDbExecutor(executor)
            .select({
              id: purchaseReturns.id,
              returnNumber: purchaseReturns.returnNumber,
              amount: purchaseReturns.totalReturnAmount,
              refundAmount: purchaseReturns.refundAmount,
              refundMethod: purchaseReturns.refundMethod,
              entryDate:
                sql<Date>`coalesce(${purchaseReturns.completedAt}, ${purchaseReturns.createdAt})`,
              createdAt: purchaseReturns.createdAt,
              createdByUserId: purchaseReturns.createdByUserId,
            })
            .from(purchaseReturns)
            .where(
              and(
                eq(purchaseReturns.shopId, shopId),
                eq(purchaseReturns.supplierId, supplierId),
                eq(purchaseReturns.status, "completed"),
              ),
            ),
        () =>
          getDbExecutor(executor)
            .select({
              id: supplierPayments.id,
              amount: supplierPayments.amount,
              paymentMethod: supplierPayments.paymentMethod,
              entryDate: supplierPayments.paymentDate,
              createdAt: supplierPayments.createdAt,
              createdByUserId: supplierPayments.paidByUserId,
            })
            .from(supplierPayments)
            .where(
              and(
                eq(supplierPayments.shopId, shopId),
                eq(supplierPayments.supplierId, supplierId),
                eq(supplierPayments.status, "completed"),
              ),
            ),
      ] as const,
      executor,
    );

    return {
      supplier,
      purchases: purchaseRows,
      returns: returnRows,
      payments: paymentRows,
    };
  }
}
