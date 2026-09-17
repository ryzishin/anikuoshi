"use client";

/**
 * /home — the discovery feed: continue watching, top-ten, spotlight,
 * recently updated, popular, upcoming + today's release schedule sidebar.
 *
 * FIX (v1.2.1): the "Trending now" row was removed — APIKuoshi v2.3.0 serves
 * /api/trending (and home.trending) with the SAME 12 entries that lead
 * /api/latest-updated (verified live: 12/12 title overlap), so the row read
 * as a duplicate of "Recently updated". The new "Spotlight" row surfaces the
 * v2.3.0 spotlights (art-enriched banner/cover picks) instead.
 * Row order: Top 10 → Spotlight → Recently updated → Popular → Top airing → Coming soon.
 */
import { useEffect, useState } from "react";
import { CalendarClock, ListOrdered, Popcorn, RefreshCcw, Signal, Sparkles, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardRow } from "@/components/anime/card-row";
import { HtmxFragment } from "@/components/htmx-fragment";
import { useAuth } from "@/components/auth-provider";
import { usePreferences } from "@/components/preferences-provider";
import { ContinueRow } from "@/components/home/continue-row";
import { TopTenRow } from "@/components/home/top-ten-row";
import {
  homePage,
  latestUpdated,
  popular,
  upcoming,
  type HomePayload,
  type KazeItem,
} from "@/lib/api";

export default function HomePage() {
  const [data, setData] = useState<HomePayload | null>(null);
  const [recent, setRecent] = useState<KazeItem[] | null>(null);
  const [pop, setPop] = useState<KazeItem[] | null>(null);
  const [upcomingItems, setUpcomingItems] = useState<KazeItem[] | null>(null);
  const { user, loading } = useAuth();
  const { titleLang } = usePreferences();
  void titleLang;

  useEffect(() => {
    let alive = true;
    homePage().then((h) => alive && setData(h)).catch(() => alive && setData({ spotlights: [], trending: [], topAiring: [], genres: [] }));
    latestUpdated().then((r) => alive && setRecent(r)).catch(() => alive && setRecent([]));
    popular().then((r) => alive && setPop(r)).catch(() => alive && setPop([]));
    upcoming().then((r) => alive && setUpcomingItems(r)).catch(() => alive && setUpcomingItems([]));
    return () => {
      alive = false;
    };
  }, []);

  // Rows render their own skeletons — the page mounts instantly.
  return (
    <div className="mx-auto w-full max-w-7xl px-0 pb-16 pt-6 sm:px-6">
      <div className="flex items-end justify-between px-4 sm:px-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {user ? `Welcome back, ${user.username}` : "Discover what's airing"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Top titles, spotlight picks and fresh episodes — all in one place.
          </p>
        </div>
      </div>

      {/* FIX (v1.1.1): explicit mobile track — implicit auto tracks size to
          content and can overflow narrow phones the same way /watch did. */}
      {/* FIX (v1.2.0): repaired the lg template class - v1.1.2 shipped it with
          the opening bracket missing, so the desktop two-column layout silently
          fell back to a single auto column. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {user && <ContinueRow />}
          <TopTenRow />
          {/* FIX (v1.2.1): Spotlight row — replaced the removed Trending row
              (its data duplicated Recently updated); spotlights carry the
              v2.3.0 art-enriched banner/cover picks from /api/home. */}
          <CardRow
            title="Spotlight"
            icon={<Star className="h-4.5 w-4.5 text-amber-300" />}
            items={data?.spotlights}
            loading={!data}
          />
          <CardRow
            title="Recently updated"
            icon={<RefreshCcw className="h-4.5 w-4.5 text-emerald-400" />}
            items={recent ?? undefined}
            loading={recent === null}
          />
          <CardRow
            title="Popular with everyone"
            icon={<Sparkles className="h-4.5 w-4.5 text-pink-400" />}
            items={pop ?? undefined}
            loading={pop === null}
          />
          <CardRow
            title="Top airing"
            icon={<Signal className="h-4.5 w-4.5 text-cyan-400" />}
            items={data?.topAiring}
            loading={!data}
          />
          <CardRow
            title="Coming soon"
            icon={<Popcorn className="h-4.5 w-4.5 text-amber-400" />}
            items={upcomingItems ?? undefined}
            loading={upcomingItems === null}
          />
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
                  className="brand-gradient mt-3 inline-flex h-9 items-center justify-center rounded-lg px-4 text-xs font-semibold text-white"
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
