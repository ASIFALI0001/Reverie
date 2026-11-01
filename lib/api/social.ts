"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, ME_QUERY_KEY } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api/client";
import type { FriendsOverview } from "@/lib/social/friends";
import type { HandleCheck } from "@/lib/social/identity";
import type { NotificationView } from "@/lib/social/notifications";
import type { InviteState, ProfileView, SearchResult } from "@/lib/social/profile";
import type { RelationState } from "@/lib/social/relations";
import type { CompareView } from "@/lib/social/compare";
import type { InboxItem, ReactionKind } from "@/lib/social/recommendations";
import type { ActivityItem } from "@/lib/social/activity";
import type { GroupPick, ListSummary, ListView } from "@/lib/social/shared-lists";

export type { ActivityItem, CompareView, FriendsOverview, GroupPick, InboxItem, InviteState, ListSummary, ListView, NotificationView, ProfileView, ReactionKind, SearchResult };

export const socialKeys = {
  friends: ["friends"] as const,
  profile: (handle: string) => ["profile", handle.toLowerCase()] as const,
  search: (q: string) => ["people-search", q] as const,
  invite: (code: string) => ["invite", code] as const,
  myInvite: ["invite", "me"] as const,
  notifications: ["notifications"] as const,
};

/** Anything that changes who's connected to whom refreshes every view of it. */
function useInvalidateSocial() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: socialKeys.friends }),
      qc.invalidateQueries({ queryKey: ["profile"] }),
      qc.invalidateQueries({ queryKey: ["people-search"] }),
      qc.invalidateQueries({ queryKey: ["invite"] }),
      qc.invalidateQueries({ queryKey: socialKeys.notifications }),
    ]);
}

export function useFriends() {
  const { status } = useAuth();
  return useQuery({ queryKey: socialKeys.friends, queryFn: () => api<FriendsOverview>("/api/friends"), enabled: status === "signed-in", staleTime: 30_000 });
}

export function useProfile(handle: string) {
  return useQuery({
    queryKey: socialKeys.profile(handle),
    queryFn: () => api<ProfileView>(`/api/users/${encodeURIComponent(handle)}`),
    staleTime: 30_000,
    retry: (count, err) => count < 2 && (err as { status?: number }).status !== 404,
  });
}

export function usePeopleSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: socialKeys.search(query),
    queryFn: () => api<{ results: SearchResult[] }>(`/api/users/search?q=${encodeURIComponent(query)}`),
    enabled: query.replace(/^@+/, "").length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useInvite(code: string, enabled = true) {
  return useQuery({ queryKey: socialKeys.invite(code), queryFn: () => api<InviteState>(`/api/invite/${code}`), enabled, staleTime: 30_000, retry: false });
}

export type MyInvite = { code: string; url: string; qr: { dark: string; light: string } };

export function useMyInvite(enabled = true) {
  return useQuery({ queryKey: socialKeys.myInvite, queryFn: () => api<MyInvite>("/api/invite/me"), enabled, staleTime: Infinity });
}

export function useAcceptInvite(code: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: () => api<InviteState>(`/api/invite/${code}/accept`, { method: "POST" }),
    onSuccess: (state) => {
      qc.setQueryData(socialKeys.invite(code), state);
      void invalidate();
    },
  });
}

export function useSendRequest() {
  const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: (to: { uid?: string; handle?: string; via?: "search" | "profile" }) => api<RelationState>("/api/friends/requests", { method: "POST", body: to }),
    onSettled: () => void invalidate(),
  });
}

export function useRespondRequest() {
  const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "decline" }) => api<RelationState>(`/api/friends/requests/${id}`, { method: "PATCH", body: { action } }),
    onSettled: () => void invalidate(),
  });
}

export function useRemoveFriend() {
  const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: (uid: string) => api<{ removed: boolean }>(`/api/friends/${encodeURIComponent(uid)}`, { method: "DELETE" }),
    onSettled: () => void invalidate(),
  });
}

export function useBlockPerson() {
  const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: (uid: string) => api<{ blocked: boolean }>("/api/blocks", { method: "POST", body: { uid } }),
    onSettled: () => void invalidate(),
  });
}

export function useUnblockPerson() {
  const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: (uid: string) => api<{ blocked: boolean }>(`/api/blocks/${encodeURIComponent(uid)}`, { method: "DELETE" }),
    onSettled: () => void invalidate(),
  });
}

