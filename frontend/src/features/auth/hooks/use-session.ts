import { useQuery } from "@tanstack/react-query";

import { ApiError } from "../../../lib/api";
import { authService } from "../../../services/auth";

export const authQueryKeys = {
  session: ["auth", "session"] as const,
};

export const useSessionQuery = () =>
  useQuery({
    queryKey: authQueryKeys.session,
    queryFn: async () => {
      try {
        return await authService.getSession();
      } catch (error) {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
          return null;
        }

        throw error;
      }
    },
    staleTime: 60_000,
  });
