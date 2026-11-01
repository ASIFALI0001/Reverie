"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { ME_QUERY_KEY, useAuth } from "@/components/auth/AuthProvider";
import type { PublicUser } from "@/lib/db/models/User";

export function useMe() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => api<PublicUser>("/api/users/me"),
    enabled: status === "signed-in",
    staleTime: 5 * 60_000,
  });
}

export type MePatch = Partial<Pick<PublicUser, "displayName" | "avatar" | "region" | "languages">> & {
  privacy?: Partial<PublicUser["privacy"]>;
  invitePromptSeen?: true;
  services?: number[];
};

/** Changes show at once and roll back if the server says no. */
export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: MePatch) => api<PublicUser>("/api/users/me", { method: "PATCH", body: patch }),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ME_QUERY_KEY });
      const previous = queryClient.getQueryData<PublicUser>(ME_QUERY_KEY);
      if (previous) queryClient.setQueryData<PublicUser>(ME_QUERY_KEY, { ...previous, ...patch, privacy: { ...previous.privacy, ...patch.privacy } });
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(ME_QUERY_KEY, ctx.previous);
    },
    onSuccess: (me) => queryClient.setQueryData(ME_QUERY_KEY, me),
  });
}
