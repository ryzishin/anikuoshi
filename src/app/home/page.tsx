"use client";

/**
 * /home — the discovery feed (v1.3.0 restructure, per spec §2):
 *
 *   1. Continue watching (signed in)
 *   2. TOP 10 — looping hero carousel (like the landing hero), Today/Week/Month
 *   3. TABBED FEEDS in a GRID — Spotlight / Trending / Recently updated /
 *      Popular / Top airing / Upcoming — with a `‹ n ›` pagination control
 *      beside the tab bar
 *   4. Sidebar: today's release schedule + sign-in nudge
 *
 * The old horizontal card rows are gone; density is controlled by the
 * pagination control. The hero uses Top 10 art enriched with the spotlight
 * lane's landscape covers (art available from the API).
 */
import { useEffect, useState } from "react";
import { CalendarClock, ListOrdered } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HtmxFragment } from "@/components/htmx-fragment";
import { useAuth } from "@/components/auth-provider";
import { usePreferences } from "@/components/preferences-provider";
import { ContinueRow } from "@/components/home/continue-row";
import { TopTenCarousel, type SpotlightArt } from "@/components/home/top-ten-carousel";
import { HomeFeedTabs } from "@/components/home/home-feed-tabs";
import { homePage, type HomePayload } from "@/lib/api";

/** Build the art lookup for the carousel: key/slug/title → landscape art. */
function buildArtIndex(data: HomePayload | null): SpotlightArt {
  const map = new Map<string, { cover?: string | null; backdrop?: string | null; description?: string | null }>();
  const put = (item: {
    key?: string | null; slug?: string; title?: string; titleRomaji?: string | null;
    cover?: string | null; backdrop?: string | null; description?: string | null; synopsis?: string | null;
  }) => {
    const keys = [item.key, item.slug, item.title, item.titleRomaji]
      .filter(Boolean)
      .map((k) => String(k).toLowerCase());
    if (!keys.length) return;
    const entry = {
      cover: item.cover ?? null,
      backdrop: item.backdrop ?? null,
      description: item.description ?? item.synopsis ?? null,
    };
    for (const k of keys) if (!map.has(k)) map.set(k, entry);
  };
  for (const s of data?.spotlights ?? []) put(s);
  for (const t of data?.trending ?? []) put(t);
  for (const a of data?.topAiring ?? []) put(a);
  return map;
}

export default function HomePage() {
  const [data, setData] = useState<HomePayload | null>(null);
  const { user } = useAuth();
  const { titleLang } = usePreferences();

  useEffect(() => {
    let alive = true;
    homePage()
      .then((h) => alive && setData(h))
      .catch(() => alive && setData({ spotlights: [], trending: [], topAiring: [], genres: [] }));
    return () => {
      alive = false;
    };
  }, []);

  const artByKey = buildArtIndex(data);

  // Rows render their own skeletons — the page mounts instantly.
  return (
    <div className="mx-auto w-full max-w-7xl px-0 pb-16 pt-6 sm:px-6">
      <div className="flex items-end justify-between px-4 sm:px-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {user ? `Welcome back, ${user.username}` : "Discover what's airing"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Top 10 first, then every feed in one tabbed grid.
          </p>
        </div>
      </div>

      {/* FIX (v1.1.1): explicit mobile track — implicit auto tracks size to
          content and can overflow narrow phones the same way /watch did. */}
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {user && <ContinueRow />}
          {/* §2: Top 10 FIRST, as the looping hero carousel */}
          <TopTenCarousel artByKey={artByKey} titleLang={titleLang} />
          {/* §2: tabbed feeds + pagination, rendered as a grid */}
          <HomeFeedTabs />
        </div>

        {/* -------------------------------------------------- sidebar */}
        <aside className="space-y-4 px-4 sm:px-0" aria-label="Release schedule">
          <Card className="border-border/70 bg-card/70 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="h-4 w-4 text-primary" />
                Today&apos;s releases
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3">
              <HtmxFragment url="/api/fragments/schedule" height={200} />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ListOrdered className="h-4 w-4 text-primary" />
                Jump back in
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Sign in to sync watch progress across devices. Your position is saved every few
                seconds while streaming, and Continue Watching puts the next episode one tap away.
              </p>
              {!user && (
                <a
                  href="/login"
                  className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground"
                >
                  Create a free account
                </a>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
