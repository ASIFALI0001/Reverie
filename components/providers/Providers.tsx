"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { SmoothScroll } from "@/components/fx/SmoothScroll";
import { Cursor } from "@/components/fx/Cursor";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ease } from "@/lib/motion";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* "user" honours prefers-reduced-motion: transforms are dropped, opacity is kept. */}
        <MotionConfig reducedMotion="user" transition={{ duration: 0.6, ease: ease.out }}>
          <SmoothScroll>{children}</SmoothScroll>
          <Cursor />
        </MotionConfig>
      </AuthProvider>
    </QueryClientProvider>
  );
}
