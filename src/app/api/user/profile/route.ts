import { NextRequest } from "next/server";
import { jsonError, requireUser, validateUsername, AuthError } from "@/lib/auth";
import { getStore } from "@/lib/store";

/** PATCH /api/user/profile — update username and/or avatar (data URL). */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as {
      username?: string;
      avatarUrl?: string | null;
    };

    const patch: { username?: string; avatarUrl?: string | null } = {};

    if (body.username !== undefined) {
      const username = body.username.trim();
      const err = validateUsername(username);
      if (err) throw new AuthError(err, 400);
      patch.username = username;
    }

    if (body.avatarUrl !== undefined) {
      if (body.avatarUrl === null) {
        patch.avatarUrl = null;
      } else {
        const url = body.avatarUrl;
        // Avatar must be a small data-URL image (client resizes to 256px, ~<=300KB).
        if (!/^data:image\/(png|jpeg|webp);base64,/.test(url)) {
          throw new AuthError("Avatar must be a PNG/JPEG/WebP image", 400);
        }
        if (url.length > 420_000) {
          throw new AuthError("Avatar too large — pick a smaller image", 413);
        }
        patch.avatarUrl = url;
      }
    }

    const store = await getStore();
    try {
      const updated = await store.updateProfile(user.id, patch);
      return Response.json({ success: true, user: updated });
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (/unique/i.test(message)) throw new AuthError("That username is taken", 409);
      throw e;
    }
  } catch (err) {
    return jsonError(err);
  }
}