/** The bell polls once a minute (TanStack pauses it while the tab is hidden). */
export function useNotifications() {
  const { status } = useAuth();
  return useQuery({
    queryKey: socialKeys.notifications,
    queryFn: () => api<{ items: NotificationView[]; unread: number }>("/api/notifications"),
    enabled: status === "signed-in",
    refetchInterval: 60_000,
    staleTime: 20_000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => api<{ marked: number }>("/api/notifications/read", { method: "PATCH", body: { ids } }),
    onMutate: () => {
      qc.setQueryData<{ items: NotificationView[]; unread: number }>(socialKeys.notifications, (old) =>
        old ? { items: old.items.map((n) => ({ ...n, read: true })), unread: 0 } : old,
      );
    },
  });
}

// ── Friends features: compare, send to a friend, activity, shared lists ─────

export function useCompare(uid: string) {
  return useQuery({ queryKey: ["compare", uid], queryFn: () => api<CompareView>(`/api/friends/${encodeURIComponent(uid)}/compare`), staleTime: 60_000, retry: false });
}

export function useInbox(enabled = true) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["recommendations", "inbox"],
    queryFn: () => api<{ items: InboxItem[]; waiting: number }>("/api/recommendations/inbox"),
    enabled: enabled && status === "signed-in",
    staleTime: 30_000,
  });
}

export function useSendRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { mediaType: "movie" | "tv"; tmdbId: number; to: string[]; note?: string }) => api<{ sent: number }>("/api/recommendations", { method: "POST", body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: socialKeys.notifications }),
  });
}

/** Answer a recommendation; a "watched" or "watchlisted" reply also changes the library, so those refresh too. */
export function useReactToRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kind, rating }: { id: string; kind: ReactionKind; rating?: number | null }) =>
      api<{ kind: ReactionKind; rating: number | null }>(`/api/recommendations/${id}`, { method: "PATCH", body: { reaction: { kind, rating } } }),
    onSuccess: () => {
      for (const queryKey of [["recommendations"], ["library"], ["watchlist"], ["home"]]) void qc.invalidateQueries({ queryKey });
    },
  });
}

export function useFriendsActivity(enabled = true) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["activity", "friends"],
    queryFn: () => api<{ items: ActivityItem[] }>("/api/activity/friends"),
    enabled: enabled && status === "signed-in",
    staleTime: 60_000,
  });
}

export function useSharedLists(enabled = true) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["shared-lists"],
    queryFn: () => api<{ lists: ListSummary[] }>("/api/shared-lists"),
    enabled: enabled && status === "signed-in",
    staleTime: 30_000,
  });
}

export function useSharedList(id: string) {
  return useQuery({ queryKey: ["shared-lists", id], queryFn: () => api<ListView>(`/api/shared-lists/${id}`), staleTime: 20_000, retry: false });
}

/** Every list change refreshes the index and the list itself. */
function useListMutation<TBody, TResult>(fn: (body: TBody) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => void qc.invalidateQueries({ queryKey: ["shared-lists"] }) });
}

export const useCreateList = () =>
  useListMutation((body: { name: string; members: string[] }) => api<{ id: string }>("/api/shared-lists", { method: "POST", body }));
export const useRenameList = (id: string) => useListMutation((name: string) => api(`/api/shared-lists/${id}`, { method: "PATCH", body: { name } }));
export const useDeleteList = (id: string) => useListMutation(() => api(`/api/shared-lists/${id}`, { method: "DELETE" }));
export const useAddToList = () =>
  useListMutation(({ id, mediaType, tmdbId }: { id: string; mediaType: "movie" | "tv"; tmdbId: number }) =>
    api<{ added: boolean }>(`/api/shared-lists/${id}/items`, { method: "POST", body: { mediaType, tmdbId } }),
  );
export const useRemoveFromList = (id: string) =>
  useListMutation(({ mediaType, tmdbId }: { mediaType: "movie" | "tv"; tmdbId: number }) => api(`/api/shared-lists/${id}/items/${mediaType}/${tmdbId}`, { method: "DELETE" }));
export const useAddListMembers = (id: string) => useListMutation((uids: string[]) => api(`/api/shared-lists/${id}/members`, { method: "POST", body: { uids } }));
export const useRemoveListMember = (id: string) => useListMutation((uid: string) => api(`/api/shared-lists/${id}/members/${encodeURIComponent(uid)}`, { method: "DELETE" }));

export function usePickForTonight(id: string) {
  return useMutation({ mutationFn: () => api<{ pick: GroupPick | null }>(`/api/shared-lists/${id}/pick`, { method: "POST" }) });
}

export function useHandleCheck(handle: string, current: string | null) {
  const h = handle.trim().replace(/^@+/, "").toLowerCase();
  return useQuery({
    queryKey: ["handle-check", h],
    queryFn: () => api<HandleCheck>(`/api/users/me/handle?check=${encodeURIComponent(h)}`),
    enabled: h.length > 0 && h !== current,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });
}

export function useSetHandle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (handle: string) => api<{ handle: string }>("/api/users/me/handle", { method: "PATCH", body: { handle } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  });
}
