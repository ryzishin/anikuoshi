/**
 * MongoDB Atlas driver (native `mongodb` package, no mongoose overhead).
 * Activated when MONGODB_URI is present — the production path for Vercel.
 */
import { Db, MongoClient } from "mongodb";
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

type UserDoc = {
  _id: string;
  username: string;
  email: string;
  passwordHash: string;
  avatarUrl: string | null;
  preferences: Preferences;
  createdAt: Date;
};

type ProgressDoc = {
  _id: string;
  userId: string;
  animeKey: string;
  animeTitle: string;
  poster: string | null;
  episode: number;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: Date;
};

type ListDoc = {
  _id: string;
  userId: string;
  animeKey: string;
  animeTitle: string;
  poster: string | null;
  status: ListStatus;
  updatedAt: Date;
};

const toRecord = (d: ProgressDoc): ProgressRecord => ({
  animeKey: d.animeKey,
  animeTitle: d.animeTitle,
  poster: d.poster,
  episode: d.episode,
  positionSeconds: d.positionSeconds,
  durationSeconds: d.durationSeconds,
  updatedAt: d.updatedAt.toISOString(),
});

const toListRecord = (d: ListDoc): ListRecord => ({
  animeKey: d.animeKey,
  animeTitle: d.animeTitle,
  poster: d.poster,
  status: d.status,
  updatedAt: d.updatedAt.toISOString(),
});

export class MongoStore implements UserStore {
  private client: MongoClient;
  private db: Db | null = null;

  constructor(uri: string) {
    this.client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 8000,
      retryWrites: true,
    });
  }

  async init() {
    if (!this.db) {
      await this.client.connect();
      const dbName = process.env.MONGODB_DB || "anikuoshi";
      this.db = this.client.db(dbName);
      await this.db.collection<UserDoc>("users").createIndex({ username: 1 }, { unique: true });
      await this.db.collection<UserDoc>("users").createIndex({ email: 1 }, { unique: true });
      await this.db
        .collection<ProgressDoc>("progress")
        .createIndex({ userId: 1, animeKey: 1 }, { unique: true });
      await this.db
        .collection<ListDoc>("listEntries")
        .createIndex({ userId: 1, animeKey: 1 }, { unique: true });
    }
  }

  private users() {
    if (!this.db) throw new Error("Mongo not initialized");
    return this.db.collection<UserDoc>("users");
  }
  private progress() {
    if (!this.db) throw new Error("Mongo not initialized");
    return this.db.collection<ProgressDoc>("progress");
  }
  private listEntries() {
    if (!this.db) throw new Error("Mongo not initialized");
    return this.db.collection<ListDoc>("listEntries");
  }

  async createUser(username: string, email: string, passwordHash: string): Promise<SafeUser> {
    const doc: UserDoc = {
      _id: crypto.randomUUID(),
      username,
      email: email.toLowerCase(),
      passwordHash,
      avatarUrl: null,
      preferences: {},
      createdAt: new Date(),
    };
    await this.users().insertOne(doc);
    return publicUser({ ...doc, id: doc._id, createdAt: doc.createdAt });
  }

  async findByLogin(login: string) {
    const key = login.trim().toLowerCase();
    const doc = await this.users().findOne({
      $or: [{ email: key }, { username: { $regex: `^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }],
    });
    return doc ? { id: doc._id, passwordHash: doc.passwordHash } : null;
  }

  async findById(id: string): Promise<SafeUser | null> {
    const doc = await this.users().findOne({ _id: id });
    if (!doc) return null;
    return publicUser({ ...doc, id: doc._id, createdAt: doc.createdAt });
  }

  async updateProfile(
    id: string,
    patch: { username?: string; avatarUrl?: string | null }
  ): Promise<SafeUser> {
    const set: Partial<UserDoc> = {};
    if (patch.username !== undefined) set.username = patch.username;
    if (patch.avatarUrl !== undefined) set.avatarUrl = patch.avatarUrl;
    await this.users().updateOne({ _id: id }, { $set: set });
    const user = await this.findById(id);
    if (!user) throw new Error("User not found");
    return user;
  }

  async updatePassword(id: string, passwordHash: string) {
    await this.users().updateOne({ _id: id }, { $set: { passwordHash } });
  }

  async updatePreferences(id: string, prefs: Preferences): Promise<SafeUser> {
    await this.users().updateOne({ _id: id }, { $set: { preferences: prefs } });
    const user = await this.findById(id);
    if (!user) throw new Error("User not found");
    return user;
  }

  async upsertProgress(userId: string, input: ProgressInput): Promise<ProgressRecord> {
    const doc: ProgressDoc = {
      _id: `${userId}:${input.animeKey}`,
      userId,
      ...input,
      poster: input.poster ?? null,
      updatedAt: new Date(),
    };
    await this.progress().replaceOne({ _id: doc._id }, doc, { upsert: true });
    return toRecord(doc);
  }

  async getProgress(userId: string, animeKey: string): Promise<ProgressRecord | null> {
    const doc = await this.progress().findOne({ userId, animeKey });
    return doc ? toRecord(doc) : null;
  }

  async listProgress(userId: string, limit = 24): Promise<ProgressRecord[]> {
    const docs = await this.progress()
      .find({ userId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();
    return docs.map(toRecord);
  }

  async deleteProgress(userId: string, animeKey: string) {
    await this.progress().deleteOne({ userId, animeKey });
  }

  async upsertListItem(userId: string, input: ListInput): Promise<ListRecord> {
    const doc: ListDoc = {
      _id: `${userId}:${input.animeKey}`,
      userId,
      ...input,
      poster: input.poster ?? null,
      updatedAt: new Date(),
    };
    await this.listEntries().replaceOne({ _id: doc._id }, doc, { upsert: true });
    return toListRecord(doc);
  }

  async getListItem(userId: string, animeKey: string): Promise<ListRecord | null> {
    const doc = await this.listEntries().findOne({ userId, animeKey });
    return doc ? toListRecord(doc) : null;
  }

  async listUserList(userId: string, status?: ListStatus): Promise<ListRecord[]> {
    const q = status ? { userId, status } : { userId };
    const docs = await this.listEntries().find(q).sort({ updatedAt: -1 }).limit(500).toArray();
    return docs.map(toListRecord);
  }

  async deleteListItem(userId: string, animeKey: string) {
    await this.listEntries().deleteOne({ userId, animeKey });
  }
}
