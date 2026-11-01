"use client";

import { useEffect, useState } from "react";

/** `value`, settled for `ms` (search-as-you-type without a request per keystroke). */
export function useDebounced<T>(value: T, ms = 220): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
