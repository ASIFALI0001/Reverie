import { CATEGORY_LABEL } from "@/lib/catalog/category";
import { ANIME_TAG_NAME, FRANCHISE_NAME } from "@/lib/catalog/franchises";
import type { Category } from "@/lib/catalog/types";

/**
 * Shelf slugs, stored on each library item when it's added:
 *   genre:sci-fi · franchise:marvel · collection:131292 · anime:isekai
 * Custom shelves live separately (by id) because users rename them.
 */
export type ShelfKind = "genre" | "franchise" | "collection" | "anime";

/** TMDB genre names (movie + TV lists) → our genre shelf slugs. TV's combined genres split in two. */
const GENRE_SHELVES: Record<string, string[]> = {
  Action: ["action"],
  "Action & Adventure": ["action", "adventure"],
  Adventure: ["adventure"],
  Comedy: ["comedy"],
  Crime: ["crime"],
  Documentary: ["documentary"],
  Drama: ["drama"],
  Family: ["family"],
  Kids: ["family"],
  Fantasy: ["fantasy"],
  "Sci-Fi & Fantasy": ["sci-fi", "fantasy"],
  "Science Fiction": ["sci-fi"],
  History: ["history"],
  Horror: ["horror"],
  Music: ["music"],
  Mystery: ["mystery"],
  Romance: ["romance"],
  Thriller: ["thriller"],
  War: ["war"],
  "War & Politics": ["war"],
  Western: ["western"],
  Reality: ["reality"],
};

export const GENRE_SHELF_NAME: Record<string, string> = {
  action: "Action",
  adventure: "Adventure",
  comedy: "Comedy",
  crime: "Crime",
  documentary: "Documentary",
  drama: "Drama",
  family: "Family",
  fantasy: "Fantasy",
  "sci-fi": "Sci-Fi",
  history: "History",
  horror: "Horror",
  music: "Music",
  mystery: "Mystery",
  romance: "Romance",
  thriller: "Thriller",
  war: "War",
  western: "Western",
  reality: "Reality",
};

/** The order genre shelves appear in the index (most-loved genres first, the rest alphabetical). */
export const GENRE_ORDER = ["sci-fi", "action", "thriller", "mystery", "horror", "comedy", "drama", "romance", "fantasy", "crime", "adventure"];

type ShelfSource = {
  category: Category;
  genres: string[];
  franchises: string[];
  collection: { id: number; name: string } | null;
  animeTags: string[];
};

export function shelvesFor(t: ShelfSource): string[] {
  const out = new Set<string>();
  for (const g of t.genres) for (const slug of GENRE_SHELVES[g] ?? []) out.add(`genre:${slug}`);
  for (const f of t.franchises) out.add(`franchise:${f}`);
  if (t.collection) out.add(`collection:${t.collection.id}`);
  if (t.category === "anime") for (const tag of t.animeTags) out.add(`anime:${tag}`);
  return [...out];
}

export function parseShelf(slug: string): { kind: ShelfKind; id: string } | null {
  const m = /^(genre|franchise|collection|anime):(.+)$/.exec(slug);
  return m ? { kind: m[1] as ShelfKind, id: m[2]! } : null;
}

/** Display name for a shelf. Collections need their name from the title data, passed in. */
export function shelfName(slug: string, collectionNames: Record<string, string> = {}): string {
  const p = parseShelf(slug);
  if (!p) return slug;
  switch (p.kind) {
    case "genre":
      return GENRE_SHELF_NAME[p.id] ?? p.id;
    case "franchise":
      return FRANCHISE_NAME[p.id] ?? p.id;
    case "anime":
      return ANIME_TAG_NAME[p.id] ?? p.id;
    case "collection":
      return (collectionNames[p.id] ?? "Collection").replace(/ Collection$/, "");
  }
}

/** URL segment for a shelf: genre:sci-fi → "sci-fi"; franchise:marvel → "f-marvel"; collection:131292 → "c-131292". */
export function shelfToSegment(slug: string): string {
  const p = parseShelf(slug);
  if (!p) return slug;
  return { genre: p.id, franchise: `f-${p.id}`, collection: `c-${p.id}`, anime: `a-${p.id}` }[p.kind];
}

export function segmentToShelf(segment: string): string {
  if (segment.startsWith("f-")) return `franchise:${segment.slice(2)}`;
  if (segment.startsWith("c-")) return `collection:${segment.slice(2)}`;
  if (segment.startsWith("a-")) return `anime:${segment.slice(2)}`;
  return `genre:${segment}`;
}

export const CATEGORY_SEGMENTS: Record<string, Category> = {
  movies: "movie",
  series: "series",
  anime: "anime",
  cartoons: "cartoon",
};
export const CATEGORY_TO_SEGMENT: Record<Category, string> = { movie: "movies", series: "series", anime: "anime", cartoon: "cartoons" };
export { CATEGORY_LABEL };

/** Friendly empty-shelf lines. */
export function emptyShelfLine(slug: string | null, category: Category | null): string {
  const name = slug ? shelfName(slug) : null;
  if (slug === "genre:sci-fi") return "Your sci-fi shelf is waiting for its first ship.";
  if (slug === "genre:horror") return "Nothing lurking on your horror shelf yet.";
  if (slug === "genre:romance") return "Your romance shelf is still looking for the one.";
  if (slug === "genre:comedy") return "Your comedy shelf could use a laugh.";
  if (name) return `Nothing on your ${name} shelf yet.`;
  if (category) return `No ${CATEGORY_LABEL[category].toLowerCase()} in your library yet.`;
  return "Your library is empty — add something you’ve watched.";
}
