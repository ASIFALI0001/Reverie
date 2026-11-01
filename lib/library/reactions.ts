/**
 * The quick answers after watching: what worked, what didn't, and an optional line in
 * the viewer's own words. Ids are what we store; labels are what people tap and what
 * the AI reads. Short lists, so two taps cover most opinions.
 */

export const WORKED = [
  ["story", "Story"],
  ["characters", "Characters"],
  ["acting", "Acting"],
  ["dialogue", "Dialogue"],
  ["humour", "Humour"],
  ["action", "Action"],
  ["visuals", "Visuals"],
  ["music", "Music"],
  ["twists", "Twists"],
  ["ending", "Ending"],
  ["pace", "Pace"],
  ["emotion", "Emotion"],
  ["world", "World-building"],
  ["tension", "Tension"],
] as const;

export const DIDNT = [
  ["slow", "Too slow"],
  ["long", "Too long"],
  ["predictable", "Predictable"],
  ["weak-ending", "Weak ending"],
  ["flat-characters", "Flat characters"],
  ["confusing", "Confusing"],
  ["unfunny", "Not funny"],
  ["too-dark", "Too dark"],
  ["cheesy", "Cheesy"],
  ["too-much-action", "Too much action"],
  ["weak-villain", "Weak villain"],
] as const;

export type WorkedId = (typeof WORKED)[number][0];
export type DidntId = (typeof DIDNT)[number][0];
export const WORKED_IDS = WORKED.map(([id]) => id) as [WorkedId, ...WorkedId[]];
export const DIDNT_IDS = DIDNT.map(([id]) => id) as [DidntId, ...DidntId[]];

/** Up to this many chips per side; the review box takes up to REVIEW_MAX characters. */
export const MAX_REACTIONS = 6;
export const REVIEW_MAX = 500;

export type Reactions = { worked?: string[] | null; didnt?: string[] | null; note?: string | null };

const LABEL = new Map<string, string>([...WORKED, ...DIDNT]);

/** Labels for prompts ("humour, dialogue"), in the order given; unknown ids are dropped. */
export function reactionLabels(ids: readonly string[] | null | undefined): string[] {
  return (ids ?? []).flatMap((id) => {
    const label = LABEL.get(id);
    return label ? [label.toLowerCase()] : [];
  });
}

/** The review text, tidied for a prompt: one line, cut at a word near `max` characters. */
export function reviewSnippet(note: string | null | undefined, max = 280): string | null {
  const text = (note ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).trimEnd()}…`;
}

export function hasReactions(r: Reactions | null | undefined): boolean {
  return Boolean(r && ((r.worked?.length ?? 0) > 0 || (r.didnt?.length ?? 0) > 0 || reviewSnippet(r.note)));
}

/**
 * One compact line for a prompt, or null when there's nothing:
 * `worked: humour, dialogue · didn't: too slow · in their words: “the banter carries it”`.
 */
export function describeReactions(r: Reactions | null | undefined, maxReview = 280): string | null {
  if (!r) return null;
  const worked = reactionLabels(r.worked);
  const didnt = reactionLabels(r.didnt);
  const said = reviewSnippet(r.note, maxReview);
  const parts = [
    worked.length ? `worked: ${worked.join(", ")}` : null,
    didnt.length ? `didn't: ${didnt.join(", ")}` : null,
    said ? `in their words: “${said}”` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
