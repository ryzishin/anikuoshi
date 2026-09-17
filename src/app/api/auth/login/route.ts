import { NextRequest } from "next/server";
import { AuthError, issueSession, jsonError, verifyPassword } from "@/lib/auth";
import { getStore } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { login?: string; password?: string };
    const login = (body.login || "").trim();
    const password = body.password || "";
    if (!login || !password) {
      return Response.json(
        { success: false, error: "Enter your email/username and password" },
        { status: 400 }
      );
    }

    const store = await getStore();
    const record = await store.findByLogin(login);
    if (!record || !(await verifyPassword(password, record.passwordHash))) {
      return Response.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    await issueSession(record.id);
    const user = await store.findById(record.id);
    return Response.json({ success: true, user });
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err);
    return jsonError(err);
  }
}
