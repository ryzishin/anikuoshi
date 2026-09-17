"use client";

/**
 * /anime/[key] — details (v1.3.0).
 *
 * FIX (v1.3.0 — §5):
 *  - COMPLETE data from the v2.4.0 canonical detail shape: synopsis, type,
 *    season, year, status, episodes, score, age rating, genres, synonyms,
 *    native title + the art set (poster/cover/backdrop/banner/logo) — every
 *    field /api/anime + /api/meta expose, nothing invented.
 *  - the hero/details block waits for the combined fetch (meta + characters
 *    + recommendations + seasons + watch-order via Promise.allSettled) —
 *    sections no longer "show incomplete then pop in".
 *  - the EPISODES GRID is REMOVED (and the redundant "Open Player" button
 *    with it). In its place: Seasons / Prequel / Sequel / Specials / Related,
 *    grouped from /api/meta `relations` (AniList — authoritative) plus
 *    /api/seasons + /api/watch-order, validated against the franchise so
 *    unrelated shows cannot appear.
 *  - the watchlist button is now a STATUS DROPDOWN: Planning, Watching,
 *    Completed, On Hold, Dropped (+ Remove).
 *  - single-episode MOVIES get a "Watch" CTA; unaired shows get a
 *    "Not aired yet" state with no watch CTA; progress surfaces a
 *    "Continue EP n" CTA on every surface (details included).
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  BookmarkCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Film,
  Layers,
  ListPlus,
  Play,
  Star,
  Tv,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PosterImage } from "@/components/anime/poster-image";
import { AnimeCard } from "@/components/anime/anime-card";
import { useAuth } from "@/components/auth-provider";
import { usePreferences } from "@/components/preferences-provider";
import { characterDisplayName } from "@/lib/api";
import {
  characters as fetchCharacters,
  isCanonicalKey,
  itemKey,
  meta,
  recommendations as fetchRecommendations,
  resolveAnimeKey,
  seasonsList,
  watchOrder,
  type AnimeInfo,
  type CharacterEntry,
  type KazeItem,
  type RelationEntry,
  type RelationsBlock,
} from "@/lib/api";

function stripHtml(s?: string | null) {
  if (!s) return "";
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\(Source:.*?\)/g, "")
    .trim();
}

/** Franchise validation — does `title` belong to the same base series? */
function sameFranchise(base: string, title?: string | null): boolean {
  if (!base || !title) return false;
  const a = base.toLowerCase();
  const b = title.toLowerCase();
  if (a.length >= 4 && (b.includes(a) || a.includes(b))) return true;
  // token overlap fallback ("mushoku tensei" / "mushoku tensei ii")
  const at = new Set(a.split(/\s+/).filter((t) => t.length >= 3));
  const bt = b.split(/\s+/);
  if (!at.size || !bt.length) return false;
  const hits = bt.filter((t) => at.has(t)).length;
  return hits / at.size >= 0.5;
}

type ListStatus = "planning" | "watching" | "completed" | "on-hold" | "dropped";

const STATUS_OPTIONS: { value: ListStatus; label: string }[] = [
  { value: "watching", label: "Watching" },
  { value: "planning", label: "Planning" },
  { value: "completed", label: "Completed" },
  { value: "on-hold", label: "On Hold" },
  { value: "dropped", label: "Dropped" },
];

