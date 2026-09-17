"use client";

/**
 * FIX (v1.3.0 — §2): the home feed tabs — Spotlight · Trending · Recently
 * updated · Popular · Top airing · Upcoming — rendered as a GRID (density is
 * now controlled by the pagination control beside the tab bar, not by
 * horizontal rows). Each tab fetches lazily and rides the shared 120 s
 * browse cache; `‹ n ›` flips pages where the endpoint supports it and
 * disables when a feed is a single page.
 */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCcw, Signal, Sparkles, Star, Popcorn, Flame } from "lucide-react";
import { AnimeCard, type CardItem } from "@/components/anime/anime-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  airing,
  homePage,
  latestUpdated,
  popular,
  trending,
  upcoming,
  type KazeItem,
} from "@/lib/api";

type TabId = "spotlight" | "trending" | "recent" | "popular" | "airing" | "upcoming";

/**
 * §2: pagination support follows the API — /api/latest-updated takes a page
 * param; spotlight/trending/popular/top-airing/upcoming are single-page
 * feeds upstream, so the control shows "1/1" there (next disabled).
 */
const TABS: { id: TabId; label: string; icon: React.ReactNode; paginated: boolean }[] = [
  { id: "spotlight", label: "Spotlight", icon: <Star className="h-4 w-4 text-amber-300" />, paginated: false },
  { id: "trending", label: "Trending", icon: <Flame className="h-4 w-4 text-orange-400" />, paginated: false },
  { id: "recent", label: "Recently updated", icon: <RefreshCcw className="h-4 w-4 text-emerald-400" />, paginated: true },
  { id: "popular", label: "Popular", icon: <Sparkles className="h-4 w-4 text-pink-400" />, paginated: false },
  { id: "airing", label: "Top airing", icon: <Signal className="h-4 w-4 text-cyan-400" />, paginated: false },
  { id: "upcoming", label: "Upcoming", icon: <Popcorn className="h-4 w-4 text-amber-400" />, paginated: false },
];

async function fetchTab(tab: TabId, page: number): Promise<KazeItem[]> {
  switch (tab) {
    case "spotlight": {
      const h = await homePage();
      return h.spotlights ?? [];
    }
    case "trending":
      return trending();
    case "recent":
      return latestUpdated(page);
    case "popular":
      return popular();
    case "airing": {
      const h = await homePage();
      return h.topAiring?.length ? h.topAiring : await airing();
    }
    case "upcoming":
      return upcoming();
  }
}

export function HomeFeedTabs() {
  const [tab, setTab] = useState<TabId>("spotlight");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<KazeItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setItems(null);
    fetchTab(tab, page)
      .then((list) => alive && setItems(list))
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tab, page]);

  const activeTab = TABS.find((t) => t.id === tab)!;
  const canPrev = page > 1 && !loading;
  const canNext = !loading && Boolean(items && items.length > 0) && activeTab.paginated;

  return (
    <section className="py-3" aria-label="Discovery feed" data-testid="home-feed-tabs">
      {/* tab bar + pagination control */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6">
        <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full border border-border/70 bg-card/60 p-1" role="tablist" aria-label="Discovery feeds">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* §2: the <n> pagination control */}
        <div className="flex items-center gap-1" data-testid="feed-pagination">
          <button
            aria-label="Previous page"
            disabled={!canPrev}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-card/60 text-foreground transition-colors hover:bg-accent disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[4.5rem] text-center text-xs font-medium text-muted-foreground" aria-live="polite">
            Page {page}
            {!activeTab.paginated ? " · 1/1" : ""}
          </span>
          <button
            aria-label="Next page"
            disabled={!canNext}
            onClick={() => setPage((p) => p + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-card/60 text-foreground transition-colors hover:bg-accent disabled:opacity-35"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* grid — density comes from pagination, not horizontal scroll */}
      <div className="px-4 sm:px-6">
        {loading || !items ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                <Skeleton className="h-3.5 w-4/5" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 py-14 text-center">
            <p className="text-sm font-medium">Nothing here right now</p>
            <p className="mt-1 text-xs text-muted-foreground">Check back soon or pick another feed.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" data-testid="feed-grid">
            {items.map((item, i) => (
              <AnimeCard key={`${item.slug || item.key || item.title}-${i}`} item={item as CardItem} index={i % 12} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
