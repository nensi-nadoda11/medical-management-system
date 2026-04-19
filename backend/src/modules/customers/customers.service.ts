import { db } from "../../db/client";
import { AppError } from "../../shared/errors/app-error";
import {
  moneyMinorUnitsToString,
  sumMoneyMinorUnits,
  toMoneyMinorUnits,
} from "../../shared/utils/money";
import { collapseWhitespace } from "../../shared/utils/strings";
import { CustomersRepository } from "./customers.repository";
import type {
  CreateCustomerInput,
  CreateCustomerPaymentInput,
  ListCustomerDueSummaryQuery,
  ListCustomerOptionsQuery,
  ListCustomerPaymentsQuery,
  ListCustomerPurchasesQuery,
  ListCustomersQuery,
  UpdateCustomerInput,
  UpdateCustomerStatusInput,
} from "./customers.validation";

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

const buildCustomerCode = (sequence: number) =>
  `CUST-${sequence.toString().padStart(4, "0")}`;

const mapSalePaymentStatus = (paidMinorUnits: number, grandTotalMinorUnits: number) => {
  if (paidMinorUnits <= 0) {
    return "unpaid" as const;
  }

  if (paidMinorUnits >= grandTotalMinorUnits) {
    return "paid" as const;
  }

  return "partial" as const;
};

const toCustomerResponse = (
  record: Awaited<ReturnType<CustomersRepository["listCustomers"]>>[number],
) => ({
  id: record.customer.id,
  shopId: record.customer.shopId,
  customerCode: record.customer.customerCode,
  fullName: record.customer.fullName,
  mobileNumber: record.customer.mobileNumber,
  alternateMobileNumber: record.customer.alternateMobileNumber,
  email: record.customer.email,
  gender: record.customer.gender,
  age: record.customer.age,
  dateOfBirth: record.customer.dateOfBirth,
  addressLine1: record.customer.addressLine1,
  addressLine2: record.customer.addressLine2,
  city: record.customer.city,
  state: record.customer.state,
  pincode: record.customer.pincode,
  notes: record.customer.notes,
  status: record.customer.status,
  createdAt: record.customer.createdAt,
  updatedAt: record.customer.updatedAt,
  summary: {
    totalBills: Number(record.metrics.totalBills ?? 0),
    totalPurchaseAmount: record.metrics.totalPurchaseAmount ?? "0.00",
    totalDueAmount: record.metrics.totalDueAmount ?? "0.00",
    lastPurchaseDate: record.metrics.lastPurchaseDate,
  },
});

const toCustomerOptionResponse = (
  record: Awaited<ReturnType<CustomersRepository["listCustomerOptions"]>>[number],
) => ({
  id: record.customer.id,
  customerCode: record.customer.customerCode,
  fullName: record.customer.fullName,
  mobileNumber: record.customer.mobileNumber,
  city: record.customer.city,
  status: record.customer.status,
  totalDueAmount: record.metrics.totalDueAmount ?? "0.00",
  lastPurchaseDate: record.metrics.lastPurchaseDate,
});

const toCustomerPurchaseResponse = (
  record: Awaited<ReturnType<CustomersRepository["listCustomerPurchases"]>>[number],
) => ({
  id: record.sale.id,
  billNumber: record.sale.billNumber,
  billDate: record.sale.completedAt ?? record.sale.createdAt,
  grandTotal: record.sale.grandTotal,
  paidAmount: record.sale.paidAmount,
  dueAmount: record.sale.dueAmount,
  paymentStatus: record.sale.paymentStatus,
  paymentMethod: record.sale.paymentMethod,
  createdBy: record.createdBy,
});

type PaymentRecord = Awaited<
  ReturnType<CustomersRepository["listCustomerPayments"]>
>[number];

type PaymentAllocationRecord = Awaited<
  ReturnType<CustomersRepository["listPaymentAllocationsByPaymentIds"]>
>[number];

