// Test-only access to Firebase Admin + Mongo, using the same .env.local as the app.
import { loadEnvConfig } from "@next/env";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import mongoose from "mongoose";
import { USER_KEYED_COLLECTIONS, USER_PAIR_COLLECTIONS } from "../../lib/db/user-collections";

loadEnvConfig(process.cwd(), true);

function auth() {
  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  return getAuth(app);
}

export async function firebaseUidFor(email: string): Promise<string | null> {
  try {
    return (await auth().getUserByEmail(email)).uid;
  } catch {
    return null;
  }
}

export async function deleteFirebaseUser(email: string) {
  const uid = await firebaseUidFor(email);
  if (uid) await auth().deleteUser(uid);
}

/** A throwaway email/password account for flows that need a signed-in browser. */
export async function createTempUser(displayName = "Ada Lovelace") {
  const email = `qa+${Date.now()}-${Math.round(Math.random() * 1e4)}@reverie.test`;
  const password = `lamp-${Math.random().toString(36).slice(2, 10)}`;
  const user = await auth().createUser({ email, password, displayName });
  return { uid: user.uid, email, password };
}

/**
 * Remove a test account everywhere: Firebase, every user-keyed and user-pair collection, and,
 * because these are throwaway accounts, the audit entries about them (production keeps those).
 */
export async function deleteTempUser(uid: string) {
  await auth().deleteUser(uid).catch(() => {});
  const conn = await mongoose.createConnection(process.env.MONGODB_URI!).asPromise();
  try {
    const db = conn.db!;
    await db.collection("users").deleteOne({ _id: uid as never });
    for (const c of USER_KEYED_COLLECTIONS) await db.collection(c).deleteMany({ uid });
    for (const [c, fields] of USER_PAIR_COLLECTIONS) await db.collection(c).deleteMany({ $or: fields.map((f) => ({ [f]: uid })) });
    await db.collection("notifications").deleteMany({ actorUid: uid });
    await db.collection("sharedLists").deleteMany({ memberUids: uid });
    await db.collection("adminAuditLogs").deleteMany({ $or: [{ adminUid: uid }, { targetUid: uid }] });
  } finally {
    await conn.close();
  }
}

/** Grant or remove the admin custom claim (what `npm run make-admin` does). */
export async function setAdmin(uid: string, on: boolean) {
  await auth().setCustomUserClaims(uid, on ? { admin: true } : {});
}

/** Audit log entries about a user, newest first. */
export async function auditFor(targetUid: string): Promise<{ action: string; adminUid: string; details: Record<string, unknown> }[]> {
  const conn = await mongoose.createConnection(process.env.MONGODB_URI!).asPromise();
  try {
    return (await conn
      .db!.collection("adminAuditLogs")
      .find({ targetUid }, { projection: { action: 1, adminUid: 1, details: 1 } })
      .sort({ at: -1 })
      .toArray()) as never;
  } finally {
    await conn.close();
  }
}

/** Call our API as a user (email/password → Firebase ID token → Bearer). */
/** A Firebase ID token for a test account (for requests that don't return JSON, like images). */
export async function idTokenFor(email: string, password: string): Promise<string> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) },
  );
  return ((await res.json()) as { idToken: string }).idToken;
}

export async function apiAs(email: string, password: string) {
  const idToken = await idTokenFor(email, password);
  const base = process.env.E2E_BASE ?? "http://localhost:3000";
  return async <T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
    const r = await fetch(base + path, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    const json = (await r.json()) as { data: T; error?: { message: string } };
    if (!r.ok) throw new Error(json.error?.message ?? `HTTP ${r.status}`);
    return json.data;
  };
}

/** Well-known, enriched catalog titles across categories (for realistic test libraries). */
export async function sampleTitles(n: number): Promise<{ mediaType: "movie" | "tv"; tmdbId: number; category: string }[]> {
  const conn = await mongoose.createConnection(process.env.MONGODB_URI!).asPromise();
  try {
    const out: { mediaType: "movie" | "tv"; tmdbId: number; category: string }[] = [];
    for (const category of ["movie", "series", "anime", "cartoon"]) {
      const docs = await conn
        .db!.collection("titles")
        .find({ category, vibe: { $ne: null }, posterPath: { $ne: null } }, { projection: { mediaType: 1, tmdbId: 1, category: 1 } })
        .sort({ voteCount: -1 })
        .limit(Math.ceil(n / 4))
        .toArray();
      out.push(...docs.map((d) => ({ mediaType: d.mediaType, tmdbId: d.tmdbId, category: d.category })));
    }
    return out.slice(0, n);
  } finally {
    await conn.close();
  }
}

/** The merged taste signals behind a user's profile (as of its last rebuild). */
export async function tasteSignals(uid: string): Promise<{ key: string; source: string; type: string; weight: number }[]> {
  const conn = await mongoose.createConnection(process.env.MONGODB_URI!).asPromise();
  try {
    const doc = await conn.db!.collection("tasteProfiles").findOne({ uid }, { projection: { signals: 1 } });
    return (doc?.signals ?? []) as never;
  } finally {
    await conn.close();
  }
}

export async function mongoUserExists(uid: string): Promise<boolean> {
  const conn = await mongoose.createConnection(process.env.MONGODB_URI!).asPromise();
  try {
    return (await conn.db!.collection("users").countDocuments({ _id: uid as never })) > 0;
  } finally {
    await conn.close();
  }
}
