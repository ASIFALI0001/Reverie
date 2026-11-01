import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { FormSkeleton } from "@/components/auth/FormSkeleton";

export const metadata: Metadata = { title: "Admin sign-in", robots: { index: false, follow: false } };

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-svh place-items-center px-[var(--page-x)]">
          <div className="w-full max-w-[24rem]">
            <FormSkeleton />
          </div>
        </main>
      }
    >
      <AdminLogin />
    </Suspense>
  );
}
