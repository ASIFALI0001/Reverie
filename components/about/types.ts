import type { AboutData, AboutTitle } from "@/lib/about/data";

/** Every scene gets the story's data (null when it couldn't load: scenes then show what they can). */
export type SceneProps = { data: AboutData | null };

/** A featured title, if it loaded. */
export const titleOf = (data: AboutData | null, key: string): AboutTitle | null => data?.titles[key] ?? null;
