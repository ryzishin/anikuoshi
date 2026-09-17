import { currentUser, jsonError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await currentUser();
    return Response.json({ success: true, user });
  } catch {
    return Response.json({ success: true, user: null });
  }
}
