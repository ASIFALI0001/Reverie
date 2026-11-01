"use client";

import Link from "next/link";
import type { TwinsOnTitle as Twins } from "@/lib/api/match";

/** "3 of your Taste Twins rated this film · they nudged your match up 4 points" (from two twins up). */
export function TwinsOnTitle({ data, kind }: { data: Twins | null | undefined; kind: "film" | "show" }) {
  if (!data || data.raters < 2) return null;
  const delta = data.boost ? data.boost.to - data.boost.from : 0;
  return (
    <p className="mt-4 text-[0.9375rem]">
      <Link href="/taste/twins" className="link-draw text-text">
        {data.raters} of your Taste Twins
      </Link>{" "}
      <span className="text-text">rated this {kind}</span>
      {delta !== 0 ? (
        <span className="text-muted">
          {" "}
          · they nudged your match {delta > 0 ? "up" : "down"} {Math.abs(delta)} point{Math.abs(delta) === 1 ? "" : "s"}
        </span>
      ) : null}
    </p>
  );
}
