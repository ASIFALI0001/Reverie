import { z } from "zod";
import { route } from "@/lib/http/route";
import { askReverie } from "@/lib/reco/ask";
import type { AskEvent } from "@/lib/search/types";

const Input = z.object({ q: z.string().trim().min(3).max(240) });

/**
 * POST /api/search/ask { q } — natural-language search, streamed as NDJSON:
 * understanding → candidates → ranked → final (see AskEvent).
 * Signed out it still works (fit to the request only); signed in, results carry your match.
 */
export const POST = route(
  { auth: "optional", input: Input, rateLimit: { name: "ask", limit: 10, windowSec: 60, store: "mongo" } },
  async ({ user, input }) => {
    const encoder = new TextEncoder();
    // Set when the reader goes away (navigated off, aborted): the stream is closed from that side.
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (e: AskEvent) => {
          if (cancelled) return;
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
          } catch {
            cancelled = true;
          }
        };
        try {
          for await (const event of askReverie({ query: input.q, uid: user?.uid ?? null })) {
            // Nobody is listening any more: stop, so the remaining stages don't spend model calls.
            if (cancelled) break;
            send(event);
          }
        } catch (err) {
          if (!cancelled) {
            console.error("[ask] search failed", err);
            send({ type: "error", message: "The search hit a snag. Try again, or rephrase it." });
          }
        } finally {
          if (!cancelled) controller.close();
        }
      },
      cancel() {
        cancelled = true;
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        // Don't let a proxy hold the stream back until it ends.
        "X-Accel-Buffering": "no",
      },
    });
  },
);
