"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMe } from "@/lib/api/me";

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Late show";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function HomeGreeting() {
  return (
    <AuthGuard fallback={<Skeleton className="h-16 w-2/3 md:h-24" />}>
      <Greeting />
    </AuthGuard>
  );
}

function Greeting() {
  const { data: me } = useMe();
  const first = me?.displayName?.split(" ")[0];
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
      <h1 className="max-w-[16ch] text-h1">
        {greeting()}
        {first ? `, ${first}` : ""}.
      </h1>
      <Link href="/mood" className="link-draw pb-2 text-meta text-muted hover:text-text">
        Not feeling these? Describe a mood
      </Link>
    </div>
  );
}
