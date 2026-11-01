import "server-only";

export class UpstreamError extends Error {
  constructor(
    public service: string,
    public status: number,
    message: string,
  ) {
    super(`${service} ${status}: ${message}`);
    this.name = "UpstreamError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Plain fetch with a hard timeout (for binary downloads like posters). */
export function fetchWithTimeout(url: string | URL, timeoutMs: number, init: RequestInit = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/**
 * fetch with a timeout and polite retries: 429 honours Retry-After, 5xx and
 * network errors back off exponentially. 4xx (other than 429) fail fast.
 */
export async function fetchJson<T>(
  service: string,
  url: string | URL,
  init: RequestInit & { timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  const { timeoutMs = 10_000, retries = 3, ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after"));
        lastErr = new UpstreamError(service, res.status, res.statusText);
        if (attempt < retries) {
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 400 * 2 ** attempt);
          continue;
        }
      }
      throw new UpstreamError(service, res.status, (await res.text().catch(() => "")).slice(0, 200) || res.statusText);
    } catch (err) {
      if (err instanceof UpstreamError && err.status < 500 && err.status !== 429) throw err;
      lastErr = err;
      if (attempt < retries) await sleep(400 * 2 ** attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
