import type { Auth } from "firebase/auth";
import { HINT_COOKIE } from "@/lib/auth/constants";

// Public by design (Firebase web config); access is controlled by authorized domains + rules.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let authPromise: Promise<Auth> | null = null;

/** Firebase loads on demand: visitors who never sign in never download it. */
export function loadAuth(): Promise<Auth> {
  authPromise ??= (async () => {
    const [{ getApps, initializeApp }, { getAuth }] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    return getAuth(app);
  })().catch((err: unknown) => {
    authPromise = null;
    throw err;
  });
  return authPromise;
}

export const authSdk = () => import("firebase/auth");

/**
 * Email and password sign-in. Just after an account's sessions are revoked (an admin block or
 * unblock), Firebase can reject the tokens it mints in the next second or two
 * ("auth/user-token-expired"), so wait a moment and try again rather than show an error.
 */
export async function signInWithEmail(auth: Auth, email: string, password: string) {
  const { signInWithEmailAndPassword } = await authSdk();
  for (let attempt = 0; ; attempt++) {
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      if ((err as { code?: string } | null)?.code !== "auth/user-token-expired" || attempt >= 2) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
}

/** Issued-at of the current session (from the readable hint cookie), or null when signed out. */
export function readHint(): number | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${HINT_COOKIE}=(\\d+)`));
  return m ? Number(m[1]) : null;
}

/** ID token for API calls, without forcing Firebase to load for signed-out visitors. */
export async function currentIdToken(): Promise<string | null> {
  if (!authPromise && readHint() === null) return null;
  const auth = await loadAuth();
  await auth.authStateReady();
  return (await auth.currentUser?.getIdToken()) ?? null;
}
