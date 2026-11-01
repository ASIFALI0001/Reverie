import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition } from "@/components/motion/PageTransition";
import { ProfileView } from "@/components/social/ProfileView";

type Props = PageProps<"/u/[handle]">;

/** Profiles are for signed-in friends and acquaintances, never for search engines. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${decodeURIComponent(handle)}`, robots: { index: false, follow: false } };
}

export default function ProfilePage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <ProfileContent params={params} />
    </Suspense>
  );
}

async function ProfileContent({ params }: { params: Props["params"] }) {
  const { handle } = await params;
  return (
    <PageTransition>
      <ProfileView handle={decodeURIComponent(handle)} />
    </PageTransition>
  );
}
