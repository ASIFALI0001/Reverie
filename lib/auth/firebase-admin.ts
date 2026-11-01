import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env } from "@/lib/env";

let app: App | undefined;

function adminApp(): App {
  if (!app) {
    app = getApps()[0] ?? initializeApp({ credential: cert(env.firebaseAdmin()) });
  }
  return app;
}

export function adminAuth() {
  return getAuth(adminApp());
}
