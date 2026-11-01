/** 130 → "2h 10m", 45 → "45m", 120 → "2h". */
export function formatRuntime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** 880123 → "880K", 1_204_000 → "1.2M", 950 → "950". */
export function formatCount(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n < 0) return null;
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k < 10 ? trimZero(k.toFixed(1)) : Math.round(k)}K`;
  }
  const m = n / 1_000_000;
  return `${m < 10 ? trimZero(m.toFixed(1)) : Math.round(m)}M`;
}

function trimZero(s: string) {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** "Amélie" → "Amelie": strip combining accents after NFKD decomposition. */
export function foldDiacritics(input: string): string {
  return input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

/** "Iron Man 3" → "iron-man-3" (ASCII-folded, stable for URLs). */
export function slugify(input: string): string {
  return foldDiacritics(input)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Clamp to [min, max]. */
export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** "just now" · "5 min ago" · "3 h ago" · "2 days ago" · "12 Mar" (for notifications and activity). */
export function timeAgo(iso: string | Date, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  const days = Math.floor(s / 86_400);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
