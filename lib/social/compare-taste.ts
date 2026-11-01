import type { RadarPoint } from "@/lib/taste/types";

/**
 * Where two tastes agree and where they clash, read off the two genre radars (pure, tested).
 * Radar values run 0–1 with 0.5 as neutral: 0.6 and up is a pull, 0.42 and below a push away.
 * Axes neither of you has any evidence for are skipped, so silence never reads as agreement.
 */

export const LOVES = 0.6;
export const AVOIDS = 0.42;

const NOUN: Record<string, string> = {
  Action: "action",
  Comedy: "comedy",
  Drama: "drama",
  Romance: "romance",
  Horror: "horror",
  Thriller: "thrillers",
  "Sci-fi": "sci-fi",
  Family: "family films",
};
const noun = (axis: string) => NOUN[axis] ?? axis.toLowerCase();

export type AxisLine = { axis: string; mine: number; theirs: number; line: string };

export function compareRadars(mine: RadarPoint[], theirs: RadarPoint[], name: string): { agree: AxisLine[]; clash: AxisLine[] } {
  const byAxis = new Map(theirs.map((p) => [p.axis, p]));
  const pairs = mine.flatMap((m) => {
    const t = byAxis.get(m.axis);
    if (!t || (m.evidence === 0 && t.evidence === 0)) return [];
    return [{ axis: m.axis, mine: m.value, theirs: t.value, mineKnown: m.evidence > 0, theirsKnown: t.evidence > 0 }];
  });

  const agree = pairs
    .filter((p) => p.mineKnown && p.theirsKnown && ((p.mine >= LOVES && p.theirs >= LOVES) || (p.mine <= AVOIDS && p.theirs <= AVOIDS)))
    .sort((a, b) => Math.min(b.mine, b.theirs) - Math.min(a.mine, a.theirs))
    .map((p) => ({
      axis: p.axis,
      mine: p.mine,
      theirs: p.theirs,
      line: p.mine >= LOVES ? `You both love ${noun(p.axis)}` : `Neither of you goes near ${noun(p.axis)}`,
    }));

  const clash = pairs
    .filter((p) => (p.mine >= LOVES && p.theirsKnown && p.theirs <= AVOIDS) || (p.theirs >= LOVES && p.mineKnown && p.mine <= AVOIDS))
    .sort((a, b) => Math.abs(b.mine - b.theirs) - Math.abs(a.mine - a.theirs))
    .map((p) => {
      const iLove = p.mine >= LOVES;
      const other = iLove ? p.theirs : p.mine;
      const verb = other <= 0.3 ? "avoids it" : "can take it or leave it";
      return {
        axis: p.axis,
        mine: p.mine,
        theirs: p.theirs,
        line: iLove ? `You love ${noun(p.axis)}, ${name} ${verb}` : `${name} loves ${noun(p.axis)}, you ${verb.replace("avoids", "avoid")}`,
      };
    });

  return { agree, clash };
}
