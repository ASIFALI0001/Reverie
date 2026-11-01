export type Provider = { id: number; name: string; logoPath: string };

/** Official ways to watch one title in one region (TMDB × JustWatch). */
export type ProviderGroups = {
  region: string;
  /** TMDB's watch page for this title (it links out to each service via JustWatch). */
  link: string | null;
  stream: Provider[];
  free: Provider[];
  rent: Provider[];
  buy: Provider[];
};
