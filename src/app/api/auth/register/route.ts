import { NextRequest } from "next/server";
import {
  AuthError,
  hashPassword,
  issueSession,
  jsonError,
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/auth";
import { getStore } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      username?: string;
      email?: string;
      password?: string;
    };
    const username = (body.username || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    const err =
      validateUsername(username) || validateEmail(email) || validatePassword(password);
    if (err) return Response.json({ success: false, error: err }, { status: 400 });

    const store = await getStore();

    // Uniqueness checks (username + email must be unique).
    const existingByEmail = await store.findByLogin(email).catch(() => null);
    if (existingByEmail) {
      return Response.json(
        { success: false, error: "An account with this email already exists" },
        { status: 409 }
      );
    }
    const existingByUsername = await store.findByLogin(username).catch(() => null);
    if (existingByUsername) {
      return Response.json(
        { success: false, error: "This username is taken" },
        { status: 409 }
      );
    }

    const user = await store.createUser(username, email, await hashPassword(password));
    await issueSession(user.id);
    return Response.json({ success: true, user });
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err);
    const message = err instanceof Error ? err.message : "Registration failed";
    return Response.json({ success: false, error: message }, { status: 400 });
  }
}
