/**
 * Prisma + SQLite driver — local/dev fallback so the app is fully runnable
 * (and previewable) without MongoDB Atlas credentials.
 */
import { db } from "@/lib/db";
import {
  ListInput,
  ListRecord,
  ListStatus,
  Preferences,
  ProgressInput,
  ProgressRecord,
  SafeUser,
  UserStore,
  publicUser,
} from "./types";

export class SqliteStore implements UserStore {
  async init() {
    // Prisma manages schema/migrations — nothing to do.
  }

  async createUser(username: string, email: string, passwordHash: string): Promise<SafeUser> {
    const user = await db.user.create({
      data: { username, email: email.toLowerCase(), passwordHash },
    });
    return publicUser(user);
  }

  async findByLogin(login: string) {
    const key = login.trim().toLowerCase();
    // SQLite: no case-insensitive mode — match email exactly (stored
    // lowercased) and usernames via a small in-memory scan fallback.
    const byEmail = await db.user.findFirst({
      where: { OR: [{ email: key }, { username: login.trim() }] },
      select: { id: true, passwordHash: true },
    });
    if (byEmail) return byEmail;
    const candidates = await db.user.findMany({
      select: { id: true, username: true, passwordHash: true },
      take: 1000,
    });
    const hit = candidates.find((u) => u.username.toLowerCase() === key);
    return hit ? { id: hit.id, passwordHash: hit.passwordHash } : null;
  }

  async findById(id: string): Promise<SafeUser | null> {
    const user = await db.user.findUnique({ where: { id } });
    return user ? publicUser(user) : null;
  }

  async updateProfile(
    id: string,
    patch: { username?: string; avatarUrl?: string | null }
  ): Promise<SafeUser> {
    const user = await db.user.update({ where: { id }, data: patch });
    return publicUser(user);
  }

  async updatePassword(id: string, passwordHash: string) {
    await db.user.update({ where: { id }, data: { passwordHash } });
  }

  async updatePreferences(id: string, prefs: Preferences): Promise<SafeUser> {
    const user = await db.user.update({
      where: { id },
      data: { preferences: JSON.stringify(prefs) },
    });
    return publicUser(user);
  }

  async upsertProgress(userId: string, input: ProgressInput): Promise<ProgressRecord> {
    const row = await db.watchProgress.upsert({
      where: { userId_animeKey: { userId, animeKey: input.animeKey } },
      create: { userId, ...input, poster: input.poster ?? null },
      update: {
        episode: input.episode,
        positionSeconds: input.positionSeconds,
        durationSeconds: input.durationSeconds,
        animeTitle: input.animeTitle,
        poster: input.poster ?? null,
      },
    });
    return { ...input, poster: row.poster, updatedAt: row.updatedAt.toISOString() };
  }

  async getProgress(userId: string, animeKey: string): Promise<ProgressRecord | null> {
    const row = await db.watchProgress.findUnique({ where: { userId_animeKey: { userId, animeKey } } });
    return row
      ? {
          animeKey: row.animeKey,
          animeTitle: row.animeTitle,
          poster: row.poster,
          episode: row.episode,
          positionSeconds: row.positionSeconds,
          durationSeconds: row.durationSeconds,
          updatedAt: row.updatedAt.toISOString(),
        }
      : null;
  }

  async listProgress(userId: string, limit = 24): Promise<ProgressRecord[]> {
    const rows = await db.watchProgress.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
    return rows.map((row) => ({
      animeKey: row.animeKey,
      animeTitle: row.animeTitle,
      poster: row.poster,
      episode: row.episode,
      positionSeconds: row.positionSeconds,
      durationSeconds: row.durationSeconds,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async deleteProgress(userId: string, animeKey: string) {
    await db.watchProgress.deleteMany({ where: { userId, animeKey } });
  }

  async upsertListItem(userId: string, input: ListInput): Promise<ListRecord> {
    const row = await db.userListEntry.upsert({
      where: { userId_animeKey: { userId, animeKey: input.animeKey } },
      create: { userId, ...input, poster: input.poster ?? null },
      update: {
        status: input.status,
        animeTitle: input.animeTitle,
        poster: input.poster ?? null,
      },
    });
    return { ...input, poster: row.poster, updatedAt: row.updatedAt.toISOString() };
  }

  async getListItem(userId: string, animeKey: string): Promise<ListRecord | null> {
    const row = await db.userListEntry.findUnique({ where: { userId_animeKey: { userId, animeKey } } });
    return row
      ? {
          animeKey: row.animeKey,
          animeTitle: row.animeTitle,
          poster: row.poster,
          status: row.status as ListStatus,
          updatedAt: row.updatedAt.toISOString(),
        }
      : null;
  }

  async listUserList(userId: string, status?: ListStatus): Promise<ListRecord[]> {
    const rows = await db.userListEntry.findMany({
      where: status ? { userId, status } : { userId },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
    return rows.map((row) => ({
      animeKey: row.animeKey,
      animeTitle: row.animeTitle,
      poster: row.poster,
      status: row.status as ListStatus,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async deleteListItem(userId: string, animeKey: string) {
    await db.userListEntry.deleteMany({ where: { userId, animeKey } });
  }
}
