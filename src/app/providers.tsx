"use client";
import { useState, type ReactNode } from "react";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => {
    // A 403 usually means the user's permissions changed since the page loaded: re-read them once.
    let last = 0;
    const on403 = (e: unknown) => {
      if (e instanceof ApiError && e.status === 403 && Date.now() - last > 15_000) {
        last = Date.now();
        window.dispatchEvent(new Event("workdesk:permissions-stale"));
      }
    };
    return new QueryClient({
      queryCache: new QueryCache({ onError: on403 }),
      mutationCache: new MutationCache({ onError: on403 }),
      defaultOptions: {
        queries: {
          staleTime: 15_000, refetchOnWindowFocus: false,
          retry: (n, e) => !(e instanceof ApiError && e.status > 0 && e.status < 500) && n < 1,
        },
      },
    });
  });
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
