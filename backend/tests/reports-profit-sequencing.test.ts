import "./test-env";

import { describe, expect, it, vi } from "vitest";

import { ReportsService } from "../src/modules/reports/reports.service";

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>((res) => {
      resolve = res;
    }),
    resolve,
  };
};

describe("ReportsService profit report sequencing", () => {
  it("runs repository reads one at a time to avoid overlapping queries", async () => {
    const started: string[] = [];
    const summaryDeferred = createDeferred<{
      revenue: string;
      cost: string;
      profit: string;
    }>();
    const trendDeferred = createDeferred<
      Array<{
        periodStart: Date;
        revenue: string;
        cost: string;
        profit: string;
      }>
    >();
    const rowsDeferred = createDeferred<
      Array<{
        saleId: string;
        billNumber: string;
        customerName: string;
        completedAt: Date;
        createdBy: {
          id: string;
          fullName: string;
          role: "admin";
        };
        revenue: string;
        cost: string;
        profit: string;
      }>
    >();
    const totalDeferred = createDeferred<number>();

    const repository = {
      getProfitSummary: vi.fn(async () => {
        started.push("summary");
        return summaryDeferred.promise;
      }),
      getProfitTrend: vi.fn(async () => {
        started.push("trend");
        return trendDeferred.promise;
      }),
      listProfitRows: vi.fn(async () => {
        started.push("rows");
        return rowsDeferred.promise;
      }),
      countProfitRows: vi.fn(async () => {
        started.push("total");
        return totalDeferred.promise;
      }),
    };

    const service = new ReportsService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const reportPromise = service.getProfitReport(
      "shop-1",
      ["branch-1"],
      {
        userId: "user-1",
        role: "admin",
      },
      {
        page: 1,
        pageSize: 10,
        sortBy: "completedAt",
        sortOrder: "desc",
        groupBy: "day",
      },
    );

    await flushMicrotasks();
    expect(started).toEqual(["summary"]);

    summaryDeferred.resolve({
      revenue: "100.00",
      cost: "60.00",
      profit: "40.00",
    });
    await flushMicrotasks();
    expect(started).toEqual(["summary", "trend"]);

    trendDeferred.resolve([
      {
        periodStart: new Date("2026-05-01T00:00:00.000Z"),
        revenue: "100.00",
        cost: "60.00",
        profit: "40.00",
      },
    ]);
    await flushMicrotasks();
    expect(started).toEqual(["summary", "trend", "rows"]);

    rowsDeferred.resolve([
      {
        saleId: "sale-1",
        billNumber: "BILL-1",
        customerName: "Asha",
        completedAt: new Date("2026-05-01T10:00:00.000Z"),
        createdBy: {
          id: "user-1",
          fullName: "Demo User",
          role: "admin" as const,
        },
        revenue: "100.00",
        cost: "60.00",
        profit: "40.00",
      },
    ]);
    await flushMicrotasks();
    expect(started).toEqual(["summary", "trend", "rows", "total"]);

    totalDeferred.resolve(1);

    const report = await reportPromise;
    expect(report.summary.profitPercent).toBe("40.00");
    expect(report.rows.pagination.total).toBe(1);
    expect(report.rows.items).toHaveLength(1);
  });
});
