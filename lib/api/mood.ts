"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api/client";
import type { MoodPick, MoodResult } from "@/lib/mood/pick";
import type { Company, MoodTime, TIME_OPTIONS, COMPANY_OPTIONS } from "@/lib/mood/target";
import type { RegionService } from "@/lib/sources/tmdb";

export type { MoodPick, MoodResult, Company, MoodTime, RegionService };

export type MoodOptions = {
  presets: { id: string; label: string; line: string }[];
  times: typeof TIME_OPTIONS;
  companies: typeof COMPANY_OPTIONS;
  servicesCount: number;
};

export function useMoodOptions() {
  const { status } = useAuth();
  return useQuery({ queryKey: ["mood", "options"], queryFn: () => api<MoodOptions>("/api/mood"), enabled: status === "signed-in", staleTime: 5 * 60_000 });
}

export type MoodRequest = { preset?: string | null; text?: string | null; time: MoodTime; company?: Company | null; onlyMyServices?: boolean };

export function useRunMood() {
  return useMutation({ mutationFn: (body: MoodRequest) => api<MoodResult>("/api/mood/pick", { method: "POST", body }) });
}

export function useSwapMood() {
  return useMutation({ mutationFn: (body: { sessionId: string; key: string }) => api<{ pick: MoodPick | null }>("/api/mood/pick/swap", { method: "POST", body }) });
}

/** Fire and forget: which pick they went with. */
export function chooseMoodPick(sessionId: string, key: string) {
  void api("/api/mood/pick/choose", { method: "POST", body: { sessionId, key } }).catch(() => {});
}

export function useRegionServices(enabled = true) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["services"],
    queryFn: () => api<{ region: string; services: RegionService[] }>("/api/services"),
    enabled: enabled && status === "signed-in",
    staleTime: 60 * 60_000,
  });
}
