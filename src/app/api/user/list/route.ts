import { NextRequest } from "next/server";
import { AuthError, currentUserId, jsonError } from "@/lib/auth";
import { getStore } from "@/lib/store";
import type { ListStatus } from "@/lib/store/types";

export const dynamic = "force-dynamic";

const STATUSES: ListStatus[] = ["watching", "planning", "completed", "on-hold", "dropped"];

/** GET /api/user/list[?status=] — user's anime list. */
export async function GET(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return Response.json({ success: true, items: [] });
    const store = await getStore();
    const status = req.nextUrl.searchParams.get("status") as ListStatus | null;
    const items = await store.listUserList(userId, status && STATUSES.includes(status) ? status : undefined);
    return Response.json({ success: true, items });
  } catch (err) {
    return jsonError(err);
  }
}

/** POST /api/user/list — add/update an entry. */
export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) throw new AuthError("Sign in to save anime to your list", 401);
    const body = (await req.json().catch(() => ({}))) as {
      animeKey?: string;
      animeTitle?: string;
      poster?: string | null;
      status?: ListStatus;
    };
    if (!body.animeKey || !body.animeTitle) throw new AuthError("animeKey and animeTitle are required", 400);
    const status: ListStatus = STATUSES.includes(body.status as ListStatus)
      ? (body.status as ListStatus)
      : "watching";

    const store = await getStore();
    const item = await store.upsertListItem(userId, {
      animeKey: body.animeKey,
      animeTitle: body.animeTitle,
      poster: body.poster ?? null,
      status,
    });
    return Response.json({ success: true, item });
  } catch (err) {
    return jsonError(err);
  }
}

/** DELETE /api/user/list?key= — remove an entry. */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) throw new AuthError("Not signed in", 401);
    const key = req.nextUrl.searchParams.get("key");
    if (!key) throw new AuthError("key is required", 400);
    const store = await getStore();
    await store.deleteListItem(userId, key);
    return Response.json({ success: true });
  } catch (err) {
    return jsonError(err);
  }
}
