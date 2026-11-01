"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api/client";
import type { HomeFeed } from "@/lib/home/types";

export const HOME_QUERY_KEY = ["home"] as const;

export function useHomeFeed() {
  const { status } = useAuth();
  return useQuery({
    queryKey: HOME_QUERY_KEY,
    queryFn: () => api<HomeFeed>("/api/home"),
    enabled: status === "signed-in",
    staleTime: 5 * 60_000,
  });
}
