import type { TitleCard } from "@/lib/catalog/cards";

export type HomeItem = {
  card: TitleCard;
  match: number | null;
  /** A line in place of the card's usual year and length, e.g. "3 twins rated this 9+". */
  note?: string | null;
};

export type HomeRow = {
  id: string;
  kind: "picked" | "because" | "trending" | "continue" | "watchlist" | "gems" | "twins";
  title: string;
  /** Set in italics after the title, e.g. the film in "Because you loved Interstellar". */
  emphasis?: string | null;
  href?: string | null;
  items: HomeItem[];
};

/** The one pick the home page leads with. */
export type Tonight = {
  card: TitleCard;
  match: number;
  reason: string;
  overview: string;
  backdropPath: string | null;
  tint: { dark: string; light: string } | null;
};

export type HomeFeed = {
  /** False until there's a taste profile: rows are then the non-personal ones. */
  personal: boolean;
  tonight: Tonight | null;
  rows: HomeRow[];
};
