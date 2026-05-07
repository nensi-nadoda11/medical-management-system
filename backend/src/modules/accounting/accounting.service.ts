import { db } from "../../db/client";
import { AppError } from "../../shared/errors/app-error";
import { logger } from "../../shared/logger";
import {
  moneyMinorUnitsToString,
  sumMoneyMinorUnits,
  toMoneyMinorUnits,
} from "../../shared/utils/money";
import { collapseWhitespace } from "../../shared/utils/strings";
import { AccountingLedgerService } from "./accounting-ledger.service";
import { AccountingRepository } from "./accounting.repository";
import { AlertsService } from "../alerts/alerts.service";
import type {
  CreateAccountingCustomerPaymentInput,
  CreateAccountingSupplierPaymentInput,
  ListAccountingCustomerPaymentsQuery,
  ListAccountingSupplierPaymentsQuery,
  ListOutstandingCustomersQuery,
  ListOutstandingSuppliersQuery,
} from "./accounting.validation";

const buildAppError = (statusCode: number, code: string, message: string) =>
  new AppError({
    statusCode,
    code,
    message,
  });

const normalizeSearchValue = (value: string) =>
  collapseWhitespace(value).toLowerCase();

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

const toCustomerPaymentResponse = (
  record: Awaited<ReturnType<AccountingRepository["listCustomerPayments"]>>[number],
  allocations: Awaited<
    ReturnType<AccountingRepository["listCustomerPaymentAllocationsByPaymentIds"]>
  >,
) => ({
  id: record.payment.id,
  customerId: record.payment.customerId,
  saleId: record.payment.saleId,
  amount: record.payment.amount,
  paymentMethod: record.payment.paymentMethod,
  status: record.payment.status,
  referenceNumber: record.payment.referenceNumber,
  notes: record.payment.notes,
  paymentDate: record.payment.paymentDate,
  createdAt: record.payment.createdAt,
  updatedAt: record.payment.updatedAt,
  customer: record.customer,
  linkedSale: record.linkedSale,
  receivedBy: record.receivedBy,
  allocations: allocations.map((allocation) => ({
    saleId: allocation.sale.id,
    billNumber: allocation.sale.billNumber,
    billDate: allocation.sale.billDate,
    amount: allocation.allocation.amount,
    grandTotal: allocation.sale.grandTotal,
    dueAmount: allocation.sale.dueAmount,
    paymentStatus: allocation.sale.paymentStatus,
  })),
});

const toSupplierPaymentResponse = (
  record: Awaited<ReturnType<AccountingRepository["listSupplierPayments"]>>[number],
  allocations: Awaited<
    ReturnType<AccountingRepository["listSupplierPaymentAllocationsByPaymentIds"]>
  >,
) => ({
  id: record.payment.id,
  supplierId: record.payment.supplierId,
  purchaseId: record.payment.purchaseId,
  amount: record.payment.amount,
  paymentMethod: record.payment.paymentMethod,
  status: record.payment.status,
  referenceNumber: record.payment.referenceNumber,
  notes: record.payment.notes,
  paymentDate: record.payment.paymentDate,
  createdAt: record.payment.createdAt,
  updatedAt: record.payment.updatedAt,
  supplier: record.supplier,
  linkedPurchase: record.linkedPurchase,
  paidBy: record.paidBy,
  allocations: allocations.map((allocation) => ({
    purchaseId: allocation.purchase.id,
    purchaseNumber: allocation.purchase.purchaseNumber,
    purchaseDate: allocation.purchase.purchaseDate,
    amount: allocation.allocation.amount,
    grandTotal: allocation.purchase.grandTotal,
    dueAmount: allocation.purchase.dueAmount,
    paymentStatus: allocation.purchase.paymentStatus,
  })),
});

export class AccountingService {
  constructor(
    private readonly accountingRepository = new AccountingRepository(),
    private readonly accountingLedgerService = new AccountingLedgerService(),
    private readonly alertsService = new AlertsService(),
  ) {}

