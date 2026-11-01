import type { Metadata } from "next";
import { BlockedView } from "@/components/account/BlockedView";

export const metadata: Metadata = { title: "Account status", robots: { index: false, follow: false } };

export default function BlockedPage() {
  return <BlockedView />;
}
