import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Reverie admin" },
  robots: { index: false, follow: false },
};

function ShellSkeleton() {
  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]" aria-hidden="true">
      <div className="border-b border-hairline px-6 py-7 lg:border-b-0 lg:border-r">
        <Skeleton className="h-6 w-32" />
        <div className="mt-10 hidden space-y-3 lg:block">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
      <div className="px-5 py-10 lg:px-10">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="mt-8 h-48 w-full" />
      </div>
    </div>
  );
}

export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
