"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { AdminStats, AdminUserProfile, AuditPage, UserListQuery, UsersPage } from "@/lib/admin/types";

export type AdminTab = "taste" | "library" | "watchlist" | "friends" | "activity" | "audit";

export const adminKeys = {
  all: ["admin"] as const,
  stats: ["admin", "stats"] as const,
  users: (q: UserListQuery) => ["admin", "users", q] as const,
  user: (uid: string) => ["admin", "user", uid] as const,
  tab: (uid: string, tab: AdminTab) => ["admin", "user", uid, tab] as const,
  audit: (q: Record<string, unknown>) => ["admin", "audit", q] as const,
};

const qs = (o: Record<string, unknown>) =>
  new URLSearchParams(Object.entries(o).flatMap(([k, v]) => (v == null || v === "" ? [] : [[k, String(v)]]))).toString();

export function useAdminStats() {
  return useQuery({ queryKey: adminKeys.stats, queryFn: () => api<AdminStats>("/api/admin/stats"), staleTime: 60_000 });
}

/** Search, filters and pages run on the server; the previous page stays on screen while the next loads. */
export function useAdminUsers(q: UserListQuery) {
  return useQuery({ queryKey: adminKeys.users(q), queryFn: () => api<UsersPage>(`/api/admin/users?${qs(q)}`), placeholderData: keepPreviousData });
}

export function useAdminUser(uid: string) {
  return useQuery({ queryKey: adminKeys.user(uid), queryFn: () => api<AdminUserProfile>(`/api/admin/users/${uid}`), staleTime: 30_000 });
}

/** A detail tab, fetched (and audited) only once it's opened. */
export function useAdminUserTab<T>(uid: string, tab: AdminTab, enabled: boolean, page = 1) {
  return useQuery({
    queryKey: [...adminKeys.tab(uid, tab), page],
    queryFn: () => api<T>(`/api/admin/users/${uid}/${tab}${page > 1 ? `?page=${page}` : ""}`),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useAdminAudit(q: { action?: string; page?: number }) {
  return useQuery({ queryKey: adminKeys.audit(q), queryFn: () => api<AuditPage>(`/api/admin/audit?${qs(q)}`), placeholderData: keepPreviousData });
}

export type ModerationInput =
  | { uid: string; action: "block"; body: { reason: string; showReason: boolean; until: string | null }; token?: string }
  | { uid: string; action: "unblock"; body: { reason: string }; token?: string };

/** Block or unblock. A stale sign-in comes back as "reauth_required"; the dialog confirms and retries with a fresh token. */
export function useModerateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, action, body, token }: ModerationInput) => api(`/api/admin/users/${uid}/${action}`, { method: "POST", body, token }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.all }),
  });
}
