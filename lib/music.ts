/** The background music on the landing page and the About story (components/fx/SiteMusic.tsx). */

/** Where it plays, for visitors who aren't signed in. Signed in, "/" is their Home: no music there. */
export const MUSIC_PAGES = ["/", "/about"] as const;

export const MUSIC_SRC = "/audio/theme.mp3";

/** "off" once the visitor mutes it, remembered across visits; absent or "on" means it plays. */
export const MUSIC_PREF_KEY = "reverie-music";
