import { NextRequest } from "next/server";
import { AuthError, currentUserId, jsonError } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** GET /api/user/progress?key= — one record, or the whole continue-watching list. */
export async function GET(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return Response.json({ success: true, progress: null, items: [] });
    const store = await getStore();
    const key = req.nextUrl.searchParams.get("key");
    if (key) {
      const progress = await store.getProgress(userId, key);
      return Response.json({ success: true, progress, items: [] });
    }
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "24", 10);
    const items = await store.listProgress(userId, Math.min(limit, 100));
    return Response.json({ success: true, progress: null, items });
  } catch (err) {
    return jsonError(err);
  }
}

/** POST /api/user/progress — upsert watch position. */
export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return Response.json({ success: true, guest: true });
    const body = (await req.json().catch(() => ({}))) as {
      animeKey?: string;
      animeTitle?: string;
      poster?: string | null;
      episode?: number;
      positionSeconds?: number;
      durationSeconds?: number;
    };
    if (!body.animeKey || !body.animeTitle) throw new AuthError("animeKey and animeTitle are required", 400);

    const store = await getStore();
    const rec = await store.upsertProgress(userId, {
      animeKey: body.animeKey,
      animeTitle: body.animeTitle,
      poster: body.poster ?? null,
      episode: Math.max(1, Math.floor(body.episode || 1)),
      positionSeconds: Math.max(0, body.positionSeconds || 0),
      durationSeconds: Math.max(0, body.durationSeconds || 0),
    });
    return Response.json({ success: true, progress: rec });
  } catch (err) {
    return jsonError(err);
  }
}

/** DELETE /api/user/progress?key= — remove an entry (finished / reset). */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) throw new AuthError("Not signed in", 401);
    const key = req.nextUrl.searchParams.get("key");
    if (!key) throw new AuthError("key is required", 400);
    const store = await getStore();
    await store.deleteProgress(userId, key);
    return Response.json({ success: true });
  } catch (err) {
    return jsonError(err);
  }
}
