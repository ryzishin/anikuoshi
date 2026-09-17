/**
 * Store singleton — picks the driver at runtime:
 *   MONGODB_URI set  -> MongoDB Atlas (production / Vercel)
 *   otherwise        -> Prisma + SQLite (local dev & preview)
 */
import { UserStore } from "./types";

let store: UserStore | null = null;
let initPromise: Promise<UserStore> | null = null;

async function resolveStore(): Promise<UserStore> {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    const { MongoStore } = await import("./mongo");
    const s = new MongoStore(uri);
    await s.init();
    return s;
  }
  const { SqliteStore } = await import("./sqlite");
  const s = new SqliteStore();
  await s.init();
  return s;
}

export function getStore(): Promise<UserStore> {
  if (!initPromise) {
    initPromise = resolveStore().then((s) => {
      store = s;
      return s;
    });
  }
  return initPromise;
}

export type { UserStore } from "./types";
