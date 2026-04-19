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
  ne,
  or,
  sql,
} from "drizzle-orm";

import {
  customerCounters,
  customerPaymentAllocations,
  customerPayments,
  customers,
  sales,
  users,
} from "../../db/schema";
import { getDbExecutor, type DbExecutor } from "../../shared/db/executor";
import type {
  ListCustomerDueSummaryQuery,
  ListCustomerOptionsQuery,
  ListCustomerPaymentsQuery,
  ListCustomerPurchasesQuery,
  ListCustomersQuery,
} from "./customers.validation";

const buildCustomerFilters = (
  shopId: string,
  query: Pick<ListCustomersQuery, "search" | "status">,
) => {
  const filters = [eq(customers.shopId, shopId)];

  if (query.status) {
    filters.push(eq(customers.status, query.status));
  }

  if (query.search) {
    const digits = query.search.replace(/\D/g, "");

    filters.push(
      or(
        like(customers.fullNameNormalized, `%${query.search}%`),
        sql`lower(${customers.customerCode}) like ${`%${query.search}%`}`,
        like(customers.mobileNumber, `%${digits || query.search}%`),
        like(customers.emailNormalized, `%${query.search}%`),
      )!,
    );
  }

  return and(...filters);
};

const buildPurchaseFilters = (
  shopId: string,
  customerId: string,
  query: ListCustomerPurchasesQuery,
) => {
  const filters = [
    eq(sales.shopId, shopId),
    eq(sales.customerId, customerId),
    eq(sales.status, "completed"),
  ];

  if (query.dateFrom) {
    filters.push(gte(sql`coalesce(${sales.completedAt}, ${sales.createdAt})`, query.dateFrom));
  }

  if (query.dateTo) {
    filters.push(lte(sql`coalesce(${sales.completedAt}, ${sales.createdAt})`, query.dateTo));
  }

  return and(...filters);
};

const buildPaymentFilters = (
  shopId: string,
  customerId: string,
  query: ListCustomerPaymentsQuery,
) => {
  const filters = [
    eq(customerPayments.shopId, shopId),
    eq(customerPayments.customerId, customerId),
  ];

  if (query.dateFrom) {
    filters.push(gte(customerPayments.paymentDate, query.dateFrom));
  }

  if (query.dateTo) {
    filters.push(lte(customerPayments.paymentDate, query.dateTo));
  }

  return and(...filters);
};

