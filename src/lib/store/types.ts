/**
 * Shared store contract — implemented by:
 *   - store/mongo.ts  (MongoDB Atlas, used when MONGODB_URI is set)
 *   - store/sqlite.ts (Prisma + SQLite local fallback for dev/preview)
 */

export type Preferences = {
  theme?: "dark" | "midnight" | "dim" | "contrast";
  accent?: string; // accent palette id (violet, sakura, ocean, ...)
  titleLang?: "romaji" | "english";
  defaultServer?: "sub" | "dub" | "system";
  autoplayNext?: boolean;
  /** FIX (v1.1.2): auto-start playback as soon as a stream attaches */
  autoplay?: boolean;
  /** FIX (v1.1.2): automatically seek past intro / outro windows */
  autoSkip?: boolean;
  /**
   * FIX (v1.2.0 — §2): which player engine loads first on the watch page.
   * Set from the Settings page; the watch-page switcher still changes the
   * engine for the current session without overriding this default.
   */
  defaultPlayer?: "plyr" | "vidk" | "senshi" | "iframe";
  reducedMotion?: boolean;
  ambientMode?: boolean;
};

export type SafeUser = {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  preferences: Preferences;
  createdAt: string;
};

export type ProgressInput = {
  animeKey: string;
  animeTitle: string;
  poster?: string | null;
  episode: number;
  positionSeconds: number;
  durationSeconds: number;
};

export type ProgressRecord = ProgressInput & { updatedAt: string };

export type ListStatus = "watching" | "planning" | "completed" | "on-hold" | "dropped";

export type ListInput = {
  animeKey: string;
  animeTitle: string;
  poster?: string | null;
  status: ListStatus;
};

export type ListRecord = ListInput & { updatedAt: string };

export interface UserStore {
  init(): Promise<void>;
  createUser(username: string, email: string, passwordHash: string): Promise<SafeUser>;
  findByLogin(login: string): Promise<{ id: string; passwordHash: string } | null>;
  findById(id: string): Promise<SafeUser | null>;
  updateProfile(
    id: string,
    patch: { username?: string; avatarUrl?: string | null }
  ): Promise<SafeUser>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  updatePreferences(id: string, prefs: Preferences): Promise<SafeUser>;
  upsertProgress(userId: string, input: ProgressInput): Promise<ProgressRecord>;
  getProgress(userId: string, animeKey: string): Promise<ProgressRecord | null>;
  listProgress(userId: string, limit?: number): Promise<ProgressRecord[]>;
  deleteProgress(userId: string, animeKey: string): Promise<void>;
  upsertListItem(userId: string, input: ListInput): Promise<ListRecord>;
  getListItem(userId: string, animeKey: string): Promise<ListRecord | null>;
  listUserList(userId: string, status?: ListStatus): Promise<ListRecord[]>;
  deleteListItem(userId: string, animeKey: string): Promise<void>;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "dark",
  accent: "violet",
  titleLang: "romaji",
  defaultServer: "system",
  autoplayNext: true,
  autoplay: true,
  autoSkip: false,
  defaultPlayer: undefined,
  reducedMotion: false,
  ambientMode: false,
};

export function mergePreferences(raw: unknown): Preferences {
  /**
   * FIX (v1.2.1): the SQLite column is declared `preferences String` — Prisma
   * hands the JSON blob back as a STRING, so spreading it over the defaults
   * spread the string's CHARACTERS and every read (auth/me, PATCH responses,
   * sign-in merge) silently returned pure defaults. Signed-in preference
   * sync (theme, toggles, default player/server) never survived a session
   * even though the write path stored the JSON correctly. Parse strings
   * before merging; objects (Mongo store) pass through unchanged.
   */
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFERENCES };
  return { ...DEFAULT_PREFERENCES, ...(raw as Preferences) };
}

export function publicUser(u: {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
  preferences: unknown;
  createdAt: Date | string;
}): SafeUser {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    avatarUrl: u.avatarUrl ?? null,
    preferences: mergePreferences(u.preferences),
    createdAt: typeof u.createdAt === "string" ? u.createdAt : u.createdAt.toISOString(),
  };
}
