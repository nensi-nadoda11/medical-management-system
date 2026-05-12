import { describe, expect, it } from "vitest";

import {
  getAutoRoundedMoneyBreakdown,
  isSameMoney,
  normalizePaidAmountInput,
} from "../src/lib/utils";

describe("money rounding helpers", () => {
  it("rounds settlement amounts to the nearest rupee and keeps the delta in round off", () => {
    expect(getAutoRoundedMoneyBreakdown(67.89)).toEqual({
      baseAmount: 67.89,
      roundedAmount: 68,
      roundOffAmount: 0.11,
    });

    expect(getAutoRoundedMoneyBreakdown(67.49)).toEqual({
      baseAmount: 67.49,
      roundedAmount: 67,
      roundOffAmount: -0.49,
    });
  });

  it("normalizes paid input to a non-negative whole rupee amount", () => {
    expect(normalizePaidAmountInput("67.89")).toBe(68);
    expect(normalizePaidAmountInput(67.49)).toBe(67);
    expect(normalizePaidAmountInput(-4.9)).toBe(0);
  });

  it("compares money values using paise precision", () => {
    expect(isSameMoney("68.00", 68)).toBe(true);
    expect(isSameMoney("67.49", 67.5)).toBe(false);
  });
});
