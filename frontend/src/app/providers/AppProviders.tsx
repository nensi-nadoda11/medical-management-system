import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import type { PropsWithChildren } from "react";

import { ToastProvider } from "../../hooks/use-toast";
import { ApiError } from "../../lib/api";
import { RealtimeQueryBridge } from "./RealtimeQueryBridge";

const shouldRetryQuery = (failureCount: number, error: unknown) => {
  if (failureCount >= 2) {
    return false;
  }

  if (error instanceof ApiError) {
    return [500, 502, 503, 504].includes(error.status);
  }

  return true;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
      retryDelay: (attemptIndex) => Math.min(1_000 * 2 ** attemptIndex, 4_000),
      refetchOnWindowFocus: false,
    },
  },
});

export const AppProviders = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <BrowserRouter>
        <RealtimeQueryBridge />
        {children}
      </BrowserRouter>
    </ToastProvider>
  </QueryClientProvider>
);
