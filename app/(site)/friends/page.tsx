import type { Metadata } from "next";
import { PageTransition } from "@/components/motion/PageTransition";
import { FriendsView } from "@/components/social/FriendsView";

export const metadata: Metadata = { title: "Friends", robots: { index: false } };

export default function FriendsPage() {
  return (
    <PageTransition>
      <FriendsView />
    </PageTransition>
  );
}
