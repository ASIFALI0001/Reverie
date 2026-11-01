import { currentIdToken } from "@/lib/auth/firebase-client";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type Options = { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; signal?: AbortSignal; token?: string };

/** Typed call to our own API. Attaches the Firebase ID token and unwraps `{ data }` / `{ error }`. */
export async function api<T>(path: string, { method = "GET", body, signal, token }: Options = {}): Promise<T> {
  const idToken = token ?? (await currentIdToken());
  const res = await fetch(path, {
    method,
    signal,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as { data?: T; error?: { code: string; message: string; details?: unknown } } | null;
  // An administrator blocked this account: nothing else in the app is reachable.
  if (res.status === 403 && json?.error?.code === "ACCOUNT_BLOCKED" && typeof window !== "undefined" && window.location.pathname !== "/blocked") {
    window.location.replace("/blocked");
  }
  if (!res.ok || !json || json.error) {
    throw new ApiClientError(
      res.status,
      json?.error?.code ?? "http_error",
      json?.error?.message ?? "Something went wrong. Try again.",
      json?.error?.details,
    );
  }
  return json.data as T;
}
