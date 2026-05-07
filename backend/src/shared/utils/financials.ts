export const mapPaymentStatus = (
  paidMinorUnits: number,
  grandTotalMinorUnits: number,
) => {
  if (grandTotalMinorUnits <= 0) {
    return "paid" as const;
  }

  if (paidMinorUnits <= 0) {
    return "unpaid" as const;
  }

  if (paidMinorUnits >= grandTotalMinorUnits) {
    return "paid" as const;
  }

  return "partial" as const;
};

export const buildSettlementState = (
  totalMinorUnits: number,
  appliedMinorUnits: number,
) => {
  const normalizedTotalMinorUnits = Math.max(totalMinorUnits, 0);
  const normalizedAppliedMinorUnits = Math.max(appliedMinorUnits, 0);
  const settledMinorUnits = Math.min(
    normalizedAppliedMinorUnits,
    normalizedTotalMinorUnits,
  );
  const dueMinorUnits = Math.max(
    normalizedTotalMinorUnits - normalizedAppliedMinorUnits,
    0,
  );
  const advanceMinorUnits = Math.max(
    normalizedAppliedMinorUnits - normalizedTotalMinorUnits,
    0,
  );

  return {
    settledMinorUnits,
    dueMinorUnits,
    advanceMinorUnits,
    paymentStatus: mapPaymentStatus(
      settledMinorUnits,
      normalizedTotalMinorUnits,
    ),
  };
};

export const derivePriorAdvanceMinorUnits = (
  currentBalanceMinorUnits: number,
  currentDocumentBalanceContributionMinorUnits: number,
) =>
  Math.max(
    -(
      currentBalanceMinorUnits -
      currentDocumentBalanceContributionMinorUnits
    ),
    0,
  );

export const getReturnRefundCapMinorUnits = (
  totalReturnAmountMinorUnits: number,
  currentDueMinorUnits: number,
) =>
  Math.max(
    Math.max(totalReturnAmountMinorUnits, 0) - Math.max(currentDueMinorUnits, 0),
    0,
  );
