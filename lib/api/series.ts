"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api/client";
import type { SeriesVerdictView } from "@/lib/series/should-continue";
import type { Position } from "@/lib/series/trend";
import type { SeasonIndex } from "@/lib/sources/tmdb";

export type { SeriesVerdictView, Position, SeasonIndex };

export function useSeriesProgress(tvId: number, enabled: boolean) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["series", tvId, "progress"],
    queryFn: () => api<{ seasons: SeasonIndex; progress: Position | null; status: string | null }>(`/api/series/${tvId}/seasons`),
    enabled: enabled && status === "signed-in",
    staleTime: 60_000,
  });
}

export function useShouldContinue(tvId: number) {
  return useMutation({
    mutationFn: (body: { season: number; episode: number; reason?: string | null }) =>
      api<SeriesVerdictView>(`/api/series/${tvId}/should-continue`, { method: "POST", body }),
  });
}

/** Kept watching or stopped: the series lands in the library as Watching or Dropped. */
export function useSeriesDecision(tvId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { decision: "kept" | "stopped"; season: number; episode: number; verdict?: string | null }) =>
      api<{ decision: string; status: string }>(`/api/series/${tvId}/decision`, { method: "POST", body }),
    onSuccess: () => {
      for (const queryKey of [["library"], ["series", tvId], ["home"]]) void qc.invalidateQueries({ queryKey });
    },
  });
}