const toCustomerPaymentResponse = (
  record: PaymentRecord,
  allocations: PaymentAllocationRecord[],
) => ({
  id: record.payment.id,
  customerId: record.payment.customerId,
  saleId: record.payment.saleId,
  linkedBillNumber: record.linkedSale?.billNumber ?? null,
  amount: record.payment.amount,
  paymentMethod: record.payment.paymentMethod,
  referenceNumber: record.payment.referenceNumber,
  notes: record.payment.notes,
  paymentDate: record.payment.paymentDate,
  createdAt: record.payment.createdAt,
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

export class CustomersService {
  constructor(private readonly customersRepository = new CustomersRepository()) {}

  async listCustomers(shopId: string, query: ListCustomersQuery) {
    const normalizedQuery = {
      ...query,
      search: query.search ? normalizeSearchValue(query.search) : undefined,
    };

    const [items, total] = await Promise.all([
      this.customersRepository.listCustomers(shopId, normalizedQuery),
      this.customersRepository.countCustomers(shopId, normalizedQuery),
    ]);

    return buildPaginatedResponse(
      items.map(toCustomerResponse),
      total,
      normalizedQuery.page,
      normalizedQuery.pageSize,
    );
  }

  async listCustomerOptions(shopId: string, query: ListCustomerOptionsQuery) {
    const items = await this.customersRepository.listCustomerOptions(shopId, {
      ...query,
      search: query.search ? normalizeSearchValue(query.search) : undefined,
    });

    return {
      items: items.map(toCustomerOptionResponse),
    };
  }

  async listCustomerDueSummaries(shopId: string, query: ListCustomerDueSummaryQuery) {
    const normalizedQuery = {
      ...query,
      search: query.search ? normalizeSearchValue(query.search) : undefined,
    };

    const [items, total] = await Promise.all([
      this.customersRepository.listCustomerDueSummaries(shopId, normalizedQuery),
      this.customersRepository.countCustomerDueSummaries(shopId, normalizedQuery),
    ]);

    return buildPaginatedResponse(
      items.map(toCustomerResponse),
      total,
      normalizedQuery.page,
      normalizedQuery.pageSize,
    );
  }

  async getCustomerById(shopId: string, customerId: string) {
    const customerProfile = await this.customersRepository.findCustomerProfileById(
      shopId,
      customerId,
    );

    if (!customerProfile) {
      throw buildAppError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    }

    const [paymentSummary, recentPurchases, recentPayments] = await Promise.all([
      this.customersRepository.getCustomerPaymentSummary(shopId, customerId),
      this.customersRepository.listCustomerPurchases(shopId, customerId, {
        page: 1,
        pageSize: 10,
        sortBy: "billDate",
        sortOrder: "desc",
      }),
      this.listCustomerPaymentsInternal(shopId, customerId, {
        page: 1,
        pageSize: 10,
        sortBy: "paymentDate",
        sortOrder: "desc",
      }),
    ]);

    return {
      ...toCustomerResponse(customerProfile),
      summary: {
        totalBills: Number(customerProfile.metrics.totalBills ?? 0),
        totalPurchaseAmount: customerProfile.metrics.totalPurchaseAmount ?? "0.00",
        totalDueAmount: customerProfile.metrics.totalDueAmount ?? "0.00",
        lastPurchaseDate: customerProfile.metrics.lastPurchaseDate,
        totalPaymentsReceived: paymentSummary.totalPaymentsReceived ?? "0.00",
        lastPaymentDate: paymentSummary.lastPaymentDate,
      },
      recentPurchases: recentPurchases.map(toCustomerPurchaseResponse),
      recentPayments: recentPayments.items,
    };
  }

  async createCustomer(shopId: string, input: CreateCustomerInput) {
    await this.assertCustomerUniqueness(shopId, input.mobileNumber, input.email);

    const createdCustomerId = await db.transaction(async (tx) => {
      const nextSequence = await this.customersRepository.getNextCustomerSequence(
        shopId,
        tx,
      );
      const createdCustomer = await this.customersRepository.createCustomer(
        {
          shopId,
          customerSequence: nextSequence,
          customerCode: buildCustomerCode(nextSequence),
          fullName: input.fullName,
          fullNameNormalized: normalizeSearchValue(input.fullName),
          mobileNumber: input.mobileNumber,
          alternateMobileNumber: input.alternateMobileNumber,
          email: input.email,
          emailNormalized: input.email,
          gender: input.gender,
          age: input.age,
          dateOfBirth: input.dateOfBirth,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          city: input.city,
          state: input.state,
          pincode: input.pincode,
          notes: input.notes,
          status: input.status,
        },
        tx,
      );

      if (!createdCustomer) {
        throw buildAppError(
          500,
          "CUSTOMER_CREATE_FAILED",
          "Failed to create customer.",
        );
      }

      return createdCustomer.id;
    });

    return this.getCustomerById(shopId, createdCustomerId);
  }

  async updateCustomer(shopId: string, customerId: string, input: UpdateCustomerInput) {
    const existingCustomer = await this.ensureCustomerExists(shopId, customerId);
    const nextMobileNumber = input.mobileNumber ?? existingCustomer.mobileNumber;
    const nextEmail =
      input.email !== undefined ? input.email : existingCustomer.email ?? undefined;

    await this.assertCustomerUniqueness(
      shopId,
      nextMobileNumber,
      nextEmail,
      customerId,
    );

    const updatedCustomer = await this.customersRepository.updateCustomer(customerId, {
      ...(input.fullName !== undefined
        ? {
            fullName: input.fullName,
            fullNameNormalized: normalizeSearchValue(input.fullName),
          }
        : {}),
      ...(input.mobileNumber !== undefined ? { mobileNumber: input.mobileNumber } : {}),
      ...(input.alternateMobileNumber !== undefined
        ? { alternateMobileNumber: input.alternateMobileNumber }
        : {}),
      ...(input.email !== undefined
        ? { email: input.email, emailNormalized: input.email }
        : {}),
      ...(input.gender !== undefined ? { gender: input.gender } : {}),
      ...(input.age !== undefined ? { age: input.age } : {}),
      ...(input.dateOfBirth !== undefined ? { dateOfBirth: input.dateOfBirth } : {}),
      ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
      ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.pincode !== undefined ? { pincode: input.pincode } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    });

    if (!updatedCustomer) {
      throw buildAppError(
        500,
        "CUSTOMER_UPDATE_FAILED",
        "Failed to update customer.",
      );
    }

    return this.getCustomerById(shopId, customerId);
  }

  async updateCustomerStatus(
    shopId: string,
    customerId: string,
    input: UpdateCustomerStatusInput,
  ) {
    await this.ensureCustomerExists(shopId, customerId);

    const updatedCustomer = await this.customersRepository.updateCustomerStatus(
      customerId,
      input.status,
    );

    if (!updatedCustomer) {
      throw buildAppError(
        500,
        "CUSTOMER_STATUS_UPDATE_FAILED",
        "Failed to update customer status.",
      );
    }

    return this.getCustomerById(shopId, customerId);
  }

  async listCustomerPurchases(
    shopId: string,
    customerId: string,
    query: ListCustomerPurchasesQuery,
  ) {
    await this.ensureCustomerExists(shopId, customerId);

    const [items, total] = await Promise.all([
      this.customersRepository.listCustomerPurchases(shopId, customerId, query),
      this.customersRepository.countCustomerPurchases(shopId, customerId, query),
    ]);

    return buildPaginatedResponse(
      items.map(toCustomerPurchaseResponse),
      total,
      query.page,
      query.pageSize,
    );
  }

  async listCustomerPayments(
    shopId: string,
    customerId: string,
    query: ListCustomerPaymentsQuery,
  ) {
    await this.ensureCustomerExists(shopId, customerId);
    return this.listCustomerPaymentsInternal(shopId, customerId, query);
  }

  async createCustomerPayment(
    shopId: string,
    customerId: string,
    receivedByUserId: string,
    input: CreateCustomerPaymentInput,
  ) {
    await this.ensureCustomerExists(shopId, customerId);
    const paymentAmountMinorUnits = toMoneyMinorUnits(input.amount);

    if (paymentAmountMinorUnits <= 0) {
      throw buildAppError(
        400,
        "CUSTOMER_PAYMENT_INVALID_AMOUNT",
        "Payment amount must be greater than zero.",
      );
    }

    const paymentId = await db.transaction(async (tx) => {
      await this.customersRepository.lockCustomerPayments(customerId, tx);

      const outstandingSales = await this.customersRepository.listOutstandingSalesForCustomer(
        shopId,
        customerId,
        input.saleId,
        tx,
      );

      if (!outstandingSales.length) {
        throw buildAppError(
          400,
          "CUSTOMER_PAYMENT_NO_DUE",
          input.saleId
            ? "The selected bill has no outstanding due."
            : "The customer has no outstanding due.",
        );
      }

      const totalOutstandingMinorUnits = sumMoneyMinorUnits(
        outstandingSales.map((sale) => toMoneyMinorUnits(sale.dueAmount)),
      );

      if (paymentAmountMinorUnits > totalOutstandingMinorUnits) {
        throw buildAppError(
          400,
          "CUSTOMER_PAYMENT_EXCEEDS_DUE",
          "Payment amount cannot exceed the outstanding due amount.",
        );
      }

      let remainingMinorUnits = paymentAmountMinorUnits;
      const allocations = outstandingSales
        .map((sale) => {
          if (remainingMinorUnits <= 0) {
            return null;
          }

          const dueMinorUnits = toMoneyMinorUnits(sale.dueAmount);
          const allocatedMinorUnits = Math.min(remainingMinorUnits, dueMinorUnits);
          remainingMinorUnits -= allocatedMinorUnits;

          return {
            saleId: sale.id,
            amountMinorUnits: allocatedMinorUnits,
            nextPaidMinorUnits:
              toMoneyMinorUnits(sale.paidAmount) + allocatedMinorUnits,
            nextDueMinorUnits: dueMinorUnits - allocatedMinorUnits,
            grandTotalMinorUnits: toMoneyMinorUnits(sale.grandTotal),
          };
        })
        .filter((value): value is NonNullable<typeof value> => Boolean(value));

      if (remainingMinorUnits !== 0 || !allocations.length) {
        throw buildAppError(
          500,
          "CUSTOMER_PAYMENT_ALLOCATION_FAILED",
          "Failed to allocate the payment safely.",
        );
      }

      const createdPayment = await this.customersRepository.createCustomerPayment(
        {
          shopId,
          customerId,
          saleId: input.saleId,
          amount: moneyMinorUnitsToString(paymentAmountMinorUnits),
          paymentMethod: input.paymentMethod,
          referenceNumber: input.referenceNumber,
          notes: input.notes,
          receivedByUserId,
          paymentDate: input.paymentDate,
        },
        allocations.map((allocation) => ({
          shopId,
          customerId,
          saleId: allocation.saleId,
          amount: moneyMinorUnitsToString(allocation.amountMinorUnits),
        })),
        tx,
      );

      await Promise.all(
        allocations.map((allocation) =>
          this.customersRepository.updateSalePaymentAmounts(
            allocation.saleId,
            {
              paidAmount: moneyMinorUnitsToString(allocation.nextPaidMinorUnits),
              dueAmount: moneyMinorUnitsToString(allocation.nextDueMinorUnits),
              paymentStatus: mapSalePaymentStatus(
                allocation.nextPaidMinorUnits,
                allocation.grandTotalMinorUnits,
              ),
              updatedByUserId: receivedByUserId,
            },
            tx,
          ),
        ),
      );

      return createdPayment.payment.id;
    });

    const payment = await this.customersRepository.findCustomerPaymentById(
      shopId,
      customerId,
      paymentId,
    );

    if (!payment) {
      throw buildAppError(
        500,
        "CUSTOMER_PAYMENT_FETCH_FAILED",
        "Payment was recorded but could not be loaded.",
      );
    }

    const allocations = await this.customersRepository.listPaymentAllocationsByPaymentIds(
      shopId,
      [paymentId],
    );

    return toCustomerPaymentResponse(payment, allocations);
  }

  private async listCustomerPaymentsInternal(
    shopId: string,
    customerId: string,
    query: ListCustomerPaymentsQuery,
  ) {
    const [items, total] = await Promise.all([
      this.customersRepository.listCustomerPayments(shopId, customerId, query),
      this.customersRepository.countCustomerPayments(shopId, customerId, query),
    ]);

    const allocations = await this.customersRepository.listPaymentAllocationsByPaymentIds(
      shopId,
      items.map((item) => item.payment.id),
    );
    const allocationsByPaymentId = new Map<string, PaymentAllocationRecord[]>();

    for (const allocation of allocations) {
      const existing =
        allocationsByPaymentId.get(allocation.allocation.customerPaymentId) ?? [];
      existing.push(allocation);
      allocationsByPaymentId.set(allocation.allocation.customerPaymentId, existing);
    }

    return buildPaginatedResponse(
      items.map((item) =>
        toCustomerPaymentResponse(
          item,
          allocationsByPaymentId.get(item.payment.id) ?? [],
        ),
      ),
      total,
      query.page,
      query.pageSize,
    );
  }

  private async ensureCustomerExists(shopId: string, customerId: string) {
    const customer = await this.customersRepository.findCustomerById(shopId, customerId);

    if (!customer) {
      throw buildAppError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    }

    return customer;
  }

  private async assertCustomerUniqueness(
    shopId: string,
    mobileNumber: string,
    email?: string,
    excludeId?: string,
  ) {
    const mobileDuplicate = await this.customersRepository.findCustomerByMobile(
      shopId,
      mobileNumber,
      excludeId,
    );

    if (mobileDuplicate) {
      throw buildAppError(
        409,
        "CUSTOMER_MOBILE_CONFLICT",
        "Another customer already uses this mobile number.",
      );
    }

    if (!email) {
      return;
    }

    const emailDuplicate = await this.customersRepository.findCustomerByEmail(
      shopId,
      email,
      excludeId,
    );

    if (emailDuplicate) {
      throw buildAppError(
        409,
        "CUSTOMER_EMAIL_CONFLICT",
        "Another customer already uses this email address.",
      );
    }
  }
}