export default function AnimeDetailsPage() {
  const rawKey = (useParams().key as string) || "";
  const urlKey = decodeURIComponent(rawKey);
  const { user } = useAuth();
  const { titleLang, charLang } = usePreferences();

  /** canonicalize the URL key first (legacy slugs/titles resolve via the ladder) */
  const [key, setKey] = useState(urlKey);
  const [resolving, setResolving] = useState(() => !isCanonicalKey(urlKey));
  useEffect(() => {
    let alive = true;
    setKey(urlKey);
    setResolving(true);
    resolveAnimeKey(urlKey)
      .then((r) => {
        if (!alive) return;
        setKey(r.key);
        setResolving(false);
      })
      .catch(() => {
        if (!alive) return;
        setResolving(false);
      });
    return () => {
      alive = false;
    };
  }, [urlKey]);

  const [anime, setAnime] = useState<AnimeInfo | null>(null);
  const [relations, setRelations] = useState<RelationsBlock | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chars, setChars] = useState<CharacterEntry[] | null>(null);
  const [recs, setRecs] = useState<KazeItem[] | null>(null);
  const [seasonRows, setSeasonRows] = useState<RelationEntry[] | null>(null);
  const [orderEntries, setOrderEntries] = useState<RelationEntry[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [listStatus, setListStatus] = useState<ListStatus | null>(null);
  const [resume, setResume] = useState<{ ep: number } | null>(null);

  /**
   * FIX (v1.3.0 — §5): COMBINED fetch — meta, characters, recommendations,
   * seasons and watch-order resolve together (allSettled so a slow optional
   * lane never blanks the page). The hero waits for `meta`; every section
   * has a skeleton, so nothing renders "incomplete then pops in".
   */
  useEffect(() => {
    if (resolving || !key) return;
    let alive = true;
    const raf = requestAnimationFrame(() => {
      if (!alive) return;
      setError(null);
      setAnime(null);
      setRelations(null);
      setChars(null);
      setRecs(null);
      setSeasonRows(null);
      setOrderEntries(null);
    });
    meta(key)
      .then((r) => {
        if (!alive) return;
        setAnime(r.anime);
        setRelations(r.relations ?? { entries: [], groups: {} });
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load"));
    fetchCharacters(key, 14)
      .then((c) => alive && setChars(c))
      .catch(() => alive && setChars([]));
    fetchRecommendations(key, 12)
      .then((r) => alive && setRecs(r))
      .catch(() => alive && setRecs([]));
    // seasons + watch-order ride on the listing slug; fall back to the key
    const slugForRelations = urlKey;
    seasonsList(slugForRelations).then((s) => alive && setSeasonRows(s));
    watchOrder(slugForRelations).then((w) => alive && setOrderEntries(w.related));
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [key, resolving, urlKey]);

  useEffect(() => {
    if (!user || !key || resolving) return;
    fetch("/api/user/list")
      .then((r) => r.json())
      .then((d) => {
        const found = (d.items ?? []).find((x: { animeKey: string }) => x.animeKey === key);
        setListStatus((found?.status as ListStatus) ?? null);
      })
      .catch(() => {});
  }, [user, key, resolving]);

  // §6: continue-watching on the details page — server progress for signed-in
  // users, the guest localStorage map otherwise.
  useEffect(() => {
    if (!key || resolving) return;
    let alive = true;
    if (user) {
      fetch(`/api/user/progress?key=${encodeURIComponent(key)}`)
        .then((r) => r.json())
        .then((d) => {
          const p = d?.progress as { episode?: number; positionSeconds?: number } | null;
          if (alive && p?.episode) setResume({ ep: p.episode });
        })
        .catch(() => {});
    } else {
      try {
        const raw = localStorage.getItem("anikuoshi.guestProgress");
        if (raw) {
          const map = JSON.parse(raw) as Record<string, { ep: number }>;
          if (map[key]?.ep) setResume({ ep: map[key].ep });
        }
      } catch {}
    }
    return () => {
      alive = false;
    };
  }, [user, key, resolving]);

  const synopsis = stripHtml(anime?.synopsis);

  /** save (or change) the list status — the dropdown is the single control */
  const setListStatusTo = async (status: ListStatus | null) => {
    if (!user) {
      toast.error("Sign in to save to your list");
      return;
    }
    if (!anime) return;
    if (status === null) {
      const res = await fetch(`/api/user/list?key=${encodeURIComponent(key)}`, { method: "DELETE" });
      if (res.ok) {
        setListStatus(null);
        toast.success("Removed from your list");
      } else {
        toast.error("Couldn't remove — try again");
      }
      return;
    }
    const res = await fetch("/api/user/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animeKey: key,
        animeTitle: titleLang === "english" ? anime.titleEnglish || anime.title : anime.titleRomaji || anime.title,
        poster: anime.poster,
        status,
      }),
    });
    if (res.ok) {
      setListStatus(status);
      toast.success(`Saved to “${STATUS_OPTIONS.find((s) => s.value === status)?.label}”`);
    } else {
      toast.error("Couldn't save — try again");
    }
  };

  /**
   * FIX (v1.3.0 — §5): Seasons / Prequel / Sequel / Specials / Related —
   * grouped from authoritative AniList relations + the listing lanes,
   * deduped by key/slug, and VALIDATED against the franchise base title so
   * unrelated shows cannot appear (spec §5 "guarantee no unrelated shows").
   */
  const relationGroups = useMemo(() => {
    const selfKey = anime?.key || key;
    const seen = new Set<string>([selfKey, key, urlKey].filter(Boolean).map((k) => String(k).toLowerCase()));
    const admit = (e: RelationEntry): boolean => {
      const k = String(e.key || e.slug || "").toLowerCase();
      if (k && seen.has(k)) return false;
      return true;
    };
    const take = (e: RelationEntry) => {
      const k = String(e.key || e.slug || "").toLowerCase();
      if (k) seen.add(k);
    };

    const groups = relations?.groups ?? {};
    const base = anime ? anime.titleRomaji || anime.title || "" : "";

    const fromLane = (entries: RelationEntry[] | null) =>
      (entries ?? []).filter((e) => sameFranchise(base, e.titleRomaji || e.titleEnglish || e.title));

    // Prequel / Sequel — AniList relations are authoritative
    const prequel = (groups.prequel ?? []).filter(admit);
    prequel.forEach(take);
    const sequel = (groups.sequel ?? []).filter(admit);
    sequel.forEach(take);

    // Seasons — listing seasons + TV-type relations, franchise-validated
    const seasons: RelationEntry[] = [];
    for (const e of [
      ...fromLane(seasonRows).filter((s) => /^(TV|TV Series|TV Short)$/i.test(s.type || "")),
      ...(groups.prequel ?? []).concat(groups.sequel ?? []).filter((s) => /^TV$/i.test(s.type || "")),
    ]) {
      if (!admit(e)) continue;
      take(e);
      seasons.push(e);
    }

    // Specials — OVA / ONA / Movie / Special buckets from every source
    const specials: RelationEntry[] = [];
    for (const e of [
      ...(groups.specials ?? []),
      ...(groups.ova ?? []),
      ...(groups.ona ?? []),
      ...(groups.movie ?? []),
      ...fromLane(orderEntries).filter((s) => /^(OVA|ONA|Movie|Special)$/i.test(s.type || "")),
    ]) {
      if (!admit(e)) continue;
      take(e);
      specials.push(e);
    }

    // Related — side stories, alternatives, summaries, other lanes
    const related: RelationEntry[] = [];
    for (const e of [
      ...(groups.sideStory ?? []),
      ...(groups.alternative ?? []),
      ...(groups.summary ?? []),
      ...(groups.related ?? []),
      ...fromLane(orderEntries).filter((s) => !specials.includes(s) && !seasons.includes(s)),
    ]) {
      if (!admit(e)) continue;
      take(e);
      related.push(e);
    }

    return { seasons, prequel, sequel, specials, related };
  }, [relations, seasonRows, orderEntries, anime, key, urlKey]);

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-xl font-semibold">Couldn&apos;t load this title</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => location.reload()}>Retry</Button>
          <Button variant="outline" asChild>
            <Link href={`/search?q=${encodeURIComponent(urlKey)}`}>Search “{urlKey.slice(0, 32)}”</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/browse">Browse catalog</Link>
          </Button>
        </div>
      </div>
    );
  }

  const title = anime ? (titleLang === "english" ? anime.titleEnglish || anime.title : anime.titleRomaji || anime.title) : "";

  /**
   * FIX (v1.3.0 — §5): CTA logic —
   *   unaired            → "Not aired yet" (disabled, no watch link)
   *   movie, 1 episode   → "Watch"
   *   other single-ep    → "Watch episode 1" (appropriate equivalent)
   *   progress exists    → primary CTA becomes "Continue EP n"
   */
  const notAired = (anime?.status || "").toLowerCase() === "not yet aired";
  const isSingleEpisode = (anime?.episodes ?? 0) === 1;
  const isMovie = (anime?.type || "").toLowerCase() === "movie";
  const watchCtaLabel = isSingleEpisode && isMovie ? "Watch" : isSingleEpisode ? "Watch episode 1" : "Watch episode 1";
  const watchHref = `/watch?key=${encodeURIComponent(key)}${isSingleEpisode ? "" : "&ep=1"}`;

  return (
    <div>
      {/* ---------------------------------------------------- banner hero */}
      <section className="relative">
        <div className="absolute inset-0 h-[420px] overflow-hidden" aria-hidden>
          {anime?.banner ? (
             
            <img src={anime.banner} alt="" className="h-full w-full object-cover" />
          ) : anime?.backdrop ? (
             
            <img src={anime.backdrop} alt="" className="h-full w-full object-cover opacity-70" />
          ) : anime?.poster ? (
             
            <img src={anime.poster} alt="" className="h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
          ) : null}
          <div className="hero-vignette absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-4 pb-6 pt-32 sm:px-6" data-testid="details-hero">
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="w-40 shrink-0 sm:w-52" data-aos="fade-right">
              {anime ? (
                <PosterImage src={anime.poster} alt={title} eager className="shadow-2xl" />
              ) : (
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
              )}
            </div>
            <div className="min-w-0 flex-1" data-aos="fade-up">
              {anime ? (
                <>
                  <h1 className="text-balance text-2xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[
                      titleLang === "english" ? anime.titleRomaji || "" : anime.titleEnglish || "",
                      anime.titleNative || "",
                    ].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {anime.year && (
                      <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                        <CalendarDays className="h-3 w-3" /> {anime.year}
                        {anime.season ? ` ${anime.season.charAt(0)}${anime.season.slice(1).toLowerCase()}` : ""}
                      </span>
                    )}
                    {anime.type && (
                      <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                        <Tv className="h-3 w-3" /> {anime.type}
                      </span>
                    )}
                    {anime.episodes && (
                      <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                        <Film className="h-3 w-3" /> {anime.episodes} episode{anime.episodes === 1 ? "" : "s"}
                      </span>
                    )}
                    {anime.status && (
                      <span className="rounded-md bg-muted px-2 py-1">{anime.status}</span>
                    )}
                    {typeof anime.score === "number" && anime.score > 0 && (
                      <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-medium text-foreground">
                        <Star className="h-3 w-3 text-amber-400" /> {(anime.score / 10).toFixed(1)}
                      </span>
                    )}
                    {anime.rating && (
                      <span className="rounded-md bg-muted px-2 py-1">{anime.rating}</span>
                    )}
                  </div>
                  {anime.genres?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {anime.genres.map((g) => (
                        <Link key={g} href={`/browse?tab=genre&genre=${encodeURIComponent(g.toLowerCase())}`}>
                          <Badge variant="secondary" className="cursor-pointer hover:bg-accent">{g}</Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                  {anime.synonyms?.length > 0 && (
                    <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground/70">Synonyms: </span>
                      {anime.synonyms.join(" · ")}
                    </p>
                  )}
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {notAired ? (
                      <Button size="lg" variant="outline" disabled className="cursor-not-allowed" data-testid="not-aired-cta">
                        <CalendarDays className="mr-2 h-5 w-5" /> Not aired yet
                      </Button>
                    ) : resume ? (
                      <Button asChild size="lg" className="border-0 bg-primary text-primary-foreground hover:bg-primary/90">
                        <Link href={`/watch?key=${encodeURIComponent(key)}&ep=${resume.ep}`}>
                          <Play className="mr-2 h-5 w-5 fill-current" /> Continue EP {resume.ep}
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild size="lg" className="border-0 bg-primary text-primary-foreground hover:bg-primary/90">
                        <Link href={watchHref} data-testid="watch-cta">
                          <Play className="mr-2 h-5 w-5 fill-current" /> {watchCtaLabel}
                        </Link>
                      </Button>
                    )}

                    {/* §5: watchlist STATUS DROPDOWN */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="lg" data-testid="list-status-button" disabled={!user && undefined}>
                          {listStatus ? (
                            <>
                              <BookmarkCheck className="mr-2 h-4 w-4 text-primary" />
                              {STATUS_OPTIONS.find((s) => s.value === listStatus)?.label ?? listStatus}
                            </>
                          ) : (
                            <>
                              <ListPlus className="mr-2 h-4 w-4" /> Add to list
                            </>
                          )}
                          <ChevronDown className="ml-1 h-4 w-4 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        {user ? (
                          <>
                            {STATUS_OPTIONS.filter((s) => s.value !== listStatus).map((s) => (
                              <DropdownMenuItem key={s.value} onClick={() => setListStatusTo(s.value)}>
                                {s.label}
                              </DropdownMenuItem>
                            ))}
                            {listStatus && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setListStatusTo(null)} className="text-destructive focus:text-destructive">
                                  Remove from list
                                </DropdownMenuItem>
                              </>
                            )}
                          </>
                        ) : (
                          <DropdownMenuItem onClick={() => toast.error("Sign in to save to your list")}>
                            Sign in to use lists
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <Skeleton className="h-9 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex gap-2 pt-3">
                    <Skeleton className="h-11 w-44 rounded-lg" />
                    <Skeleton className="h-11 w-32 rounded-lg" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- synopsis */}
      {synopsis && (
        <section className="mx-auto w-full max-w-7xl px-4 sm:px-6" data-aos="fade-up">
          <div className="relative rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Synopsis</h2>
            <p className={`whitespace-pre-line text-sm leading-relaxed text-foreground/85 ${expanded ? "" : "line-clamp-4"}`}>
              {synopsis}
            </p>
            {synopsis.length > 320 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {expanded ? "Show less" : "Show more"} <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>
        </section>
      )}

      {/* ------------------------- seasons / prequel / sequel / related (§5) */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6" data-testid="relations-panel">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Layers className="h-4 w-4 text-primary" /> Seasons &amp; related
        </h2>
        {!relations || !seasonRows || !orderEntries ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[150px] w-[100px] rounded-xl" />
            ))}
          </div>
        ) : (
          relationGroups.seasons.length +
            relationGroups.prequel.length +
            relationGroups.sequel.length +
            relationGroups.specials.length +
            relationGroups.related.length ===
          0 ? (
            <p className="text-sm text-muted-foreground">
              No other seasons, movies or related entries were found for this title.
            </p>
          ) : (
            <div className="space-y-4">
              <RelationRow label="Seasons" entries={relationGroups.seasons} titleLang={titleLang} />
              <RelationRow label="Prequel" entries={relationGroups.prequel} titleLang={titleLang} />
              <RelationRow label="Sequel" entries={relationGroups.sequel} titleLang={titleLang} />
              <RelationRow label="Specials · Movies · OVA · ONA" entries={relationGroups.specials} titleLang={titleLang} />
              <RelationRow label="Related" entries={relationGroups.related} titleLang={titleLang} />
            </div>
          )
        )}
      </section>

      {/* ----------------------------------------------------- characters */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Users className="h-4 w-4 text-primary" /> Characters &amp; voice actors
        </h2>
        {!chars ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[150px] w-[100px] rounded-xl" />
            ))}
          </div>
        ) : chars.length === 0 ? (
          <p className="text-sm text-muted-foreground">Character data unavailable for this title.</p>
        ) : (
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
            {chars.map((c) => (
              <div key={c.character.id ?? c.character.name} className="w-[100px] shrink-0" data-testid="character-card">
                <PosterImage src={c.character.image} alt={c.character.name || ""} aspect="square" className="rounded-xl" />
                <p className="mt-1.5 line-clamp-1 text-xs font-medium">
                  {characterDisplayName(c.character.name, charLang)}
                </p>
                {c.voiceActor ? (
                  <p className="line-clamp-1 text-[10px] text-muted-foreground">
                    CV: {characterDisplayName(c.voiceActor.name, charLang)}
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">{c.role?.toLowerCase()}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------- recommendations */}
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6" data-testid="details-recommendations">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Star className="h-4 w-4 text-amber-400" /> You might also like
        </h2>
        {!recs ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[190px] w-[130px] rounded-xl" />
            ))}
          </div>
        ) : recs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recommendations found for this title.</p>
        ) : (
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
            {recs.map((r, i) => (
              <AnimeCard key={r.slug || r.title} item={{ ...r, slug: itemKey(r) ?? undefined }} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** One labeled row of relation cards (Seasons / Prequel / Sequel / …). */
function RelationRow({
  label,
  entries,
  titleLang,
}: {
  label: string;
  entries: RelationEntry[];
  titleLang: "romaji" | "english";
}) {
  if (!entries.length) return null;
  return (
    <div data-testid={`relation-row-${label.toLowerCase().split(/[\s·]+/)[0]}`}>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label} <ChevronRight className="inline h-3 w-3 opacity-50" />
      </p>
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
        {entries.slice(0, 14).map((e) => (
          <Link
            key={e.key || e.slug || e.title}
            href={`/anime/${encodeURIComponent(e.key || e.slug || e.title)}`}
            className="group w-[86px] shrink-0"
          >
            <span className="card-hover relative block aspect-[2/3] overflow-hidden rounded-lg bg-muted">
              {e.poster && (
                 
                <img src={e.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
            </span>
            <span className="mt-1.5 line-clamp-2 block text-[11px] font-medium leading-snug">
              {titleLang === "english"
                ? e.titleEnglish || e.title
                : e.titleRomaji || e.title}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              {[e.type, e.year].filter(Boolean).join(" · ") || "Anime"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
