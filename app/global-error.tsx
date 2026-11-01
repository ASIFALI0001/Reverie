"use client";

/**
 * Last-resort boundary (the root layout itself failed). It renders its own document
 * without the global stylesheet, so the look is inlined: the same dark room and serif.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100svh", display: "grid", placeItems: "center", background: "#0c0b0a", color: "#ede6da", fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <title>Reverie · Something went wrong</title>
        <main style={{ padding: "2rem", maxWidth: "36rem" }}>
          <h1 style={{ fontSize: "clamp(2.5rem, 7vw, 4.5rem)", fontWeight: 400, lineHeight: 1, margin: 0 }}>The projector stopped.</h1>
          <p style={{ color: "#8a8378", fontFamily: "system-ui, sans-serif", lineHeight: 1.6, marginTop: "1.5rem" }}>
            Something broke before the page could load. Give it another go.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: "2rem", background: "#ede6da", color: "#0c0b0a", border: 0, borderRadius: 999, padding: "0.8rem 1.5rem", fontSize: "1rem", fontFamily: "system-ui, sans-serif", cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
