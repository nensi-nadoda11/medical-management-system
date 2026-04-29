export type ReportPeriodMode = "daily" | "monthly" | "custom";

const pad = (value: number) => String(value).padStart(2, "0");

export const toLocalDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const toMonthInputValue = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

export const getCurrentMonthDateRange = (monthValue: string) => {
  if (!monthValue) {
    return {
      dateFrom: undefined,
      dateTo: undefined,
    };
  }

  const [yearValue, monthNumberValue] = monthValue.split("-");
  const year = Number(yearValue);
  const monthNumber = Number(monthNumberValue);

  if (!Number.isInteger(year) || !Number.isInteger(monthNumber)) {
    return {
      dateFrom: undefined,
      dateTo: undefined,
    };
  }

  const lastDay = new Date(year, monthNumber, 0).getDate();

  return {
    dateFrom: `${yearValue}-${monthNumberValue}-01`,
    dateTo: `${yearValue}-${monthNumberValue}-${pad(lastDay)}`,
  };
};

export const resolveReportDateRange = (input: {
  mode: ReportPeriodMode;
  selectedDate: string;
  selectedMonth: string;
  customDateFrom: string;
  customDateTo: string;
}) => {
  if (input.mode === "daily") {
    return {
      dateFrom: input.selectedDate || undefined,
      dateTo: input.selectedDate || undefined,
    };
  }

  if (input.mode === "monthly") {
    return getCurrentMonthDateRange(input.selectedMonth);
  }

  return {
    dateFrom: input.customDateFrom || undefined,
    dateTo: input.customDateTo || undefined,
  };
};
