"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api/client";
import type { EraView, TimelineView } from "@/lib/timeline/timeline";
import type { WrappedView } from "@/lib/timeline/wrapped";

export type { EraView, TimelineView, WrappedView };

/** `from` and `to` as YYYY-MM-DD, both inclusive. */
export function useWrapped(from: string, to: string) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["taste", "wrapped", from, to],
    queryFn: () => api<WrappedView>(`/api/taste/wrapped?from=${from}&to=${to}`),
    enabled: status === "signed-in",
    staleTime: 5 * 60_000,
  });
}

export function useTimeline() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["taste", "timeline"],
    queryFn: () => api<TimelineView>("/api/taste/timeline"),
    enabled: status === "signed-in",
    staleTime: 60_000,
    // Era names still being written: look again shortly, twice at most.
    refetchInterval: (q) => (q.state.data?.pending && q.state.dataUpdateCount < 3 ? 6000 : false),
  });
}
