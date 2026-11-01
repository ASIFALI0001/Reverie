"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

/** The footer is static; only this list depends on who's looking. */
export function FooterAccountLinks() {
  const { status, signOut } = useAuth();
  const linkClass = "link-draw text-muted hover:text-text";

  return (
    <ul className="space-y-2.5">
      <li>
        <Link href="/settings" className={linkClass}>
          Settings
        </Link>
      </li>
      {status === "signed-in" ? (
        <li>
          <button type="button" onClick={() => void signOut()} className={linkClass}>
            Sign out
          </button>
        </li>
      ) : status === "signed-out" ? (
        <>
          <li>
            <Link href="/signin" className={linkClass}>
              Sign in
            </Link>
          </li>
          <li>
            <Link href="/signup" className={linkClass}>
              Create an account
            </Link>
          </li>
        </>
      ) : null}
    </ul>
  );
}
