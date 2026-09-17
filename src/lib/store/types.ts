/**
 * Shared store contract — implemented by:
 *   - store/mongo.ts  (MongoDB Atlas, used when MONGODB_URI is set)
 *   - store/sqlite.ts (Prisma + SQLite local fallback for dev/preview)
 */

export type Preferences = {
  theme?: "dark" | "midnight" | "dim" | "contrast";
  accent?: string; // accent palette id (violet, sakura, ocean, ...)
  /**
   * FIX (v1.3.0 — §8): the old single "Title language" setting is SPLIT:
   *   titleLang — how ANIME TITLES render (English | Romaji)
   *   charLang  — how CHARACTERS render (English | Romaji — Western vs
   *               family-name-first order; see characterDisplayName())
   */
  titleLang?: "romaji" | "english";
  charLang?: "romaji" | "english";
  /**
   * FIX (v1.3.0 — §8): NEW "Default Language" — sub vs dub preference that
   * drives the watch page's default stream selection (replaces the old
   * sub/dub half of defaultServer; see defaultProvider below).
   */
  defaultLanguage?: "sub" | "dub" | "system";
  /**
   * FIX (v1.3.0 — §8): "Default Server" renamed → "Default Provider" and
   * upgraded to the API's server codenames (riyo, kaito, hana, sora, …).
   * "system" = auto. When the chosen provider is unavailable for the
   * current anime/episode the loader falls back to auto ordering.
   */
  defaultProvider?: string;
  /** legacy v1.2.x key — read for migration, then superseded by
   *  defaultLanguage (sub/dub) + defaultProvider (system). */
  defaultServer?: "sub" | "dub" | "system";
  autoplayNext?: boolean;
  /** FIX (v1.1.2): auto-start playback as soon as a stream attaches */
  autoplay?: boolean;
  /** FIX (v1.1.2): automatically seek past intro / outro windows */
  autoSkip?: boolean;
  /**
   * FIX (v1.2.0 — §2): which player engine loads first on the watch page.
   * v1.3.0: only Vidk and Embed remain.
   */
  defaultPlayer?: "vidk" | "iframe";
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
  charLang: "romaji",
  defaultLanguage: "system",
  defaultProvider: "system",
  autoplayNext: true,
  autoplay: true,
  autoSkip: false,
  defaultPlayer: undefined,
  reducedMotion: false,
  ambientMode: false,
};

/**
 * FIX (v1.3.0 — §8): one-time migration of the v1.2.x `defaultServer`
 * pref ("sub" | "dub" | "system") onto the split settings:
 *   sub/dub → defaultLanguage   (audio track choice)
 *   system  → defaultProvider stays "system" (auto)
 * Runs on every merge — cheap, idempotent, only fills when the new keys
 * are absent so an explicit user choice always wins.
 */
export function migratePreferences(raw: Preferences): Preferences {
  const out = { ...raw };
  if (!out.defaultLanguage && out.defaultServer && out.defaultServer !== "system") {
    out.defaultLanguage = out.defaultServer;
  }
  if (!out.defaultProvider) out.defaultProvider = "system";
  if (!out.charLang) out.charLang = "romaji";
  return out;
}

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
  return migratePreferences({ ...DEFAULT_PREFERENCES, ...(raw as Preferences) });
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
