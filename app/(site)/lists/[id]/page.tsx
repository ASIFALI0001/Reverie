import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition } from "@/components/motion/PageTransition";
import { SharedListView } from "@/components/social/SharedListView";

type Props = PageProps<"/lists/[id]">;

export const metadata: Metadata = { title: "Shared list", robots: { index: false, follow: false } };

export default function SharedListPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <ListContent params={params} />
    </Suspense>
  );
}

async function ListContent({ params }: { params: Props["params"] }) {
  const { id } = await params;
  return (
    <PageTransition>
      <SharedListView id={id} />
    </PageTransition>
  );
}
