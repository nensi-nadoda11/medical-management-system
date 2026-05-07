import "./test-env";

import { describe, expect, it, vi } from "vitest";

import { BillingService } from "../src/modules/billing/billing.service";
import { CustomersService } from "../src/modules/customers/customers.service";
import { PurchaseReturnsService } from "../src/modules/purchase-returns/purchase-returns.service";
import { SalesReturnsService } from "../src/modules/sales-returns/sales-returns.service";

const expectEndOfDay = (value: Date) => {
  expect(value.getHours()).toBe(23);
  expect(value.getMinutes()).toBe(59);
  expect(value.getSeconds()).toBe(59);
  expect(value.getMilliseconds()).toBe(999);
};

describe("dateTo normalization for listing services", () => {
  it("normalizes purchase return dateTo before querying", async () => {
    const repository = {
      listPurchaseReturns: vi.fn().mockResolvedValue([]),
      countPurchaseReturns: vi.fn().mockResolvedValue(0),
    };
    const service = new PurchaseReturnsService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const dateTo = new Date(2026, 4, 7);

    await service.listPurchaseReturns("shop-1", {
      page: 1,
      pageSize: 10,
      sortBy: "createdAt",
      sortOrder: "desc",
      dateTo,
    });

    const normalized = repository.listPurchaseReturns.mock.calls[0]?.[1].dateTo;
    expect(normalized).toBeInstanceOf(Date);
    expect(normalized).not.toBe(dateTo);
    expectEndOfDay(normalized as Date);
    expect(repository.countPurchaseReturns).toHaveBeenCalledWith(
      "shop-1",
      expect.objectContaining({
        dateTo: normalized,
      }),
    );
  });

  it("normalizes sales return dateTo before querying", async () => {
    const repository = {
      listSalesReturns: vi.fn().mockResolvedValue([]),
      countSalesReturns: vi.fn().mockResolvedValue(0),
    };
    const service = new SalesReturnsService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const dateTo = new Date(2026, 4, 7);

    await service.listSalesReturns("shop-1", {
      page: 1,
      pageSize: 10,
      sortBy: "createdAt",
      sortOrder: "desc",
      dateTo,
    });

    const normalized = repository.listSalesReturns.mock.calls[0]?.[1].dateTo;
    expect(normalized).toBeInstanceOf(Date);
    expect(normalized).not.toBe(dateTo);
    expectEndOfDay(normalized as Date);
    expect(repository.countSalesReturns).toHaveBeenCalledWith(
      "shop-1",
      expect.objectContaining({
        dateTo: normalized,
      }),
    );
  });

  it("normalizes billing history dateTo before querying", async () => {
    const repository = {
      listSales: vi.fn().mockResolvedValue([]),
      countSales: vi.fn().mockResolvedValue(0),
      getSalesSummary: vi.fn().mockResolvedValue({
        totalSales: "0.00",
        totalBills: 0,
        averageBillValue: "0.00",
      }),
    };
    const service = new BillingService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const dateTo = new Date(2026, 4, 7);

    await service.listBills("shop-1", "branch-1", {
      page: 1,
      pageSize: 10,
      sortBy: "createdAt",
      sortOrder: "desc",
      dateTo,
    });

    const normalized = repository.listSales.mock.calls[0]?.[2].dateTo;
    expect(normalized).toBeInstanceOf(Date);
    expect(normalized).not.toBe(dateTo);
    expectEndOfDay(normalized as Date);
    expect(repository.countSales).toHaveBeenCalledWith(
      "shop-1",
      "branch-1",
      expect.objectContaining({
        dateTo: normalized,
      }),
    );
  });

  it("normalizes customer purchase and payment dateTo before querying", async () => {
    const repository = {
      findCustomerById: vi.fn().mockResolvedValue({ id: "customer-1" }),
      listCustomerPurchases: vi.fn().mockResolvedValue([]),
      countCustomerPurchases: vi.fn().mockResolvedValue(0),
      listCustomerPayments: vi.fn().mockResolvedValue([]),
      countCustomerPayments: vi.fn().mockResolvedValue(0),
      listPaymentAllocationsByPaymentIds: vi.fn().mockResolvedValue([]),
    };
    const service = new CustomersService(repository as never);
    const dateTo = new Date(2026, 4, 7);

    await service.listCustomerPurchases("shop-1", "customer-1", {
      page: 1,
      pageSize: 10,
      sortBy: "billDate",
      sortOrder: "desc",
      dateTo,
    });

    const normalizedPurchaseDateTo =
      repository.listCustomerPurchases.mock.calls[0]?.[2].dateTo;
    expect(normalizedPurchaseDateTo).toBeInstanceOf(Date);
    expect(normalizedPurchaseDateTo).not.toBe(dateTo);
    expectEndOfDay(normalizedPurchaseDateTo as Date);
    expect(repository.countCustomerPurchases).toHaveBeenCalledWith(
      "shop-1",
      "customer-1",
      expect.objectContaining({
        dateTo: normalizedPurchaseDateTo,
      }),
    );

    await service.listCustomerPayments("shop-1", "customer-1", {
      page: 1,
      pageSize: 10,
      sortBy: "paymentDate",
      sortOrder: "desc",
      dateTo,
    });

    const normalizedPaymentDateTo =
      repository.listCustomerPayments.mock.calls[0]?.[2].dateTo;
    expect(normalizedPaymentDateTo).toBeInstanceOf(Date);
    expect(normalizedPaymentDateTo).not.toBe(dateTo);
    expectEndOfDay(normalizedPaymentDateTo as Date);
    expect(repository.countCustomerPayments).toHaveBeenCalledWith(
      "shop-1",
      "customer-1",
      expect.objectContaining({
        dateTo: normalizedPaymentDateTo,
      }),
    );
  });
});
