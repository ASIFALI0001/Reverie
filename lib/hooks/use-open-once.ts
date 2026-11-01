"use client";

import { useCallback, useState } from "react";

/**
 * Open state for a lazily loaded dialog: `mounted` turns on with the first open and stays on,
 * so the dialog's code loads only when wanted and can still animate out when closed.
 */
export function useOpenOnce(initial = false) {
  const [state, setState] = useState({ open: initial, mounted: initial });
  const setOpen = useCallback((open: boolean) => setState((s) => ({ open, mounted: s.mounted || open })), []);
  return [state.open, setOpen, state.mounted] as const;
}
