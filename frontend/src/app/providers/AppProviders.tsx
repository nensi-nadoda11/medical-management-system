import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import type { PropsWithChildren } from "react";

import { ToastProvider } from "../../hooks/use-toast";
import { RealtimeQueryBridge } from "./RealtimeQueryBridge";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
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
