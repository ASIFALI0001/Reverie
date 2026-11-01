"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, ME_QUERY_KEY } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api/client";
import type { Category, TitleKey } from "@/lib/catalog/types";
import type { TitleHit } from "@/lib/search/types";
import type { DeckCard, SwipeVerdict, TasteAnswers, TasteView } from "@/lib/taste/types";

export const TASTE_QUERY_KEY = ["taste"] as const;

export function useTaste() {
  const { status } = useAuth();
  return useQuery({
    queryKey: TASTE_QUERY_KEY,
    queryFn: () => api<TasteView>("/api/taste"),
    enabled: status === "signed-in",
    staleTime: 30_000,
  });
}

export function useRebuildTaste() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<TasteView>("/api/taste/rebuild", { method: "POST" }),
    onSuccess: (view) => queryClient.setQueryData(TASTE_QUERY_KEY, view),
  });
}

/** The swipe deck for the formats and chips picked so far (stable for the day, so cache it for the session). */
export function useSwipeDeck(formats: Category[], chips: string[]) {
  const f = [...formats].sort().join(",");
  const c = [...chips].sort().join(",");
  return useQuery({
    queryKey: ["onboarding", "deck", f, c],
    queryFn: ({ signal }) => api<{ cards: DeckCard[] }>(`/api/onboarding/swipe-deck?formats=${f}&chips=${c}`, { signal }),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
}

/** Instant title lookup (2+ characters). Keeps the last results on screen while the next query loads. */
export function useTitleSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: ["search", "titles", query.toLowerCase()],
    queryFn: ({ signal }) => api<{ results: TitleHit[] }>(`/api/search/titles?q=${encodeURIComponent(query)}&limit=8`, { signal }),
    enabled: query.length >= 2,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export type OnboardingSubmission = TasteAnswers & { swipes: { key: TitleKey; verdict: SwipeVerdict }[]; favourites: TitleKey[] };

export function useSubmitOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: OnboardingSubmission | { skip: true }) =>
      api<{ onboardingDone: boolean; taste: TasteView | null }>("/api/onboarding", { method: "POST", body }),
    onSuccess: async ({ taste }) => {
      if (taste) queryClient.setQueryData(TASTE_QUERY_KEY, taste);
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}
