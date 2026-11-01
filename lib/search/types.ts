import type { TitleCard } from "@/lib/catalog/cards";
import type { Category, MediaType, TitleKey } from "@/lib/catalog/types";

/** One result of an Ask search. `fit` is to the request; `match` is to the viewer (null when signed out). */
export type AskItem = {
  key: TitleKey;
  card: TitleCard;
  imdb: number | null;
  fit: number | null;
  match: number | null;
  /** "quick" until the viewer's batched judgement lands, then "full". */
  matchKind: "quick" | "full" | null;
  why: string | null;
};

/** The NDJSON stream from POST /api/search/ask, in order. */
export type AskEvent =
  | { type: "understanding"; chips: string[]; references: { key: TitleKey; title: string; year: number | null }[] }
  | { type: "candidates"; items: AskItem[] }
  | { type: "ranked"; items: AskItem[] }
  | { type: "final"; items: AskItem[]; personal: boolean; ms: number }
  | { type: "error"; message: string };

/** One instant-search result (title lookup, not the natural-language Ask). */
export type TitleHit = {
  key: TitleKey;
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  year: number | null;
  category: Category;
  posterPath: string | null;
  href: string;
};
