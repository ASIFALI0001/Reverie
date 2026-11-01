import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition } from "@/components/motion/PageTransition";
import { LibraryView } from "@/components/library/LibraryView";

export const metadata: Metadata = { title: "Library", robots: { index: false } };

export default function LibraryPage() {
  return (
    <PageTransition>
      <Suspense>
        <LibraryView />
      </Suspense>
    </PageTransition>
  );
}
