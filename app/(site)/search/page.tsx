import type { Metadata } from "next";
import { PageTransition } from "@/components/motion/PageTransition";
import { SearchView } from "@/components/search/SearchView";

export const metadata: Metadata = {
  title: "Search",
  description: "Describe what you want to watch — a mood, a reference, a length — and Reverie finds ten that fit, ranked for you.",
};

/** Natural-language search. Static shell; the query (?q=) is read and run on the client. */
export default function SearchPage() {
  return (
    <PageTransition>
      <SearchView />
    </PageTransition>
  );
}
