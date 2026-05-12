import { useQuery } from "@tanstack/react-query";

import { ApiError } from "../../../lib/api";
import { syncStoredBranchId } from "../../../lib/branch-context";
import { authService } from "../../../services/auth";

export const authQueryKeys = {
  session: ["auth", "session"] as const,
};

export const useSessionQuery = () =>
  useQuery({
    queryKey: authQueryKeys.session,
    queryFn: async () => {
      try {
        const session = await authService.getSession();
        const branchContext = session.branchContext;

        if (branchContext?.currentBranch?.id && branchContext.accessibleBranches.length) {
          syncStoredBranchId(
            branchContext.accessibleBranches.map((branch) => branch.id),
            branchContext.currentBranch.id,
          );
        }

        return session;
      } catch (error) {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
          return null;
        }

        throw error;
      }
    },
    staleTime: 60_000,
  });
