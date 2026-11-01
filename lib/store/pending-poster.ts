import { create } from "zustand";

/** The poster the user just clicked — lets the next page's instant shell draw it straight away. */
export type PendingPoster = {
  key: string;
  title: string;
  year: number | null;
  posterPath: string;
  blur?: string | null;
  color?: string | null;
};

type State = { pending: PendingPoster | null; set: (p: PendingPoster | null) => void };

export const usePendingPoster = create<State>((set) => ({
  pending: null,
  set: (pending) => set({ pending }),
}));

export const posterTransitionName = (key: string) => `poster-${key.replace(":", "-")}`;
