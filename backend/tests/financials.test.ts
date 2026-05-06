import { describe, expect, it } from "vitest";

import {
  buildSettlementState,
  getReturnRefundCapMinorUnits,
  mapPaymentStatus,
} from "../src/shared/utils/financials";

describe("financial settlement helpers", () => {
  it("marks zero or negative totals as paid", () => {
    expect(mapPaymentStatus(0, 0)).toBe("paid");
    expect(mapPaymentStatus(0, -500)).toBe("paid");
  });

  it("caps settled paid amount and keeps overpayment as advance", () => {
    expect(buildSettlementState(10_000, 12_500)).toEqual({
      settledMinorUnits: 10_000,
      dueMinorUnits: 0,
      advanceMinorUnits: 2_500,
      paymentStatus: "paid",
    });
  });

  it("keeps partial due when applied amount is lower than total", () => {
    expect(buildSettlementState(10_000, 3_500)).toEqual({
      settledMinorUnits: 3_500,
      dueMinorUnits: 6_500,
      advanceMinorUnits: 0,
      paymentStatus: "partial",
    });
  });

  it("limits refundable sales return amount after adjusting current due", () => {
    expect(getReturnRefundCapMinorUnits(8_000, 5_000)).toBe(3_000);
    expect(getReturnRefundCapMinorUnits(4_000, 5_000)).toBe(0);
  });
});
