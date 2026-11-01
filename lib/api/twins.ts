"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api/client";
import type { TwinsView, TwinState } from "@/lib/twins/compute";
import type { Person } from "@/lib/social/people";

export type { TwinsView, TwinState };
export type TwinView = TwinsView["twins"][number];

const KEY = ["twins"] as const;

export function useTwins() {
  const { status } = useAuth();
  return useQuery({ queryKey: KEY, queryFn: () => api<TwinsView>("/api/twins"), enabled: status === "signed-in", staleTime: 60_000 });
}

/** Connect with a twin; the list updates in place (and friends and the bell catch up). */
export function useConnectTwin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api<{ state: TwinState; friend: Person | null }>("/api/twins/connect", { method: "POST", body: { token } }),
    onSuccess: (res, token) => {
      qc.setQueryData<TwinsView>(KEY, (v) => (v ? { ...v, twins: v.twins.map((t) => (t.token === token ? { ...t, state: res.state, friend: res.friend } : t)) } : v));
      if (res.state === "friends") for (const queryKey of [["friends"], ["notifications"]]) void qc.invalidateQueries({ queryKey });
    },
  });
}