  async listCustomerPayments(shopId: string, query: ListAccountingCustomerPaymentsQuery) {
    const normalizedQuery = {
      ...query,
      search: query.search ? normalizeSearchValue(query.search) : undefined,
    };
    const [items, total, summary] = await Promise.all([
      this.accountingRepository.listCustomerPayments(shopId, normalizedQuery),
      this.accountingRepository.countCustomerPayments(shopId, normalizedQuery),
      this.accountingRepository.getCustomerPaymentsSummary(shopId, normalizedQuery),
    ]);
    const allocations =
      await this.accountingRepository.listCustomerPaymentAllocationsByPaymentIds(
        shopId,
        items.map((item) => item.payment.id),
      );
    const allocationsByPaymentId = new Map<
      string,
      typeof allocations
    >();

    for (const allocation of allocations) {
      const existing =
        allocationsByPaymentId.get(allocation.allocation.customerPaymentId) ?? [];
      existing.push(allocation);
      allocationsByPaymentId.set(allocation.allocation.customerPaymentId, existing);
    }

    return {
      summary,
      ...buildPaginatedResponse(
        items.map((item) =>
          toCustomerPaymentResponse(
            item,
            allocationsByPaymentId.get(item.payment.id) ?? [],
          ),
        ),
        total,
        normalizedQuery.page,
        normalizedQuery.pageSize,
      ),
    };
  }

