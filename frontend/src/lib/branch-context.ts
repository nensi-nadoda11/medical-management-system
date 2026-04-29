const BRANCH_STORAGE_KEY = "mms.activeBranchId";
export const BRANCH_CHANGED_EVENT = "mms:branch-changed";

const canUseStorage = () => typeof window !== "undefined";

export const getStoredBranchId = () => {
  if (!canUseStorage()) {
    return null;
  }

  const value = window.localStorage.getItem(BRANCH_STORAGE_KEY);
  return value && value.length ? value : null;
};

export const setStoredBranchId = (branchId: string | null | undefined) => {
  if (!canUseStorage()) {
    return;
  }

  if (branchId) {
    window.localStorage.setItem(BRANCH_STORAGE_KEY, branchId);
    window.dispatchEvent(
      new CustomEvent(BRANCH_CHANGED_EVENT, {
        detail: {
          branchId,
        },
      }),
    );
    return;
  }

  window.localStorage.removeItem(BRANCH_STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent(BRANCH_CHANGED_EVENT, {
      detail: {
        branchId: null,
      },
    }),
  );
};

export const syncStoredBranchId = (allowedBranchIds: string[], fallbackBranchId: string) => {
  const storedBranchId = getStoredBranchId();
  const nextBranchId =
    storedBranchId && allowedBranchIds.includes(storedBranchId)
      ? storedBranchId
      : fallbackBranchId;

  setStoredBranchId(nextBranchId);
  return nextBranchId;
};
