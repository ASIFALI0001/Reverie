"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * Client-side half of route protection (proxy.ts is the server half).
 * Renders the fallback — a shape-matched skeleton — until the session is known.
 */
export function AuthGuard({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { status, isSigningOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "signed-out" && !isSigningOut()) router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname, isSigningOut]);

  return status === "signed-in" ? <>{children}</> : <>{fallback}</>;
}
