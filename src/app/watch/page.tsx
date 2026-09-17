"use client";

/**
 * /watch?key=<anime key>&ep=<n> — the streaming experience.
 *
 * Section order (v1.3.0):
 *   1. Player (Vidk / Embed) — top of page, primary focus
 *   2. Servers — ALWAYS visible panel directly below the player (v1.3.0:
 *      the Show/Hide toggle + the explanatory note are removed)
 *   3. Episodes — grid with per-episode thumbnail + episode name
 *   4. Seasons (prequel/sequel) & Specials (movies, OVA, ONA) — grouped
 *   5. Recommendations — bottom
 *
 * FIX (v1.3.0 — §4): the toggles row under the header is gone; prev/next +
 * the compact auto-play/auto-next/auto-skip toggles live in the engine's
 * under-player strip. Toggling never rewinds playback.
 * FIX (v1.3.0 — §9): unaired episodes and not-yet-aired shows render a
 * clean "Not aired yet" state — no player, no watch CTA. Episodes whose
 * streams genuinely don't exist render the clean empty state.
 * FIX (v1.3.0 — §4): the player receives the EPISODE thumbnail (v2.4.0
 * enrichment chain) for the Vidk poster — series poster only as fallback,
 * letterboxed, never stretched.
 */
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  ChevronLeft,
  Film,
  Grid3X3,
  Info,
  Layers,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimeCard } from "@/components/anime/anime-card";
import { PlayerEngine } from "@/components/player/player-engine";
import type { AudioPref } from "@/components/player/use-stream-loader";
import { HtmxFragment } from "@/components/htmx-fragment";
import { useAuth } from "@/components/auth-provider";
import { usePreferences } from "@/components/preferences-provider";
import { displayTitle } from "@/lib/api";
import {
  animeEpisodes,
  chain,
  franchiseSearch,
  isCanonicalKey,
  meta,
  recommendations as fetchRecommendations,
  resolveAnimeKey,
  type AnimeInfo,
  type Episode,
  type FranchiseGroup,
  type KazeItem,
} from "@/lib/api";

/**
 * FIX (v1.3.0 — §9): parse an upstream aired date ("Sep 29, 2023",
 * "2023-09-29", ISO) — null when absent or unparseable. A FUTURE date
 * marks the episode as unaired.
 */
function parseAiredDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isEpisodeUnaired(ep?: Episode | null, now = new Date()): boolean {
  const aired = parseAiredDate(ep?.aired);
  return aired !== null && aired.getTime() > now.getTime() + 60_000; // 1m tolerance
}

function WatchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { prefs, titleLang } = usePreferences();

  const urlKey = params.get("key") || "";
  const ep = Math.max(1, parseInt(params.get("ep") || "1", 10) || 1);

  /**
   * Legacy kaze-slug keys are resolved to canonical API keys via
   * resolveAnimeKey() before loading, so old shared links keep working.
   */
  const [activeKey, setActiveKey] = useState(urlKey);
  const [resolvingKey, setResolvingKey] = useState(() => needsResolve(urlKey));

  const [anime, setAnime] = useState<AnimeInfo | null>(null);
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [recs, setRecs] = useState<KazeItem[] | null>(null);
  const [franchise, setFranchise] = useState<FranchiseGroup | null>(null);
  /**
   * FIX (v1.2.0 — §7): exact resume — the server-side progress record for
   * THIS anime (signed-in users). Guests resume from localStorage in the engine.
   */
  const [resumeAt, setResumeAt] = useState<{ ep: number; t: number } | null>(null);

  useEffect(() => {
    setActiveKey(urlKey);
    const needs = needsResolve(urlKey);
    setResolvingKey(needs);
    if (!needs) return;
    let alive = true;
    resolveAnimeKey(urlKey)
      .then((r) => {
        if (!alive) return;
        setActiveKey(r.key);
        setResolvingKey(false);
      })
      .catch(() => alive && setResolvingKey(false));
    return () => {
      alive = false;
    };
  }, [urlKey]);

  // §7: fetch the saved progress for this anime — signed-in only.
  useEffect(() => {
    if (!user || !activeKey || resolvingKey) {
      setResumeAt(null);
      return;
    }
    let alive = true;
    fetch(`/api/user/progress?key=${encodeURIComponent(activeKey)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const p = d?.progress as { episode?: number; positionSeconds?: number } | null;
        setResumeAt(
          p && typeof p.positionSeconds === "number" && p.positionSeconds > 30 && p.episode
            ? { ep: p.episode, t: p.positionSeconds }
            : null
        );
      })
      .catch(() => alive && setResumeAt(null));
    return () => {
      alive = false;
    };
  }, [user, activeKey, resolvingKey]);

  useEffect(() => {
    if (!activeKey || resolvingKey) return;
    let alive = true;
    // /api/chain gives us anime + servers + verdict in one shot. On failure
    // fall back to /api/meta for the identity block.
    chain({ key: activeKey, ep, type: "all" })
      .then((c) => {
        if (!alive) return;
        setAnime((prev) => prev ?? c.anime);
      })
      .catch(() => {
        if (!alive) return;
        meta(activeKey)
          .then((m) => alive && setAnime((prev) => prev ?? m.anime))
          .catch(() => {});
      });
    animeEpisodes(activeKey)
      .then((list) => alive && setEpisodes(list))
      .catch(() => alive && setEpisodes([]));
    fetchRecommendations(activeKey, 12)
      .then((r) => alive && setRecs(r))
      .catch(() => alive && setRecs([]));
    return () => {
      alive = false;
    };
  }, [activeKey, resolvingKey, ep]);

  // seasons (prequel/sequel) + specials (movies, OVA, ONA) via franchise search
  useEffect(() => {
    if (!anime?.title || !activeKey) return;
    let alive = true;
    setFranchise(null);
    franchiseSearch(anime.title, anime.key || activeKey)
      .then((g) => alive && setFranchise(g))
      .catch(() => alive && setFranchise({ seasons: [], movies: [], specials: [] }));
    return () => {
      alive = false;
    };
  }, [anime?.title, anime?.key, activeKey]);

  /**
   * FIX (v1.3.0 — §8): the watch page's default stream selection now follows
   * the "Default Language" setting (sub / dub / system) instead of the old
   * defaultServer half-key.
   */
  const audioPref = (prefs.defaultLanguage as AudioPref) || "system";

  const total = episodes?.length ?? anime?.episodes ?? 0;
  const hasNext = total ? ep < total : true;
  const hasPrev = ep > 1;

  const navigate = useCallback(
    (n: number) => router.push(`/watch?key=${encodeURIComponent(activeKey)}&ep=${n}`, { scroll: false }),
    [router, activeKey]
  );

  const currentEpisode = episodes?.find((e) => e.number === ep);
  const display = anime ? displayTitle(anime, titleLang) : "Loading…";

  /**
   * FIX (v1.3.0 — §9): unaired detection — the series status OR this
   * episode's own aired date decides. PlayerEngine renders the clean state.
   */
  const seriesUnaired = (anime?.status || "").toLowerCase() === "not yet aired";
  const episodeUnaired = isEpisodeUnaired(currentEpisode) || (seriesUnaired && !currentEpisode);

  /**
   * FIX (v1.3.0 — §4): episode art for the player poster — the v2.4.0
   * enrichment chain's thumbnail when present, series poster as fallback
   * (never stretched — letterboxed by the Vidstack poster CSS).
   */
  const episodePoster = currentEpisode?.thumbnail || anime?.poster || null;

  /**
   * FIX (v1.2.0 — §6): chevron back button — browser history with a /home
   * fallback so deep links never close the site.
   */
  const goBack = useCallback(() => {
    const idx = typeof window !== "undefined" ? window.history.state?.idx ?? 0 : 0;
    if (idx > 0) router.back();
    else router.push("/home");
  }, [router]);

  if (!urlKey) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6">
        <Info className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">No anime selected</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick something from <Link href="/home" className="text-primary underline">Home</Link> or{" "}
          <Link href="/browse" className="text-primary underline">Browse</Link> first.
        </p>
      </div>
    );
  }

  const franchiseEmpty =
    franchise && franchise.seasons.length === 0 && franchise.movies.length === 0 && franchise.specials.length === 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-3 pb-16 pt-4 sm:px-6">
      {/* breadcrumb-ish header: chevron back + title + episode line */}
      <div className="mb-3 flex min-h-11 items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Go back"
          title="Back"
          data-testid="watch-back"
          onClick={goBack}
          className="min-touch shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <Link href={`/anime/${encodeURIComponent(activeKey)}`} className="block truncate text-base font-semibold hover:text-primary sm:text-lg">
            {display}
          </Link>
          <p className="text-xs text-muted-foreground">
            Episode {ep}
            {currentEpisode?.title ? ` · ${currentEpisode.title}` : ""}
            {currentEpisode?.filler ? " · filler" : ""}
          </p>
        </div>
      </div>

      {/*
        FIX (v1.1.1 — MOBILE): `grid-cols-1` = minmax(0,1fr) keeps the track
        shrinkable at every width; the lg: template takes over on desktop.
      */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        {/* ------------------------------------------------ main column */}
        <div className="min-w-0 space-y-6">
          {/* 1 ── PLAYER + 2 ── SERVERS (always visible, rendered by the engine) */}
          {!resolvingKey ? (
            <PlayerEngine
              animeKey={activeKey}
              animeTitle={display}
              episodeTitle={currentEpisode?.title ?? null}
              poster={episodePoster}
              episode={ep}
              audioPref={audioPref}
              ambient={Boolean(prefs.ambientMode)}
              hasPrev={hasPrev}
              hasNext={hasNext}
              onEpisodeChange={navigate}
              /** §7: signed-in users resume the exact saved timestamp for THIS episode */
              resumeAt={resumeAt && resumeAt.ep === ep ? resumeAt.t : undefined}
              /** §9: unaired series/episode → clean state, no player, no CTA */
              notAired={seriesUnaired || episodeUnaired}
            />
          ) : (
            <Skeleton className="aspect-video w-full rounded-xl" data-testid="player-resolving" />
          )}

          {/* 3 ── EPISODES */}
          <Card className="border-border/70 bg-card/70 backdrop-blur" id="episodes">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-semibold">
                <span className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4 text-primary" /> Episodes
                  {episodes ? <span className="text-xs font-normal text-muted-foreground">({episodes.length})</span> : null}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {hasNext ? `Next up: EP ${ep + 1}` : "Series finale"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!episodes ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-[76px] rounded-lg" />
                  ))}
                </div>
              ) : episodes.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">
                  Episode list unavailable for this title — try the player anyway, servers may still resolve.
                </p>
              ) : (
                <EpisodeGrid
                  episodes={episodes}
                  activeEp={ep}
                  poster={anime?.poster ?? null}
                  onPick={navigate}
                />
              )}
            </CardContent>
          </Card>

          {/* 4 ── SEASONS & SPECIALS */}
          <Card className="border-border/70 bg-card/70 backdrop-blur" id="seasons" data-testid="seasons-specials">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Layers className="h-4 w-4 text-primary" /> Seasons &amp; specials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!franchise ? (
                <div className="flex gap-3 overflow-hidden">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-[120px] w-[86px] rounded-lg" />
                  ))}
                </div>
              ) : franchiseEmpty ? (
                <p className="text-xs text-muted-foreground">
                  No other seasons, movies or specials were found for this franchise.
                </p>
              ) : (
                <>
                  <FranchiseRow label="Seasons" hint="Prequel / sequel entries" items={franchise.seasons} titleLang={titleLang} />
                  <FranchiseRow label="Movies" hint="Franchise films" items={franchise.movies} titleLang={titleLang} />
                  <FranchiseRow label="OVA / ONA / Specials" hint="Side content" items={franchise.specials} titleLang={titleLang} />
                </>
              )}
            </CardContent>
          </Card>

          {/* 5 ── RECOMMENDATIONS */}
          <Card className="border-border/70 bg-card/70 backdrop-blur" id="recommendations" data-testid="watch-recommendations">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Star className="h-4 w-4 text-amber-400" /> More like this
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!recs ? (
                <div className="flex gap-3 overflow-hidden">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-[150px] w-[104px] rounded-xl" />
                  ))}
                </div>
              ) : recs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No recommendations found.</p>
              ) : (
                <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
                  {recs.slice(0, 12).map((r, i) => (
                    <AnimeCard key={r.slug || r.title} item={r} index={i} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* --------------------------------------------------- sidebar */}
        <aside className="space-y-4">
          <Card className="border-border/70 bg-card/70 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="h-4 w-4 text-primary" /> Upcoming releases
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3">
              <HtmxFragment url="/api/fragments/schedule" height={180} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function FranchiseRow({
  label,
  hint,
  items,
  titleLang,
}: {
  label: string;
  hint: string;
  items: import("@/lib/api").SearchResult[];
  titleLang: "romaji" | "english";
}) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label} <span className="font-normal normal-case opacity-70">· {hint}</span>
      </p>
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
        {items.slice(0, 12).map((r) => (
          <Link
            key={r.key || r.title}
            href={`/anime/${encodeURIComponent(r.key || r.title)}`}
            className="group w-[86px] shrink-0"
          >
            <span className="card-hover relative block aspect-[2/3] overflow-hidden rounded-lg bg-muted">
              {r.poster && (
                 
                <img src={r.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
            </span>
            <span className="mt-1.5 line-clamp-2 block text-[11px] font-medium leading-snug">
              {displayTitle({ title: r.title, titleRomaji: r.titleRomaji, titleEnglish: r.titleEnglish }, titleLang)}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              {[r.type, r.year].filter(Boolean).join(" · ") || "Anime"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Render window for the episode grid before the "load more" sentinel kicks in. */
const EPISODE_RENDER_CHUNK = 60;

/**
 * Episode grid — per-episode thumbnail (v2.4.0 enrichment) + full aired date.
 * FIX (v1.3.0 — §9): episodes that haven't aired are rendered DISABLED with
 * an explicit "not aired" chip — tapping them no longer navigates to a
 * player that can only fail.
 */
function EpisodeGrid({
  episodes,
  activeEp,
  poster,
  onPick,
}: {
  episodes: Episode[];
  activeEp: number;
  poster: string | null;
  onPick: (n: number) => void;
}) {
  const [limit, setLimit] = useState(EPISODE_RENDER_CHUNK);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // active episode must always be rendered — extend the window when needed
  const activeIdx = episodes.findIndex((e) => e.number === activeEp);
  const windowEnd = Math.max(limit, activeIdx + 1, 1);
  const visible = episodes.slice(0, windowEnd);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || windowEnd >= episodes.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLimit((n) => Math.min(n + EPISODE_RENDER_CHUNK, episodes.length));
        }
      },
      { rootMargin: "240px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [windowEnd, episodes.length]);

  return (
    <div
      className="grid max-h-[420px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2"
      data-testid="episode-grid"
    >
      {visible.map((e) => {
        const active = e.number === activeEp;
        const thumb = e.thumbnail || poster;
        const unaired = isEpisodeUnaired(e);
        return (
          <button
            key={e.number}
            onClick={() => !unaired && onPick(e.number)}
            disabled={unaired}
            className={`flex min-h-[76px] items-stretch gap-3 rounded-lg border p-2 text-left transition-all ${
              active
                ? "border-primary/70 bg-primary/15"
                : "border-border/60 hover:border-primary/40 hover:bg-accent/50"
            } ${unaired ? "opacity-55" : ""}`}
            title={e.title || `Episode ${e.number}`}
          >
            {/* per-episode art (v2.4.0 enrichment) with series-poster fallback */}
            <span className="relative block w-[104px] shrink-0 overflow-hidden rounded-md bg-muted">
              {thumb ? (
                 
                <img
                  src={thumb}
                  alt=""
                  loading="lazy"
                  className="h-[62px] w-full object-cover"
                />
              ) : (
                <span className="flex h-[62px] w-full items-center justify-center text-muted-foreground">
                  <Film className="h-4 w-4" />
                </span>
              )}
              <span className="absolute bottom-0.5 left-0.5 rounded bg-black/75 px-1 text-[9px] font-bold text-white">
                EP {e.number}
              </span>
            </span>
            <span className="min-w-0 flex-1 py-0.5">
              <span className="line-clamp-2 block text-xs font-medium leading-snug">
                {e.title || `Episode ${e.number}`}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                {e.aired ? <span>{e.aired}</span> : null}
                {e.filler && <span className="rounded bg-amber-500/15 px-1 text-[9px] text-amber-500">filler</span>}
                {unaired && <span className="rounded bg-sky-500/15 px-1 text-[9px] font-medium text-sky-400">not aired</span>}
                {active && <span className="rounded bg-primary/20 px-1 text-[9px] font-semibold text-primary">now playing</span>}
              </span>
            </span>
          </button>
        );
      })}
      {windowEnd < episodes.length && (
        <div ref={sentinelRef} className="col-span-full py-2 text-center text-[11px] text-muted-foreground">
          Loading more episodes…
        </div>
      )}
    </div>
  );
}

/**
 * Anything that is not already a canonical id key (anilist:/mal:/numeric)
 * goes through resolveAnimeKey() — kaze slugs AND raw titles.
 */
function needsResolve(key: string): boolean {
  return Boolean(key) && !isCanonicalKey(key);
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <Skeleton className="mb-4 h-10 w-64" />
          <Skeleton className="aspect-video w-full rounded-xl" />
        </div>
      }
    >
      <WatchInner />
    </Suspense>
  );
}
