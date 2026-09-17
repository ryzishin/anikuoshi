/**
 * EJS-rendered HTML fragments served to htmx (server-rendered partials
 * where fragments make sense — the quick-search suggestions dropdown).
 *
 * GET /api/fragments/suggestions?keyword=naruto
 */
import { NextRequest } from "next/server";
import path from "path";
import { suggestions as fetchSuggestions } from "@/lib/api";

export const dynamic = "force-dynamic";

// Tiny TTL cache so keystrokes don't hammer the upstream API.
const cache = new Map<string, { at: number; items: unknown[] }>();
const TTL = 30_000;

async function renderEjs(file: string, data: Record<string, unknown>): Promise<string> {
  const ejs = (await import("ejs")).default;
  const fs = await import("fs/promises");
  const template = await fs.readFile(path.join(process.cwd(), "src/lib/fragments", file), "utf8");
  return ejs.render(template, data, { async: false });
}

export async function GET(req: NextRequest) {
  const keyword = (req.nextUrl.searchParams.get("keyword") || "").trim();
  if (!keyword) return new Response("", { headers: { "Content-Type": "text/html; charset=utf-8" } });

  const cacheKey = keyword.toLowerCase();
  const hit = cache.get(cacheKey);
  let items: Awaited<ReturnType<typeof fetchSuggestions>>;

  if (hit && Date.now() - hit.at < TTL && hit.items.length > 0) {
    items = hit.items as typeof items;
  } else {
    try {
      items = await fetchSuggestions(keyword.slice(0, 40));
    } catch {
      items = [];
    }
    // Only cache non-empty results — upstream cold starts must not poison
    // the fragment cache with "no matches".
    if (items.length > 0) {
      cache.set(cacheKey, { at: Date.now(), items });
      if (cache.size > 100) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (oldest) cache.delete(oldest[0]);
      }
    }
  }

  // Only pass what the template needs.
  const safe = items.slice(0, 8).map((s) => ({
    slug: s.slug ?? "",
    title: String(s.title ?? "").slice(0, 120),
    poster: typeof s.poster === "string" && /^https:\/\//.test(s.poster) ? s.poster : "",
    type: String(s.type ?? "").slice(0, 20),
  }));

  const html = await renderEjs("suggestions.ejs", { suggestions: safe });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
