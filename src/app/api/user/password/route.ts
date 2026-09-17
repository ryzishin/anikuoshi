import { NextRequest } from "next/server";
import {
  AuthError,
  currentUserId,
  hashPassword,
  jsonError,
  validatePassword,
  verifyPassword,
} from "@/lib/auth";
import { getStore } from "@/lib/store";

/**
 * POST /api/user/password — change password (old + new + confirm).
 * There is deliberately NO reset/recovery flow: password changes require
 * the current password.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) throw new AuthError("Not signed in", 401);

    const body = (await req.json().catch(() => ({}))) as {
      current?: string;
      next?: string;
      confirm?: string;
    };
    const { current, next, confirm } = body;
    if (!current || !next) throw new AuthError("Fill in all password fields", 400);
    if (next !== confirm) throw new AuthError("New passwords do not match", 400);

    const err = validatePassword(next);
    if (err) throw new AuthError(err, 400);
    if (next === current) throw new AuthError("New password must differ from the old one", 400);

    const store = await getStore();
    const record = await store.findById(userId);
    if (!record) throw new AuthError("User not found", 404);
    const full = await store.findByLogin(record.email);
    if (!full || !(await verifyPassword(current, full.passwordHash))) {
      throw new AuthError("Current password is incorrect", 403);
    }

    await store.updatePassword(userId, await hashPassword(next));
    return Response.json({ success: true });
  } catch (err) {
    return jsonError(err);
  }
}