const getCustomerSalesMetricsSubquery = (shopId: string, executor?: DbExecutor) =>
  getDbExecutor(executor)
    .select({
      customerId: sales.customerId,
      totalBills: sql<number>`count(*)`.as("total_bills"),
      totalPurchaseAmount:
        sql<string>`coalesce(sum(${sales.grandTotal}), 0.00)`.as(
          "total_purchase_amount",
        ),
      totalDueAmount:
        sql<string>`coalesce(sum(${sales.dueAmount}), 0.00)`.as(
          "total_due_amount",
        ),
      lastPurchaseDate:
        sql<Date | null>`max(coalesce(${sales.completedAt}, ${sales.createdAt}))`.as(
          "last_purchase_date",
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
    .as("customer_sales_metrics");

export class CustomersRepository {
  async listCustomers(shopId: string, query: ListCustomersQuery) {
    const database = getDbExecutor();
    const customerSalesMetrics = getCustomerSalesMetricsSubquery(shopId);

    const orderBy =
      query.sortBy === "customerCode"
        ? [
            query.sortOrder === "asc"
              ? asc(customers.customerCode)
              : desc(customers.customerCode),
            asc(customers.id),
          ]
        : query.sortBy === "createdAt"
          ? [
              query.sortOrder === "asc"
                ? asc(customers.createdAt)
                : desc(customers.createdAt),
              asc(customers.id),
            ]
          : query.sortBy === "updatedAt"
            ? [
                query.sortOrder === "asc"
                  ? asc(customers.updatedAt)
                  : desc(customers.updatedAt),
                asc(customers.id),
              ]
            : query.sortBy === "lastPurchaseDate"
              ? [
                  query.sortOrder === "asc"
                    ? asc(customerSalesMetrics.lastPurchaseDate)
                    : desc(customerSalesMetrics.lastPurchaseDate),
                  asc(customers.id),
                ]
              : query.sortBy === "totalPurchaseAmount"
                ? [
                    query.sortOrder === "asc"
                      ? asc(sql`coalesce(${customerSalesMetrics.totalPurchaseAmount}, 0.00)`)
                      : desc(sql`coalesce(${customerSalesMetrics.totalPurchaseAmount}, 0.00)`),
                    asc(customers.id),
                  ]
                : query.sortBy === "dueAmount"
                  ? [
                      query.sortOrder === "asc"
                        ? asc(sql`coalesce(${customerSalesMetrics.totalDueAmount}, 0.00)`)
                        : desc(sql`coalesce(${customerSalesMetrics.totalDueAmount}, 0.00)`),
                      asc(customers.id),
                    ]
                  : [
                      query.sortOrder === "asc"
                        ? asc(customers.fullNameNormalized)
                        : desc(customers.fullNameNormalized),
                      asc(customers.id),
                    ];

    return database
      .select({
        customer: customers,
        metrics: {
          totalBills: sql<number>`coalesce(${customerSalesMetrics.totalBills}, 0)`,
          totalPurchaseAmount: sql<string>`coalesce(${customerSalesMetrics.totalPurchaseAmount}, 0.00)`,
          totalDueAmount: sql<string>`coalesce(${customerSalesMetrics.totalDueAmount}, 0.00)`,
          lastPurchaseDate: customerSalesMetrics.lastPurchaseDate,
        },
      })
      .from(customers)
      .leftJoin(customerSalesMetrics, eq(customerSalesMetrics.customerId, customers.id))
      .where(buildCustomerFilters(shopId, query))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countCustomers(shopId: string, query: Pick<ListCustomersQuery, "search" | "status">) {
    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(customers)
      .where(buildCustomerFilters(shopId, query));

    return result?.total ?? 0;
  }

  async listCustomerOptions(shopId: string, query: ListCustomerOptionsQuery) {
    const customerSalesMetrics = getCustomerSalesMetricsSubquery(shopId);
    const filters = [
      eq(customers.shopId, shopId),
      eq(customers.status, "active"),
    ];

    if (query.search) {
      const digits = query.search.replace(/\D/g, "");
      filters.push(
        or(
          like(customers.fullNameNormalized, `%${query.search}%`),
          sql`lower(${customers.customerCode}) like ${`%${query.search}%`}`,
          like(customers.mobileNumber, `%${digits || query.search}%`),
        )!,
      );
    }

    return getDbExecutor()
      .select({
        customer: customers,
        metrics: {
          totalDueAmount: sql<string>`coalesce(${customerSalesMetrics.totalDueAmount}, 0.00)`,
          lastPurchaseDate: customerSalesMetrics.lastPurchaseDate,
        },
      })
      .from(customers)
      .leftJoin(customerSalesMetrics, eq(customerSalesMetrics.customerId, customers.id))
      .where(and(...filters))
      .orderBy(asc(customers.fullNameNormalized), asc(customers.id))
      .limit(query.pageSize);
  }

  async listCustomerDueSummaries(shopId: string, query: ListCustomerDueSummaryQuery) {
    const customerSalesMetrics = getCustomerSalesMetricsSubquery(shopId);
    const filters = [buildCustomerFilters(shopId, query)];

    filters.push(sql`coalesce(${customerSalesMetrics.totalDueAmount}, 0.00) > 0`);

    const orderBy =
      query.sortBy === "fullName"
        ? [
            query.sortOrder === "asc"
              ? asc(customers.fullNameNormalized)
              : desc(customers.fullNameNormalized),
            asc(customers.id),
          ]
        : query.sortBy === "lastPurchaseDate"
          ? [
              query.sortOrder === "asc"
                ? asc(customerSalesMetrics.lastPurchaseDate)
                : desc(customerSalesMetrics.lastPurchaseDate),
              asc(customers.id),
            ]
          : [
              query.sortOrder === "asc"
                ? asc(sql`coalesce(${customerSalesMetrics.totalDueAmount}, 0.00)`)
                : desc(sql`coalesce(${customerSalesMetrics.totalDueAmount}, 0.00)`),
              asc(customers.id),
            ];

    return getDbExecutor()
      .select({
        customer: customers,
        metrics: {
          totalBills: sql<number>`coalesce(${customerSalesMetrics.totalBills}, 0)`,
          totalPurchaseAmount: sql<string>`coalesce(${customerSalesMetrics.totalPurchaseAmount}, 0.00)`,
          totalDueAmount: sql<string>`coalesce(${customerSalesMetrics.totalDueAmount}, 0.00)`,
          lastPurchaseDate: customerSalesMetrics.lastPurchaseDate,
        },
      })
      .from(customers)
      .leftJoin(customerSalesMetrics, eq(customerSalesMetrics.customerId, customers.id))
      .where(and(...filters))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countCustomerDueSummaries(
    shopId: string,
    query: Pick<ListCustomerDueSummaryQuery, "search" | "status">,
  ) {
    const customerSalesMetrics = getCustomerSalesMetricsSubquery(shopId);
    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(customers)
      .leftJoin(customerSalesMetrics, eq(customerSalesMetrics.customerId, customers.id))
      .where(
        and(
          buildCustomerFilters(shopId, query),
          sql`coalesce(${customerSalesMetrics.totalDueAmount}, 0.00) > 0`,
        ),
      );

    return result?.total ?? 0;
  }

  async findCustomerById(shopId: string, customerId: string, executor?: DbExecutor) {
    const [customer] = await getDbExecutor(executor)
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.shopId, shopId)))
      .limit(1);

    return customer ?? null;
  }

  async findCustomerProfileById(shopId: string, customerId: string) {
    const customerSalesMetrics = getCustomerSalesMetricsSubquery(shopId);

    const [result] = await getDbExecutor()
      .select({
        customer: customers,
        metrics: {
          totalBills: sql<number>`coalesce(${customerSalesMetrics.totalBills}, 0)`,
          totalPurchaseAmount: sql<string>`coalesce(${customerSalesMetrics.totalPurchaseAmount}, 0.00)`,
          totalDueAmount: sql<string>`coalesce(${customerSalesMetrics.totalDueAmount}, 0.00)`,
          lastPurchaseDate: customerSalesMetrics.lastPurchaseDate,
        },
      })
      .from(customers)
      .leftJoin(customerSalesMetrics, eq(customerSalesMetrics.customerId, customers.id))
      .where(and(eq(customers.id, customerId), eq(customers.shopId, shopId)))
      .limit(1);

    return result ?? null;
  }

  async getCustomerPaymentSummary(shopId: string, customerId: string) {
    const [result] = await getDbExecutor()
      .select({
        totalPaymentsReceived: sql<string>`coalesce(sum(${customerPayments.amount}), 0.00)`,
        lastPaymentDate: sql<Date | null>`max(${customerPayments.paymentDate})`,
      })
      .from(customerPayments)
      .where(
        and(
          eq(customerPayments.shopId, shopId),
          eq(customerPayments.customerId, customerId),
        ),
      );

    return (
      result ?? {
        totalPaymentsReceived: "0.00",
        lastPaymentDate: null,
      }
    );
  }

  async findCustomerByMobile(
    shopId: string,
    mobileNumber: string,
    excludeId?: string,
  ) {
    const filters = [eq(customers.shopId, shopId), eq(customers.mobileNumber, mobileNumber)];

    if (excludeId) {
      filters.push(ne(customers.id, excludeId));
    }

    const [customer] = await getDbExecutor()
      .select({ id: customers.id })
      .from(customers)
      .where(and(...filters))
      .limit(1);

    return customer ?? null;
  }

  async findCustomerByEmail(shopId: string, emailNormalized: string, excludeId?: string) {
    const filters = [
      eq(customers.shopId, shopId),
      eq(customers.emailNormalized, emailNormalized),
    ];

    if (excludeId) {
      filters.push(ne(customers.id, excludeId));
    }

    const [customer] = await getDbExecutor()
      .select({ id: customers.id })
      .from(customers)
      .where(and(...filters))
      .limit(1);

    return customer ?? null;
  }

  async getNextCustomerSequence(shopId: string, executor: DbExecutor) {
    const [counter] = await getDbExecutor(executor)
      .insert(customerCounters)
      .values({
        shopId,
        lastSequence: 1,
      })
      .onConflictDoUpdate({
        target: customerCounters.shopId,
        set: {
          lastSequence: sql`${customerCounters.lastSequence} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning({
        lastSequence: customerCounters.lastSequence,
      });

    return counter?.lastSequence ?? 1;
  }

  async createCustomer(payload: typeof customers.$inferInsert, executor?: DbExecutor) {
    const [customer] = await getDbExecutor(executor)
      .insert(customers)
      .values(payload)
      .returning();

    return customer ?? null;
  }

  async updateCustomer(
    customerId: string,
    payload: Partial<typeof customers.$inferInsert>,
    executor?: DbExecutor,
  ) {
    const [customer] = await getDbExecutor(executor)
      .update(customers)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId))
      .returning();

    return customer ?? null;
  }

  async updateCustomerStatus(
    customerId: string,
    status: "active" | "inactive",
    executor?: DbExecutor,
  ) {
    const [customer] = await getDbExecutor(executor)
      .update(customers)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId))
      .returning();

    return customer ?? null;
  }

  async listCustomerPurchases(
    shopId: string,
    customerId: string,
    query: ListCustomerPurchasesQuery,
  ) {
    const orderBy =
      query.sortBy === "grandTotal"
        ? [
            query.sortOrder === "asc" ? asc(sales.grandTotal) : desc(sales.grandTotal),
            asc(sales.id),
          ]
        : query.sortBy === "dueAmount"
          ? [
              query.sortOrder === "asc" ? asc(sales.dueAmount) : desc(sales.dueAmount),
              asc(sales.id),
            ]
          : [
              query.sortOrder === "asc"
                ? asc(sql`coalesce(${sales.completedAt}, ${sales.createdAt})`)
                : desc(sql`coalesce(${sales.completedAt}, ${sales.createdAt})`),
              asc(sales.id),
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
      .where(buildPurchaseFilters(shopId, customerId, query))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async countCustomerPurchases(
    shopId: string,
    customerId: string,
    query: ListCustomerPurchasesQuery,
  ) {
    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(sales)
      .where(buildPurchaseFilters(shopId, customerId, query));

    return result?.total ?? 0;
  }

  async listCustomerPayments(
    shopId: string,
    customerId: string,
    query: ListCustomerPaymentsQuery,
  ) {
    const orderBy =
      query.sortBy === "createdAt"
        ? [
            query.sortOrder === "asc"
              ? asc(customerPayments.createdAt)
              : desc(customerPayments.createdAt),
            asc(customerPayments.id),
          ]
        : query.sortBy === "amount"
          ? [
              query.sortOrder === "asc"
                ? asc(customerPayments.amount)
                : desc(customerPayments.amount),
              asc(customerPayments.id),
            ]
          : [
              query.sortOrder === "asc"
                ? asc(customerPayments.paymentDate)
                : desc(customerPayments.paymentDate),
              asc(customerPayments.id),
            ];

    return getDbExecutor()
      .select({
        payment: customerPayments,
        receivedBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
        linkedSale: {
          id: sales.id,
          billNumber: sales.billNumber,
          billDate: sql<Date | null>`coalesce(${sales.completedAt}, ${sales.createdAt})`,
        },
      })
      .from(customerPayments)
      .innerJoin(users, eq(customerPayments.receivedByUserId, users.id))
      .leftJoin(sales, eq(customerPayments.saleId, sales.id))
      .where(buildPaymentFilters(shopId, customerId, query))
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  async findCustomerPaymentById(
    shopId: string,
    customerId: string,
    paymentId: string,
  ) {
    const [payment] = await getDbExecutor()
      .select({
        payment: customerPayments,
        receivedBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
        linkedSale: {
          id: sales.id,
          billNumber: sales.billNumber,
          billDate: sql<Date | null>`coalesce(${sales.completedAt}, ${sales.createdAt})`,
        },
      })
      .from(customerPayments)
      .innerJoin(users, eq(customerPayments.receivedByUserId, users.id))
      .leftJoin(sales, eq(customerPayments.saleId, sales.id))
      .where(
        and(
          eq(customerPayments.id, paymentId),
          eq(customerPayments.shopId, shopId),
          eq(customerPayments.customerId, customerId),
        ),
      )
      .limit(1);

    return payment ?? null;
  }

  async countCustomerPayments(
    shopId: string,
    customerId: string,
    query: ListCustomerPaymentsQuery,
  ) {
    const [result] = await getDbExecutor()
      .select({ total: count() })
      .from(customerPayments)
      .where(buildPaymentFilters(shopId, customerId, query));

    return result?.total ?? 0;
  }

  async listPaymentAllocationsByPaymentIds(
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

  async lockCustomerPayments(customerId: string, executor: DbExecutor) {
    await getDbExecutor(executor).execute(
      sql`select pg_advisory_xact_lock(hashtext(${`customer-payments:${customerId}`}))`,
    );
  }

  async listOutstandingSalesForCustomer(
    shopId: string,
    customerId: string,
    saleId: string | undefined,
    executor?: DbExecutor,
  ) {
    const filters = [
      eq(sales.shopId, shopId),
      eq(sales.customerId, customerId),
      eq(sales.status, "completed"),
      sql`${sales.dueAmount} > 0`,
    ];

    if (saleId) {
      filters.push(eq(sales.id, saleId));
    }

    return getDbExecutor(executor)
      .select({
        id: sales.id,
        billNumber: sales.billNumber,
        grandTotal: sales.grandTotal,
        paidAmount: sales.paidAmount,
        dueAmount: sales.dueAmount,
        paymentStatus: sales.paymentStatus,
        billDate: sql<Date | null>`coalesce(${sales.completedAt}, ${sales.createdAt})`,
      })
      .from(sales)
      .where(and(...filters))
      .orderBy(
        asc(sql`coalesce(${sales.completedAt}, ${sales.createdAt})`),
        asc(sales.id),
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

  async updateSalePaymentAmounts(
    saleId: string,
    payload: Pick<typeof sales.$inferInsert, "paidAmount" | "dueAmount" | "paymentStatus" | "updatedByUserId">,
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
}
