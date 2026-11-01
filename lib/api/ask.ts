"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api/client";
import { currentIdToken } from "@/lib/auth/firebase-client";
import type { AskEvent, AskItem } from "@/lib/search/types";

export type AskState =
  | { status: "idle" }
  | {
      status: "thinking" | "streaming" | "done" | "error";
      query: string;
      chips: string[];
      items: AskItem[];
      /** Which pass the items come from: provisional → ranked for the request → final with your match. */
      stage: "candidates" | "ranked" | "final" | null;
      personal: boolean;
      ms: number | null;
      message: string | null;
    };

export const RECENT_SEARCHES_KEY = ["search", "recent"] as const;

/** Natural-language search over the NDJSON stream. A new run cancels the one in flight. */
export function useAsk() {
  const [state, setState] = useState<AskState>({ status: "idle" });
  const inflight = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => () => inflight.current?.abort(), []);

  const run = useCallback(
    async (query: string) => {
      inflight.current?.abort();
      const ctrl = new AbortController();
      inflight.current = ctrl;
      setState({ status: "thinking", query, chips: [], items: [], stage: null, personal: false, ms: null, message: null });
      const fail = (message: string) =>
        setState((s) => (s.status === "idle" ? s : { ...s, status: "error", message }));

      try {
        const token = await currentIdToken();
        const res = await fetch("/api/search/ask", {
          method: "POST",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ q: query }),
        });
        if (!res.ok || !res.body) {
          const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          fail(json?.error?.message ?? "The search didn’t go through. Try again.");
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (line) apply(JSON.parse(line) as AskEvent);
          }
        }
        setState((s) => (s.status === "idle" || s.status === "error" ? s : { ...s, status: "done" }));
        void queryClient.invalidateQueries({ queryKey: RECENT_SEARCHES_KEY });
      } catch (err) {
        if (ctrl.signal.aborted) return;
        fail(err instanceof Error && err.message ? "The connection dropped mid-search. Try again." : "Something went wrong.");
      }

      function apply(e: AskEvent) {
        if (ctrl.signal.aborted) return;
        setState((s) => {
          if (s.status === "idle") return s;
          switch (e.type) {
            case "understanding":
              return { ...s, status: "streaming", chips: e.chips };
            case "candidates":
            case "ranked":
              return { ...s, status: "streaming", items: e.items, stage: e.type };
            case "final":
              return { ...s, items: e.items, stage: "final", personal: e.personal, ms: e.ms };
            case "error":
              return { ...s, status: "error", message: e.message };
          }
        });
      }
    },
    [queryClient],
  );

  const reset = useCallback(() => {
    inflight.current?.abort();
    setState({ status: "idle" });
  }, []);

  return { state, run, reset };
}

export function useRecentSearches() {
  const { status } = useAuth();
  return useQuery({
    queryKey: RECENT_SEARCHES_KEY,
    queryFn: () => api<{ queries: string[] }>("/api/search/recent"),
    enabled: status === "signed-in",
    staleTime: 60_000,
    select: (d) => d.queries,
  });
}
