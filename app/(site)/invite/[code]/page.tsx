import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { InviteLanding } from "@/components/social/InviteLanding";
import { inviteCard } from "@/lib/social/profile";

type Props = PageProps<"/invite/[code]">;

export const metadata: Metadata = {
  title: "You’re invited",
  description: "A friend invited you to Reverie: see how your tastes match.",
  robots: { index: false, follow: false },
};

export default function InvitePage({ params }: Props) {
  return (
    <div className="page min-h-[80svh] pb-[var(--section-y)] pt-[calc(var(--nav-h)+3rem)] md:pt-[calc(var(--nav-h)+6rem)]">
      <Suspense fallback={<InviteSkeleton />}>
        <InviteContent params={params} />
      </Suspense>
    </div>
  );
}

async function InviteContent({ params }: { params: Props["params"] }) {
  const { code } = await params;
  await connection();
  const card = await inviteCard(code);
  if (!card) {
    return (
      <div>
        <h1 className="max-w-[16ch] text-h1">This invite link doesn’t work any more.</h1>
        <p className="mt-6 max-w-[44ch] text-muted">Ask your friend for a fresh one, or look around Reverie on your own.</p>
        <Button asChild className="mt-8">
          <Link href="/">Go to Reverie</Link>
        </Button>
      </div>
    );
  }
  return <InviteLanding code={code} card={card} />;
}

function InviteSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="size-[84px] rounded-full" />
      <Skeleton className="mt-8 h-24 w-full max-w-xl" />
    </div>
  );
}
