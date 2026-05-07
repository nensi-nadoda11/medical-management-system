import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useSessionQuery } from "../../features/auth/hooks/use-session";
import { billingQueryKeys } from "../../features/billing/api/billing";
import { inventoryQueryKeys } from "../../features/inventory/api/inventory";
import { notificationsQueryKeys } from "../../features/notifications/api/notifications";
import { purchasesQueryKeys } from "../../features/purchases/api/purchases";
import { reportsQueryKeys } from "../../features/reports/api/reports";
import { API_BASE_URL } from "../../lib/api";
import {
  BRANCH_CHANGED_EVENT,
  getStoredBranchId,
} from "../../lib/branch-context";

const buildRealtimeUrl = (branchId: string | null) => {
  const normalizedBase = API_BASE_URL.startsWith("http")
    ? API_BASE_URL
    : `${window.location.origin}${API_BASE_URL.startsWith("/") ? API_BASE_URL : `/${API_BASE_URL}`}`;
  const url = new URL(
    `${normalizedBase.replace(/\/$/, "")}/realtime/stock-events`,
  );

  if (branchId) {
    url.searchParams.set("branchId", branchId);
  }

  return url.toString();
};

export const RealtimeQueryBridge = () => {
  const queryClient = useQueryClient();
  const sessionQuery = useSessionQuery();
  const [branchId, setBranchId] = useState<string | null>(() => getStoredBranchId());
  const activeBranchId =
    branchId ?? sessionQuery.data?.branchContext?.currentBranch.id ?? null;

  useEffect(() => {
    const handleBranchChanged = () => {
      setBranchId(getStoredBranchId());
    };

    window.addEventListener(BRANCH_CHANGED_EVENT, handleBranchChanged);
    window.addEventListener("storage", handleBranchChanged);

    return () => {
      window.removeEventListener(BRANCH_CHANGED_EVENT, handleBranchChanged);
      window.removeEventListener("storage", handleBranchChanged);
    };
  }, []);

  useEffect(() => {
    if (!sessionQuery.data || typeof window === "undefined") {
      return undefined;
    }

    const eventSource = new EventSource(buildRealtimeUrl(activeBranchId), {
      withCredentials: true,
    });

    const invalidateInventoryViews = () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: reportsQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.all }),
      ]);
    };

    const matchesActiveBranch = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as {
          branchId?: string | null;
        };

        return !payload.branchId || payload.branchId === activeBranchId;
      } catch {
        return true;
      }
    };

    const handleInventoryChange = (event: MessageEvent<string>) => {
      if (!matchesActiveBranch(event)) {
        return;
      }

      invalidateInventoryViews();
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
    };

    const handlePurchaseChange = (event: MessageEvent<string>) => {
      if (!matchesActiveBranch(event)) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all });
    };

    const handleNotificationChange = (event: MessageEvent<string>) => {
      if (!matchesActiveBranch(event)) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.all });
    };

    eventSource.addEventListener("inventory_changed", handleInventoryChange);
    eventSource.addEventListener("purchase_changed", handlePurchaseChange);
    eventSource.addEventListener("notification_changed", handleNotificationChange);

    return () => {
      eventSource.removeEventListener("inventory_changed", handleInventoryChange);
      eventSource.removeEventListener("purchase_changed", handlePurchaseChange);
      eventSource.removeEventListener(
        "notification_changed",
        handleNotificationChange,
      );
      eventSource.close();
    };
  }, [activeBranchId, queryClient, sessionQuery.data]);

  return null;
};
