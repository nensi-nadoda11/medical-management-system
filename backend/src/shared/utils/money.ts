const MONEY_SCALE = 100;

const normalizeMoneyInput = (value: number | string) => {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Invalid numeric money value.");
    }

    return value.toFixed(2);
  }

  const trimmed = value.trim();
  if (!trimmed.length) {
    throw new Error("Money value cannot be empty.");
  }

  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error("Money value must have up to two decimal places.");
  }

  return trimmed;
};

export const toMoneyMinorUnits = (value: number | string) => {
  const normalized = normalizeMoneyInput(value);
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [wholePart, decimalPart = ""] = unsigned.split(".");
  const whole = Number.parseInt(wholePart ?? "0", 10);
  const decimals = Number.parseInt((decimalPart + "00").slice(0, 2), 10);
  const minorUnits = whole * MONEY_SCALE + decimals;
  return negative ? -minorUnits : minorUnits;
};

export const moneyMinorUnitsToString = (value: number) => {
  const negative = value < 0;
  const absoluteValue = Math.abs(value);
  const whole = Math.floor(absoluteValue / MONEY_SCALE);
  const decimals = absoluteValue % MONEY_SCALE;
  return `${negative ? "-" : ""}${whole}.${decimals.toString().padStart(2, "0")}`;
};

export const sumMoneyMinorUnits = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

export const roundPercentageAmount = (
  baseMinorUnits: number,
  percentage: number,
) => Math.round((baseMinorUnits * percentage) / 100);
