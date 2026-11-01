import type { Metadata } from "next";
import { getWatchRegions } from "@/lib/catalog/regions";
import { PageTransition } from "@/components/motion/PageTransition";
import { SettingsView } from "@/components/settings/SettingsView";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const regions = await getWatchRegions();
  return (
    <PageTransition>
      <SettingsView regions={regions} />
    </PageTransition>
  );
}
