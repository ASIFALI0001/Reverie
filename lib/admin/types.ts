import type { TitleCard } from "@/lib/catalog/cards";
import type { Privacy } from "@/lib/db/models/User";
import type { TasteAnswers, TasteView } from "@/lib/taste/types";

/** Shapes the admin API returns (shared by lib/admin/queries.ts and the admin UI). */

export type AdminStats = {
  users: { total: number; newToday: number; new7d: number; new30d: number; active7d: number; blocked: number };
  library: { items: number; watchlist: number };
  /** Last 30 days, oldest first (UTC days). */
  signups: { day: string; count: number }[];
  topTitles: { card: TitleCard; count: number }[];
  topGenres: { genre: string; count: number }[];
  /** Today's usage of each AI provider and rate-limited source. */
  usage: { label: string; used: number; budget: number | null }[];
  generatedAt: string;
};

export type UserSort = "joined" | "-joined" | "active" | "-active" | "name" | "-name";

export type UserListQuery = {
  query?: string;
  status?: "active" | "blocked";
  method?: "password" | "google.com";
  joinedFrom?: string;
  joinedTo?: string;
  sort?: UserSort;
  page?: number;
};

export type AdminAvatar = { kind: "photo" | "monogram"; tint: string };

export type AdminUserRow = {
  uid: string;
  name: string | null;
  handle: string | null;
  email: string | null;
  photoURL: string | null;
  avatar: AdminAvatar;
  signUpMethod: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
  libraryCount: number;
  friendsCount: number;
  status: "active" | "blocked";
  role: "user" | "admin";
};

export type UsersPage = { rows: AdminUserRow[]; total: number; page: number; pageSize: number };

export type PersonRef = { uid: string; name: string; handle: string | null; photoURL: string | null; avatar: AdminAvatar | null; blocked: boolean };

export type AdminUserProfile = {
  uid: string;
  name: string | null;
  handle: string | null;
  handleChosen: boolean;
  email: string | null;
  photoURL: string | null;
  avatar: AdminAvatar;
  region: string;
  languages: string[];
  onboardingDone: boolean;
  signUpMethod: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
  role: "user" | "admin";
  status: "active" | "blocked";
  block: { reason: string | null; showReason: boolean; at: string | null; until: string | null; by: string | null } | null;
  blockHistory: { action: "block" | "unblock"; reason: string | null; at: string; until: string | null; by: string }[];
  privacy: Privacy;
  services: number[];
  firebase: {
    providers: string[];
    emailVerified: boolean;
    disabled: boolean;
    createdAt: string | null;
    lastSignInAt: string | null;
    lastRefreshAt: string | null;
    admin: boolean;
  } | null;
};

export type AdminUserTaste = {
  view: TasteView;
  answers: TasteAnswers | null;
  signalCount: number;
  version: number;
  builtAt: string | null;
  summarySource: string | null;
  snapshots: { month: string; count: number; hours: number; avgRating: number | null; topGenres: string[]; topTitles: string[] }[];
};

type TitleRef = { key: string; title: string; posterPath: string | null };

export type AdminUserFriends = {
  friends: { person: PersonRef; since: string }[];
  requestsIn: { person: PersonRef; at: string }[];
  requestsOut: { person: PersonRef; at: string }[];
  blocked: { person: PersonRef; at: string }[];
  blockedBy: { person: PersonRef; at: string }[];
  sharedLists: { id: string; name: string; owner: boolean; members: PersonRef[]; items: number }[];
  sent: { person: PersonRef; title: TitleRef; note: string | null; reaction: string | null; at: string }[];
  received: { person: PersonRef; title: TitleRef; note: string | null; reaction: string | null; at: string }[];
};

export type AdminUserActivity = {
  activity: { type: string; title: TitleRef; rating: number | null; at: string }[];
  moods: { mood: string; time: string; company: string | null; picks: string[]; chosen: string | null; at: string }[];
  searches: { query: string; at: string }[];
};

export type AuditRow = {
  id: string;
  at: string;
  action: string;
  admin: { uid: string; name: string; handle: string | null };
  target: { uid: string; name: string; handle: string | null } | null;
  details: Record<string, unknown>;
  ip: string | null;
};

export type AuditPage = { rows: AuditRow[]; total: number; page: number; pageSize: number };
