import { NextRequest } from "next/server";
import { jsonError, requireUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { mergePreferences } from "@/lib/store/types";

/** PATCH /api/user/preferences — merge + persist user preferences. */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const patch = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const merged = mergePreferences({ ...user.preferences, ...patch });
    const store = await getStore();
    const updated = await store.updatePreferences(user.id, merged);
    return Response.json({ success: true, user: updated });
  } catch (err) {
    return jsonError(err);
  }
}
