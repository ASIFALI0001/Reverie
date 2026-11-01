import "server-only";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { userFromSessionCookie } from "@/lib/auth/request-user";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * The server half of the admin guard: no session, or no admin claim on it, and the page never
 * renders. (Every /api/admin route checks again on its own.) Sits behind a Suspense boundary
 * because it reads the request's cookies.
 */
export async function AdminGate({ children }: { children: ReactNode }) {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  // Verifying the session reads the clock: keep it out of the prerendered shell.
  await connection();
  const user = await userFromSessionCookie(cookie, { checkRevoked: true });
  if (!user) redirect("/admin/login");
  if (!user.admin) redirect("/admin/login?denied=1");
  return <AdminShell admin={{ email: user.email, name: user.name }}>{children}</AdminShell>;
}
