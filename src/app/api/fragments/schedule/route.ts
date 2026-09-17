/**
 * EJS-rendered HTML fragment: today's release schedule.
 * Consumed by htmx on /home and /watch sidebars.
 *
 * GET /api/fragments/schedule
 */
import { NextRequest } from "next/server";
import path from "path";
import { schedule as fetchSchedule } from "@/lib/api";

export const revalidate = 300;

async function renderEjs(file: string, data: Record<string, unknown>): Promise<string> {
  const ejs = (await import("ejs")).default;
  const fs = await import("fs/promises");
  const template = await fs.readFile(path.join(process.cwd(), "src/lib/fragments", file), "utf8");
  return ejs.render(template, data, { async: false });
}

export async function GET(req: NextRequest) {
  const tz = req.nextUrl.searchParams.get("tz");
  void tz; // upstream publishes times in its own timezone; rendered verbatim
  let entries: Awaited<ReturnType<typeof fetchSchedule>> = [];
  try {
    entries = await fetchSchedule();
  } catch {
    entries = [];
  }

  /**
   * FIX (v1.1.1): navKey is computed HERE (title-first) so the fragment links
   * behave like every other card in the app. Slug links from the schedule
   * sidebar were the slow/fragile path — they relied on the details page's
   * search resolver and could surface "No anime found" when the API
   * hiccuped. Plain titles resolve directly on the API.
   * FIX (v1.2.0 — §5): with the v2.3.0 canonical shape, schedule rows carry a
   * resolvable `key` — when it is already a canonical id (anilist:/mal:) use
   * it directly, exactly like itemKey() does for cards.
   */
  const safe = entries.slice(0, 12).map((e) => {
    const canonical = /^(anilist|mal):\d+$/.test(String(e.key ?? "")) ? String(e.key) : "";
    return {
      slug: e.slug ?? "",
      navKey:
        canonical ||
        String(e.title ?? "").trim() ||
        String(e.slug ?? "").replace(/\/ep-\d+.*$/i, ""),
      title: String(e.title ?? "").slice(0, 120),
      time: String(e.time ?? "").slice(0, 8),
      episode_no: typeof e.episode_no === "number" ? e.episode_no : null,
    };
  });

  const html = await renderEjs("schedule.ejs", { entries: safe });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
