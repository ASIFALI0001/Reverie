"use client";

import { useEffect, useRef, type RefObject } from "react";
import { loadGsap, type GsapKit } from "@/lib/fx/gsap";

type Build = (kit: GsapKit, root: HTMLElement, el: HTMLElement) => void;

/**
 * A scene's scroll animation: GSAP loads on demand, everything is built inside a context on the
 * chapter (so text the server rendered can be animated too) and reverted on unmount or when
 * `key` changes (wide ↔ narrow, reduced motion). Nothing runs while `enabled` is false.
 */
export function useGsapScene(ref: RefObject<HTMLElement | null>, enabled: boolean, key: string, build: Build) {
  const latest = useRef(build);
  useEffect(() => {
    latest.current = build;
  });
  useEffect(() => {
    const el = ref.current;
    const root = el?.closest<HTMLElement>("[data-chapter]");
    if (!enabled || !el || !root) return;
    let cancelled = false;
    let revert: (() => void) | null = null;
    void loadGsap().then((kit) => {
      if (cancelled) return;
      const ctx = kit.gsap.context(() => latest.current(kit, root, el), root);
      revert = () => ctx.revert();
    });
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [ref, enabled, key]);
}
