import type { Metadata } from "next";
import { PageTransition } from "@/components/motion/PageTransition";
import { WatchlistView } from "@/components/watchlist/WatchlistView";

export const metadata: Metadata = { title: "Watchlist", robots: { index: false } };

export default function WatchlistPage() {
  return (
    <PageTransition>
      <WatchlistView />
    </PageTransition>
  );
}
