import { create } from "zustand";

/**
 * The ⌘K command palette's state, shared by the nav trigger and the hotkey.
 * `loaded` flips on the first open and stays on, so the dialog can animate out.
 */
export const usePalette = create<{ open: boolean; loaded: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  loaded: false,
  setOpen: (open) => set((s) => ({ open, loaded: s.loaded || open })),
}));
