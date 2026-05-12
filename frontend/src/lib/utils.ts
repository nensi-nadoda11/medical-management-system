export const cn = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

const MONEY_SCALE = 100;

const toMinorUnits = (value: number) => Math.round(value * MONEY_SCALE);

const fromMinorUnits = (value: number) => value / MONEY_SCALE;

export const humanizeLabel = (value?: string | null) => {
  if (!value) {
    return "";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

export const formatDateTime = (value?: string | Date | null) => {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export const formatDate = (value?: string | Date | null) => {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
};

export const formatRelativeStatusDate = (value?: string | Date | null) => {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
};

export const formatNumber = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") {
    return "0";
  }

  const numericValue = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(numericValue)) {
    return "0";
  }

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(numericValue);
};

export const formatCurrency = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") {
    return "Rs 0.00";
  }

  const numericValue = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(numericValue)) {
    return "Rs 0.00";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
};

export const isSameMoney = (
  leftValue?: number | string | null,
  rightValue?: number | string | null,
) => {
  const leftNumber =
    leftValue === null || leftValue === undefined || leftValue === ""
      ? 0
      : Number(leftValue);
  const rightNumber =
    rightValue === null || rightValue === undefined || rightValue === ""
      ? 0
      : Number(rightValue);

  if (Number.isNaN(leftNumber) || Number.isNaN(rightNumber)) {
    return false;
  }

  return toMinorUnits(leftNumber) === toMinorUnits(rightNumber);
};

export const normalizePaidAmountInput = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return 0;
  }

  return Math.max(Math.round(numericValue), 0);
};

export const getAutoRoundedMoneyBreakdown = (value?: number | string | null) => {
  const numericValue =
    value === null || value === undefined || value === "" ? 0 : Number(value);

  if (Number.isNaN(numericValue)) {
    return {
      baseAmount: 0,
      roundedAmount: 0,
      roundOffAmount: 0,
    };
  }

  const baseMinorUnits = toMinorUnits(numericValue);
  const roundedMinorUnits = Math.round(baseMinorUnits / MONEY_SCALE) * MONEY_SCALE;

  return {
    baseAmount: fromMinorUnits(baseMinorUnits),
    roundedAmount: fromMinorUnits(roundedMinorUnits),
    roundOffAmount: fromMinorUnits(roundedMinorUnits - baseMinorUnits),
  };
};

export const toDateInputValue = (value?: string | Date | null) => {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
};

export const getDaysUntil = (value?: string | Date | null) => {
  if (!value) {
    return null;
  }

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const target = new Date(value);
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );

  return Math.round(
    (startOfTarget.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
  );
};
export const toSelectedCustomerSummary = (customer: {
  id: string;
  customerCode: string | null;
  fullName: string;
  mobileNumber: string;
  city: string | null;
  totalDueAmount?: string;
  lastPurchaseDate?: string | null;
  status: "active" | "inactive";
}) => {
  if (!customer) return null;
  return {
    id: customer.id,
    customerCode: customer.customerCode,
    fullName: customer.fullName,
    mobileNumber: customer.mobileNumber,
    city: customer.city,
    totalDueAmount: customer.totalDueAmount ?? "0.00",
    lastPurchaseDate: customer.lastPurchaseDate ?? null,
    status: customer.status,
  };
};
