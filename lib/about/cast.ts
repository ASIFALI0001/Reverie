import { titleKey } from "@/lib/catalog/types";

const m = (id: number) => titleKey("movie", id);
const tv = (id: number) => titleKey("tv", id);

/** The titles each About chapter features, by role (shared by the server loader and the scenes). */
export const CAST = {
  match: m(157336), // Interstellar: the 92%
  low: m(11036), // The Notebook: the 41%
  evidence: [m(4348), m(313369)], // what "why not" rests on
  deck: [m(329865), m(120467), m(76341), m(419430), m(346648)],
  source: m(135397), // Jurassic World
  scarier: [m(348), m(1091), m(578), m(766507), m(106), m(300668), m(9392), m(395992), m(511987), m(1255)],
  similar: [m(329), m(330), m(507086), m(254), m(124905), m(293167), m(427641), m(578)],
  moods: {
    "light-fun": [m(346648), m(120467), m(9377)],
    "cant-sleep": [m(153), m(76), m(152601)],
    "good-cry": [m(354912), m(14160), m(334541)],
    "scare-me": [m(493922), m(138843), m(447332)],
  },
  vibe: m(693134), // Dune: Part Two
  series: tv(1396), // Breaking Bad
  shelves: {
    Movies: [m(1726), m(24428), m(284054), m(118340), m(299534)],
    Series: [tv(1396), tv(70523), tv(95396), tv(136315), tv(1399)],
    Anime: [m(372058), m(129), tv(1429), tv(209867), m(4935)],
    Cartoons: [tv(246), tv(94605), m(324857), m(862), m(10681)],
  },
  watchlist: [m(244786), m(496243), m(545611), m(666277), m(872585)],
  twins: [m(244786), m(496243), m(545611), m(666277)],
  plane: m(438631),
  closing: m(329865),
} as const;
