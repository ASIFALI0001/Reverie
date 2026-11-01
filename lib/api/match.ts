"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api/client";
import { TASTE_QUERY_KEY } from "@/lib/api/taste";
import type { TitleCard } from "@/lib/catalog/cards";
import type { MediaType } from "@/lib/catalog/types";
import type { FriendsOnTitle } from "@/lib/social/friends-on-title";
import type { WhyNotView } from "@/lib/reco/why-not-engine";

/** Taste Twins who rated it (counted only from two up), and how far they moved the match. */
export type TwinsOnTitle = { raters: number; boost: { from: number; to: number; weight: number } | null };

export type MatchResponse =
  | { status: "no-profile"; friends: FriendsOnTitle | null; twins: null }
  | {
      status: "ok";
      /** Includes the friend and twin nudges, when they apply (friends.boost and twins.boost say by how much). */
      score: number;
      confidence: number;
      learning: boolean;
      quick: boolean;
      reasons: string[];
      watchOut: string | null;
      becauseYouLiked: { key: string; title: string; posterPath: string | null; href: string }[];
      profileVersion: number;
      friends: FriendsOnTitle | null;
      twins: TwinsOnTitle | null;
    };

export type SimilarResponse = { items: { key: string; why: string; match: number | null; card: TitleCard }[] };

/** The full match for one title (Gemini included). Cached server-side per taste-profile version. */
export function useMatch(mediaType: MediaType, tmdbId: number) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["match", mediaType, tmdbId],
    queryFn: () => api<MatchResponse>(`/api/match/${mediaType}/${tmdbId}`),
    enabled: status === "signed-in",
    staleTime: 10 * 60_000,
  });
}

/** Quick match estimates for a set of titles (one request per list). */
export function useQuickScores(keys: string[], enabled = true) {
  const { status } = useAuth();
  const sorted = [...new Set(keys)].sort();
  return useQuery({
    queryKey: ["quick", sorted.join(",")],
    queryFn: () => api<{ scores: Record<string, number> }>("/api/match/batch", { method: "POST", body: { keys: sorted.slice(0, 80) } }),
    enabled: enabled && status === "signed-in" && sorted.length > 0,
    staleTime: 5 * 60_000,
    select: (d) => d.scores,
  });
}

/** "More like this": the same for everyone, plus the viewer's estimate on each when signed in. */
export function useSimilar(mediaType: MediaType, tmdbId: number, enabled: boolean) {
  const { status } = useAuth();
  return useQuery({
    // The signed-in response carries personal scores, so it's cached apart from the anonymous one.
    queryKey: ["similar", mediaType, tmdbId, status === "signed-in"],
    queryFn: () => api<SimilarResponse>(`/api/similar/${mediaType}/${tmdbId}`),
    enabled: enabled && status !== "loading",
    staleTime: 60 * 60_000,
  });
}

export type WhyNotResponse = { status: "no-profile" } | WhyNotView;

/**
 * "Why it might not be for you". The full one (title page) may ask the model and is cached
 * per taste version; `quick` (list popovers) never waits for it.
 */
export function useWhyNot(mediaType: MediaType, tmdbId: number, { enabled, quick = false }: { enabled: boolean; quick?: boolean }) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["why-not", mediaType, tmdbId, quick ? "quick" : "full"],
    queryFn: () => api<WhyNotResponse>(`/api/match/${mediaType}/${tmdbId}/why-not${quick ? "?quick=1" : ""}`),
    enabled: enabled && status === "signed-in",
    staleTime: 10 * 60_000,
  });
}

/** "Was this right?" Saved straight away; the answer shows on the next read too. */
export function useWhyNotFeedback(mediaType: MediaType, tmdbId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (helpful: boolean) => api<{ helpful: boolean }>(`/api/match/${mediaType}/${tmdbId}/why-not`, { method: "POST", body: { helpful } }),
    onSuccess: ({ helpful }) => {
      for (const mode of ["full", "quick"]) {
        queryClient.setQueryData<WhyNotResponse>(["why-not", mediaType, tmdbId, mode], (old) => (old?.status === "ok" ? { ...old, feedback: helpful } : old));
      }
    },
  });
}

/**
 * After a rating or library change the taste profile rebuilds in the background
 * (~2.5s debounce + the build), so refresh match-dependent data a little later.
 */
export function refreshMatchesSoon(queryClient: QueryClient, delayMs = 4500) {
  setTimeout(() => {
    for (const queryKey of [["match"], ["quick"], ["similar"], TASTE_QUERY_KEY, ["watchlist"], ["home"]]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, delayMs);
}
