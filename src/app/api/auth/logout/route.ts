import { clearSession, jsonError } from "@/lib/auth";

export async function POST() {
  try {
    await clearSession();
    return Response.json({ success: true });
  } catch (err) {
    return jsonError(err);
  }
}
