"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { refreshMatchesSoon } from "@/lib/api/match";
import { useAuth } from "@/components/auth/AuthProvider";
import type { LibraryEntry, LibraryOverview, WatchlistEntry } from "@/lib/library/service";
import type { LibraryStatus } from "@/lib/db/models/Library";
import type { MediaType, TitleKey } from "@/lib/catalog/types";

export type TitleState = { library: { status: LibraryStatus; rating: number | null } | null; watchlist: boolean };

export const libraryKeys = {
  all: ["library"] as const,
  list: (q: Record<string, string | undefined>) => ["library", "list", q] as const,
  overview: ["library", "overview"] as const,
  status: (keys: string[]) => ["library", "status", keys.join(",")] as const,
  watchlist: ["watchlist"] as const,
};

/** Library and watchlist refresh now; anything derived from taste (matches) once the profile has rebuilt. */
function invalidateAll(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: libraryKeys.all });
  void qc.invalidateQueries({ queryKey: libraryKeys.watchlist });
  void qc.invalidateQueries({ queryKey: ["home"] });
  refreshMatchesSoon(qc);
}

export function useTitleState(keys: TitleKey[]) {
  const { status } = useAuth();
  return useQuery({
    queryKey: libraryKeys.status(keys),
    queryFn: () => api<Record<string, TitleState>>(`/api/library/status?keys=${encodeURIComponent(keys.join(","))}`),
    enabled: status === "signed-in" && keys.length > 0,
    staleTime: 30_000,
  });
}

export function useLibrary(q: { category?: string; shelf?: string; customShelf?: string }) {
  const { status } = useAuth();
  const params = new URLSearchParams(Object.entries(q).filter((e): e is [string, string] => Boolean(e[1])));
  return useQuery({
    queryKey: libraryKeys.list(q),
    queryFn: () => api<{ items: LibraryEntry[] }>(`/api/library?${params}`),
    enabled: status === "signed-in",
    placeholderData: (prev) => prev,
  });
}

export function useLibraryOverview() {
  const { status } = useAuth();
  return useQuery({
    queryKey: libraryKeys.overview,
    queryFn: () => api<LibraryOverview>("/api/library/overview"),
    enabled: status === "signed-in",
  });
}

export type LibraryWrite = {
  mediaType: MediaType;
  tmdbId: number;
  status?: LibraryStatus;
  rating?: number | null;
  note?: string;
  worked?: string[];
  didnt?: string[];
  watchedAt?: string | null;
  customShelves?: string[];
  hiddenFromFriends?: boolean;
};

export function useSaveToLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LibraryWrite) => api<LibraryEntry>("/api/library", { method: "POST", body: input }),
    onSuccess: () => invalidateAll(qc),
  });
}

/** Change some fields of a title already in the library (the review after watching). */
export function useUpdateLibraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mediaType, tmdbId, ...fields }: LibraryWrite) =>
      api<LibraryEntry>(`/api/library/${mediaType}/${tmdbId}`, { method: "PATCH", body: fields }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useRemoveFromLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mediaType, tmdbId }: { mediaType: MediaType; tmdbId: number }) =>
      api(`/api/library/${mediaType}/${tmdbId}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useWatchlist() {
  const { status } = useAuth();
  return useQuery({
    queryKey: libraryKeys.watchlist,
    queryFn: () => api<{ items: WatchlistEntry[] }>("/api/watchlist"),
    enabled: status === "signed-in",
  });
}

export function useToggleWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mediaType, tmdbId, on }: { mediaType: MediaType; tmdbId: number; on: boolean }) =>
      on
        ? api("/api/watchlist", { method: "POST", body: { mediaType, tmdbId } })
        : api(`/api/watchlist/${mediaType}/${tmdbId}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

/** Hide a watchlist title from friends, or show it again. */
export function useSetWatchlistHidden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mediaType, tmdbId, hidden }: { mediaType: MediaType; tmdbId: number; hidden: boolean }) =>
      api<{ hiddenFromFriends: boolean }>(`/api/watchlist/${mediaType}/${tmdbId}`, { method: "PATCH", body: { hiddenFromFriends: hidden } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: libraryKeys.watchlist }),
  });
}

export function useCreateShelf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<{ id: string; name: string; count: number }>("/api/library/shelves", { method: "POST", body: { name } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: libraryKeys.all }),
  });
}