  async createCustomerPayment(
    shopId: string,
    receivedByUserId: string,
    input: CreateAccountingCustomerPaymentInput,
  ) {
    const customer = await this.accountingRepository.findCustomerById(
      shopId,
      input.customerId,
    );

    if (!customer) {
      throw buildAppError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    }

    if (customer.status !== "active") {
      throw buildAppError(
        400,
        "CUSTOMER_INACTIVE",
        "Only active customers can receive payments.",
      );
    }

    const paymentMinorUnits = toMoneyMinorUnits(input.amount);

    if (paymentMinorUnits <= 0) {
      throw buildAppError(400, "INVALID_PAYMENT_AMOUNT", "Amount must be greater than zero.");
    }

    const result = await db.transaction(async (tx) => {
      await this.accountingRepository.lockCustomerPayments(input.customerId, tx);

      const openSales = await this.accountingRepository.listOpenSalesForCustomer(
        shopId,
        input.customerId,
        tx,
      );

      if (input.saleId && !openSales.some((item) => item.sale.id === input.saleId)) {
        throw buildAppError(
          400,
          "SALE_NOT_OPEN_FOR_PAYMENT",
          "The selected bill is not available for payment.",
        );
      }

      const targetSales = input.saleId
        ? openSales.filter((item) => item.sale.id === input.saleId)
        : openSales;

      if (input.saleId && !targetSales.length) {
        throw buildAppError(
          400,
          "SALE_NOT_OPEN_FOR_PAYMENT",
          "The selected bill has no outstanding due.",
        );
      }

      let remainingMinorUnits = paymentMinorUnits;
      const allocations = targetSales
        .map((item) => {
          if (remainingMinorUnits <= 0) {
            return null;
          }

          const openDueMinorUnits = toMoneyMinorUnits(item.openDue);
          const allocatedMinorUnits = Math.min(remainingMinorUnits, openDueMinorUnits);
          remainingMinorUnits -= allocatedMinorUnits;

          return allocatedMinorUnits > 0
            ? {
                saleId: item.sale.id,
                amountMinorUnits: allocatedMinorUnits,
              }
            : null;
        })
        .filter((value): value is NonNullable<typeof value> => Boolean(value));

      const created = await this.accountingRepository.createCustomerPayment(
        {
          shopId,
          customerId: input.customerId,
          saleId: input.saleId,
          amount: moneyMinorUnitsToString(paymentMinorUnits),
          paymentMethod: input.paymentMethod,
          status: "completed",
          referenceNumber: input.referenceNumber,
          notes: input.notes,
          paymentDate: input.paymentDate,
          receivedByUserId,
        },
        allocations.map((allocation) => ({
          shopId,
          customerId: input.customerId,
          saleId: allocation.saleId,
          amount: moneyMinorUnitsToString(allocation.amountMinorUnits),
        })),
        tx,
      );

      for (const allocation of allocations) {
        await this.accountingLedgerService.syncCustomerSaleFinancials(
          shopId,
          allocation.saleId,
          receivedByUserId,
          tx,
        );
      }

      await this.accountingLedgerService.rebuildCustomerLedger(
        shopId,
        input.customerId,
        tx,
      );

      const paymentRecord = await this.accountingRepository.findCustomerPaymentById(
        shopId,
        created.payment.id,
        tx,
      );
      const paymentAllocations =
        await this.accountingRepository.listCustomerPaymentAllocationsByPaymentIds(
          shopId,
          [created.payment.id],
          tx,
        );

      return paymentRecord
        ? toCustomerPaymentResponse(paymentRecord, paymentAllocations)
        : null;
    });

    if (!result) {
      throw buildAppError(
        500,
        "CUSTOMER_PAYMENT_FETCH_FAILED",
        "Payment was recorded but could not be loaded.",
      );
    }

    try {
      await this.alertsService.syncCustomerDueNotification(shopId, input.customerId);
    } catch (error) {
      logger.error("Customer payment recorded but due notification sync failed", {
        customerId: input.customerId,
        shopId,
        paymentId: result.id,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return result;
  }

  async getCustomerDueSummary(shopId: string, customerId: string) {
    const customerSummary = await this.accountingRepository.getCustomerFinancialSummary(
      shopId,
      customerId,
    );

    if (!customerSummary) {
      throw buildAppError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    }

    const openSales = await this.accountingRepository.listOpenSalesForCustomer(
      shopId,
      customerId,
    );

    return {
      customer: {
        id: customerSummary.customer.id,
        customerCode: customerSummary.customer.customerCode,
        fullName: customerSummary.customer.fullName,
        mobileNumber: customerSummary.customer.mobileNumber,
        status: customerSummary.customer.status,
      },
      summary: customerSummary.summary,
      openSales: openSales.map((item) => ({
        id: item.sale.id,
        billNumber: item.sale.billNumber,
        billDate: item.sale.completedAt ?? item.sale.createdAt,
        grandTotal: item.sale.grandTotal,
        netTotal: item.netTotal,
        returnedAmount: item.returnedAmount,
        initialPaidAmount: item.sale.initialPaidAmount,
        allocatedAmount: item.allocatedAmount,
        dueAmount: item.openDue,
        paymentStatus: item.sale.paymentStatus,
      })),
    };
  }

  async listOutstandingCustomers(shopId: string, query: ListOutstandingCustomersQuery) {
    const normalizedQuery = {
      ...query,
      search: query.search ? normalizeSearchValue(query.search) : undefined,
    };
    const [summary, items, total] = await Promise.all([
      this.accountingRepository.getOutstandingCustomersSummary(shopId, normalizedQuery),
      this.accountingRepository.listOutstandingCustomers(shopId, normalizedQuery),
      this.accountingRepository.countOutstandingCustomers(shopId, normalizedQuery),
    ]);

    return {
      summary,
      ...buildPaginatedResponse(
        items.map((item) => ({
          id: item.customer.id,
          customerCode: item.customer.customerCode,
          fullName: item.customer.fullName,
          mobileNumber: item.customer.mobileNumber,
          status: item.customer.status,
          summary: item.summary,
        })),
        total,
        normalizedQuery.page,
        normalizedQuery.pageSize,
      ),
    };
  }

  async getCustomerLedger(
    shopId: string,
    customerId: string,
    query: {
      page: number;
      pageSize: number;
      sortOrder: "asc" | "desc";
      dateFrom?: Date;
      dateTo?: Date;
    },
  ) {
    const customer = await this.accountingRepository.findCustomerById(
      shopId,
      customerId,
    );

    if (!customer) {
      throw buildAppError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    }

    await db.transaction(async (tx) => {
      await this.accountingLedgerService.rebuildCustomerLedger(shopId, customerId, tx);
    });

    const [summary, items, total] = await Promise.all([
      this.accountingRepository.getCustomerFinancialSummary(shopId, customerId),
      this.accountingRepository.listLedgerEntries(shopId, "customer", customerId, query),
      this.accountingRepository.countLedgerEntries(shopId, "customer", customerId, query),
    ]);

    return {
      customer: {
        id: customer.id,
        customerCode: customer.customerCode,
        fullName: customer.fullName,
        mobileNumber: customer.mobileNumber,
        status: customer.status,
      },
      summary: summary?.summary ?? null,
      ledger: buildPaginatedResponse(
        items.map((item) => ({
          ...item.entry,
          createdBy: item.createdBy,
        })),
        total,
        query.page,
        query.pageSize,
      ),
    };
  }

  async listSupplierPayments(shopId: string, query: ListAccountingSupplierPaymentsQuery) {
    const normalizedQuery = {
      ...query,
      search: query.search ? normalizeSearchValue(query.search) : undefined,
    };
    const [items, total, summary] = await Promise.all([
      this.accountingRepository.listSupplierPayments(shopId, normalizedQuery),
      this.accountingRepository.countSupplierPayments(shopId, normalizedQuery),
      this.accountingRepository.getSupplierPaymentsSummary(shopId, normalizedQuery),
    ]);
    const allocations =
      await this.accountingRepository.listSupplierPaymentAllocationsByPaymentIds(
        shopId,
        items.map((item) => item.payment.id),
      );
    const allocationsByPaymentId = new Map<
      string,
      typeof allocations
    >();

    for (const allocation of allocations) {
      const existing =
        allocationsByPaymentId.get(allocation.allocation.supplierPaymentId) ?? [];
      existing.push(allocation);
      allocationsByPaymentId.set(allocation.allocation.supplierPaymentId, existing);
    }

    return {
      summary,
      ...buildPaginatedResponse(
        items.map((item) =>
          toSupplierPaymentResponse(
            item,
            allocationsByPaymentId.get(item.payment.id) ?? [],
          ),
        ),
        total,
        normalizedQuery.page,
        normalizedQuery.pageSize,
      ),
    };
  }

  async createSupplierPayment(
    shopId: string,
    paidByUserId: string,
    input: CreateAccountingSupplierPaymentInput,
  ) {
    const supplier = await this.accountingRepository.findSupplierById(
      shopId,
      input.supplierId,
    );

    if (!supplier) {
      throw buildAppError(404, "SUPPLIER_NOT_FOUND", "Supplier not found.");
    }

    if (supplier.status !== "active") {
      throw buildAppError(
        400,
        "SUPPLIER_INACTIVE",
        "Only active suppliers can receive payments.",
      );
    }

    const paymentMinorUnits = toMoneyMinorUnits(input.amount);

    if (paymentMinorUnits <= 0) {
      throw buildAppError(400, "INVALID_PAYMENT_AMOUNT", "Amount must be greater than zero.");
    }

    const result = await db.transaction(async (tx) => {
      await this.accountingRepository.lockSupplierPayments(input.supplierId, tx);

      const openPurchases =
        await this.accountingRepository.listOpenPurchasesForSupplier(
          shopId,
          input.supplierId,
          tx,
        );

      if (
        input.purchaseId &&
        !openPurchases.some((item) => item.purchase.id === input.purchaseId)
      ) {
        throw buildAppError(
          400,
          "PURCHASE_NOT_OPEN_FOR_PAYMENT",
          "The selected purchase is not available for payment.",
        );
      }

      const targetPurchases = input.purchaseId
        ? openPurchases.filter((item) => item.purchase.id === input.purchaseId)
        : openPurchases;

      if (input.purchaseId && !targetPurchases.length) {
        throw buildAppError(
          400,
          "PURCHASE_NOT_OPEN_FOR_PAYMENT",
          "The selected purchase has no outstanding due.",
        );
      }

      let remainingMinorUnits = paymentMinorUnits;
      const allocations = targetPurchases
        .map((item) => {
          if (remainingMinorUnits <= 0) {
            return null;
          }

          const openDueMinorUnits = toMoneyMinorUnits(item.openDue);
          const allocatedMinorUnits = Math.min(remainingMinorUnits, openDueMinorUnits);
          remainingMinorUnits -= allocatedMinorUnits;

          return allocatedMinorUnits > 0
            ? {
                purchaseId: item.purchase.id,
                amountMinorUnits: allocatedMinorUnits,
              }
            : null;
        })
        .filter((value): value is NonNullable<typeof value> => Boolean(value));

      const created = await this.accountingRepository.createSupplierPayment(
        {
          shopId,
          supplierId: input.supplierId,
          purchaseId: input.purchaseId,
          amount: moneyMinorUnitsToString(paymentMinorUnits),
          paymentMethod: input.paymentMethod,
          status: "completed",
          referenceNumber: input.referenceNumber,
          notes: input.notes,
          paymentDate: input.paymentDate,
          paidByUserId,
        },
        allocations.map((allocation) => ({
          shopId,
          supplierId: input.supplierId,
          purchaseId: allocation.purchaseId,
          amount: moneyMinorUnitsToString(allocation.amountMinorUnits),
        })),
        tx,
      );

      for (const allocation of allocations) {
        await this.accountingLedgerService.syncSupplierPurchaseFinancials(
          shopId,
          allocation.purchaseId,
          paidByUserId,
          tx,
        );
      }

      await this.accountingLedgerService.rebuildSupplierLedger(
        shopId,
        input.supplierId,
        tx,
      );

      const paymentRecord = await this.accountingRepository.findSupplierPaymentById(
        shopId,
        created.payment.id,
        tx,
      );
      const paymentAllocations =
        await this.accountingRepository.listSupplierPaymentAllocationsByPaymentIds(
          shopId,
          [created.payment.id],
          tx,
        );

      return paymentRecord
        ? toSupplierPaymentResponse(paymentRecord, paymentAllocations)
        : null;
    });

    if (!result) {
      throw buildAppError(
        500,
        "SUPPLIER_PAYMENT_FETCH_FAILED",
        "Payment was recorded but could not be loaded.",
      );
    }

    try {
      await this.alertsService.syncSupplierPayableNotification(shopId, input.supplierId);
    } catch (error) {
      logger.error("Supplier payment recorded but payable notification sync failed", {
        supplierId: input.supplierId,
        shopId,
        paymentId: result.id,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return result;
  }

  async getSupplierDueSummary(shopId: string, supplierId: string) {
    const supplierSummary = await this.accountingRepository.getSupplierFinancialSummary(
      shopId,
      supplierId,
    );

    if (!supplierSummary) {
      throw buildAppError(404, "SUPPLIER_NOT_FOUND", "Supplier not found.");
    }

    const openPurchases = await this.accountingRepository.listOpenPurchasesForSupplier(
      shopId,
      supplierId,
    );

    return {
      supplier: {
        id: supplierSummary.supplier.id,
        supplierName: supplierSummary.supplier.supplierName,
        companyName: supplierSummary.supplier.companyName,
        mobileNumber: supplierSummary.supplier.mobileNumber,
        status: supplierSummary.supplier.status,
      },
      summary: supplierSummary.summary,
      openPurchases: openPurchases.map((item) => ({
        id: item.purchase.id,
        purchaseNumber: item.purchase.purchaseNumber,
        purchaseDate: item.purchase.purchaseDate,
        grandTotal: item.purchase.grandTotal,
        initialPaidAmount: item.purchase.initialPaidAmount,
        allocatedAmount: item.allocatedAmount,
        dueAmount: item.openDue,
        paymentStatus: item.purchase.paymentStatus,
      })),
    };
  }

  async listOutstandingSuppliers(shopId: string, query: ListOutstandingSuppliersQuery) {
    const normalizedQuery = {
      ...query,
      search: query.search ? normalizeSearchValue(query.search) : undefined,
    };
    const [summary, items, total] = await Promise.all([
      this.accountingRepository.getOutstandingSuppliersSummary(shopId, normalizedQuery),
      this.accountingRepository.listOutstandingSuppliers(shopId, normalizedQuery),
      this.accountingRepository.countOutstandingSuppliers(shopId, normalizedQuery),
    ]);

    return {
      summary,
      ...buildPaginatedResponse(
        items.map((item) => ({
          id: item.supplier.id,
          supplierName: item.supplier.supplierName,
          companyName: item.supplier.companyName,
          mobileNumber: item.supplier.mobileNumber,
          status: item.supplier.status,
          summary: item.summary,
        })),
        total,
        normalizedQuery.page,
        normalizedQuery.pageSize,
      ),
    };
  }

  async getSupplierLedger(
    shopId: string,
    supplierId: string,
    query: {
      page: number;
      pageSize: number;
      sortOrder: "asc" | "desc";
      dateFrom?: Date;
      dateTo?: Date;
    },
  ) {
    const supplier = await this.accountingRepository.findSupplierById(
      shopId,
      supplierId,
    );

    if (!supplier) {
      throw buildAppError(404, "SUPPLIER_NOT_FOUND", "Supplier not found.");
    }

    await db.transaction(async (tx) => {
      await this.accountingLedgerService.rebuildSupplierLedger(shopId, supplierId, tx);
    });

    const [summary, items, total] = await Promise.all([
      this.accountingRepository.getSupplierFinancialSummary(shopId, supplierId),
      this.accountingRepository.listLedgerEntries(shopId, "supplier", supplierId, query),
      this.accountingRepository.countLedgerEntries(shopId, "supplier", supplierId, query),
    ]);

    return {
      supplier: {
        id: supplier.id,
        supplierName: supplier.supplierName,
        companyName: supplier.companyName,
        mobileNumber: supplier.mobileNumber,
        status: supplier.status,
      },
      summary: summary?.summary ?? null,
      ledger: buildPaginatedResponse(
        items.map((item) => ({
          ...item.entry,
          createdBy: item.createdBy,
        })),
        total,
        query.page,
        query.pageSize,
      ),
    };
  }

  async listSupplierOptions(shopId: string, search: string | undefined, pageSize: number) {
    const items = await this.accountingRepository.listSupplierOptions(
      shopId,
      search ? normalizeSearchValue(search) : undefined,
      pageSize,
    );

    return {
      items: items.map((item) => ({
        id: item.supplier.id,
        supplierName: item.supplier.supplierName,
        companyName: item.supplier.companyName,
        mobileNumber: item.supplier.mobileNumber,
        status: item.supplier.status,
        openingBalance: item.supplier.openingBalance,
      })),
    };
  }
}
