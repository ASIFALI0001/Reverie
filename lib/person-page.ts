import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getPerson, type TmdbListItem } from "@/lib/sources/tmdb";
import { UpstreamError } from "@/lib/sources/http";
import { categorize } from "@/lib/catalog/category";
import { titleHref } from "@/lib/catalog/links";
import { titleKey, type Category, type MediaType, type TitleKey } from "@/lib/catalog/types";

export type Credit = {
  key: TitleKey;
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  category: Category;
  /** "Director", "Writer", or the character name; several joined with a comma. */
  role: string;
  href: string;
  votes: number;
};

export type PersonPage = {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  profilePath: string | null;
  department: string;
  knownFor: Credit[];
  credits: Credit[];
};

/** TV genres that are appearances rather than work: talk, news, reality. */
const NOT_WORK = new Set([10767, 10763, 10764]);
const SELF = /^(self|himself|herself|themselves|narrator \(voice\))\b/i;

/** A person and their filmography, shared by everyone and cached for days. Null when TMDB doesn't know them. */
export async function getPersonPage(id: number): Promise<PersonPage | null> {
  "use cache";
  cacheLife("days");
  cacheTag(`person:${id}`);
  let p;
  try {
    p = await getPerson(id);
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) return null;
    throw err;
  }

  const byKey = new Map<TitleKey, Credit & { roles: string[] }>();
  const add = (c: TmdbListItem, role: string) => {
    if (c.media_type !== "movie" && c.media_type !== "tv") return;
    if ((c.genre_ids ?? []).some((g) => NOT_WORK.has(g)) || SELF.test(role)) return;
    const mediaType = c.media_type;
    const key = titleKey(mediaType, c.id);
    const title = c.title ?? c.name ?? "";
    if (!title) return;
    const existing = byKey.get(key);
    if (existing) {
      if (role && !existing.roles.includes(role)) existing.roles.push(role);
      return;
    }
    const date = c.release_date || c.first_air_date || "";
    byKey.set(key, {
      key,
      mediaType,
      tmdbId: c.id,
      title,
      year: date ? Number(date.slice(0, 4)) : null,
      posterPath: c.poster_path,
      category: categorize({ mediaType, genreIds: c.genre_ids ?? [], originCountry: c.origin_country ?? [], originalLanguage: c.original_language ?? "" }),
      role: "",
      roles: role ? [role] : [],
      href: titleHref(mediaType, c.id, title),
      votes: c.vote_count ?? 0,
    });
  };
  for (const c of p.combined_credits.cast) add(c, c.character?.trim() || "");
  for (const c of p.combined_credits.crew) add(c, c.job?.trim() || c.department?.trim() || "");

  // Lead with the role they're known for: "Director, Writer", not "Producer, Writer, Director".
  const primary: Record<string, RegExp> = {
    Directing: /^director$/i,
    Writing: /writer|screenplay|story|novel/i,
    Production: /producer/i,
    Sound: /music|composer|score/i,
    Camera: /photography|cinematograph/i,
  };
  const lead = primary[p.known_for_department];
  const rank = (role: string, i: number) => (lead?.test(role) ? -1 : i);
  const credits = [...byKey.values()].map(({ roles, ...c }) => ({
    ...c,
    role: roles
      .map((r, i) => ({ r, k: rank(r, i) }))
      .sort((a, b) => a.k - b.k)
      .slice(0, 3)
      .map((x) => x.r)
      .join(", "),
  }));
  return {
    id: p.id,
    name: p.name,
    biography: p.biography ?? "",
    birthday: p.birthday,
    deathday: p.deathday,
    placeOfBirth: p.place_of_birth,
    profilePath: p.profile_path,
    department: p.known_for_department,
    // What people know them for: the most-voted work with a poster.
    knownFor: credits
      .filter((c) => c.posterPath)
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 12),
    credits: credits.sort((a, b) => (b.year ?? 9999) - (a.year ?? 9999) || b.votes - a.votes),
  };
}
