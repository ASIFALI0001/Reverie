import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition } from "@/components/motion/PageTransition";
import { CompareView } from "@/components/social/CompareView";

type Props = PageProps<"/u/[handle]/compare">;

export const metadata: Metadata = { title: "Compare tastes", robots: { index: false, follow: false } };

export default function ComparePage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <CompareContent params={params} />
    </Suspense>
  );
}

async function CompareContent({ params }: { params: Props["params"] }) {
  const { handle } = await params;
  return (
    <PageTransition>
      <CompareView handle={decodeURIComponent(handle)} />
    </PageTransition>
  );
}
