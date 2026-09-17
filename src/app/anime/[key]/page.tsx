"use client";

/**
 * /anime/[key] — details: banner hero, synopsis, genres, characters,
 * seasons/related, episodes preview and recommendations.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  BookmarkCheck,
  CalendarDays,
  ChevronDown,
  Film,
  ListPlus,
  Play,
  Star,
  Tv,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PosterImage } from "@/components/anime/poster-image";
import { AnimeCard } from "@/components/anime/anime-card";
import { useAuth } from "@/components/auth-provider";
import { usePreferences } from "@/components/preferences-provider";
import {
  animeEpisodes,
  characters as fetchCharacters,
  isCanonicalKey,
  itemKey,
  meta,
  recommendations as fetchRecommendations,
  resolveAnimeKey,
  type AnimeInfo,
  type CharacterEntry,
  type Episode,
  type KazeItem,
} from "@/lib/api";

function stripHtml(s?: string | null) {
  if (!s) return "";
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\(Source:.*?\)/g, "")
    .trim();
}

export default function AnimeDetailsPage() {
  const rawKey = (useParams().key as string) || "";
  const urlKey = decodeURIComponent(rawKey);
  const { user } = useAuth();
  const { titleLang } = usePreferences();

  /**
   * FIX (v1.1): the key used for every API call. Legacy URLs carry kaze
   * slugs the API cannot resolve, so we first run resolveAnimeKey() —
   * which canonicalizes via /api/meta or /api/search — and only then load
   * everything. `key` falls back to the raw URL key while resolving.
   */
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
  const [error, setError] = useState<string | null>(null);
  const [chars, setChars] = useState<CharacterEntry[] | null>(null);
  const [recs, setRecs] = useState<KazeItem[] | null>(null);
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [listStatus, setListStatus] = useState<string | null>(null);

  useEffect(() => {
    if (resolving || !key) return;
    let alive = true;
    // reset loading state asynchronously (never sync-in-effect)
    const raf = requestAnimationFrame(() => {
      if (alive) {
        setError(null);
        setAnime(null);
      }
    });
    meta(key)
      .then((r) => alive && setAnime(r.anime))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load"));
    fetchCharacters(key, 14)
      .then((c) => alive && setChars(c))
      .catch(() => alive && setChars([]));
    fetchRecommendations(key, 12)
      .then((r) => alive && setRecs(r))
      .catch(() => alive && setRecs([]));
    animeEpisodes(key)
      .then((e) => alive && setEpisodes(e))
      .catch(() => alive && setEpisodes([]));
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [key, resolving]);

  useEffect(() => {
    if (!user || !key || resolving) return;
    fetch("/api/user/list")
      .then((r) => r.json())
      .then((d) => {
        const found = (d.items ?? []).find((x: { animeKey: string }) => x.animeKey === key);
        setListStatus(found?.status ?? null);
      })
      .catch(() => {});
  }, [user, key, resolving]);

  const synopsis = stripHtml(anime?.synopsis);

  const addToList = async () => {
    if (!user) {
      toast.error("Sign in to save to your list");
      return;
    }
    if (!anime) return;
    const next = listStatus === "watching" ? "completed" : "watching";
    const res = await fetch("/api/user/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animeKey: key,
        animeTitle: titleLang === "english" ? anime.titleEnglish || anime.title : anime.titleRomaji || anime.title,
        poster: anime.poster,
        status: next,
      }),
    });
    if (res.ok) {
      setListStatus(next);
      toast.success(`Saved to “${next}”`);
    } else {
      toast.error("Couldn't save — try again");
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-xl font-semibold">Couldn&apos;t load this title</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        {/* FIX (v1.1.1): give every failure a targeted escape hatch — search
            using the URL key itself instead of a generic link to /search. */}
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
  const native = anime?.synonyms?.find((s) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(s));

  return (
    <div>
      {/* ---------------------------------------------------- banner hero */}
      <section className="relative">
        <div className="absolute inset-0 h-[420px] overflow-hidden" aria-hidden>
          {anime?.banner ? (
             
            <img src={anime.banner} alt="" className="h-full w-full object-cover" />
          ) : anime?.poster ? (
             
            <img src={anime.poster} alt="" className="h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
          ) : (
            <div className="brand-gradient h-full w-full opacity-25" />
          )}
          <div className="hero-vignette absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-4 pb-6 pt-32 sm:px-6" data-testid="details-hero">
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="w-40 shrink-0 sm:w-52" data-aos="fade-right">
              {anime ? (
                <PosterImage src={anime.poster} alt={title} eager className="glow shadow-2xl" />
              ) : (
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
              )}
            </div>
            <div className="min-w-0 flex-1" data-aos="fade-up">
              {anime ? (
                <>
                  <h1 className="text-balance text-2xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {titleLang === "english" ? anime.titleRomaji || "" : anime.titleEnglish || ""}
                    {native ? ` · ${native}` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {anime.year && (
                      <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                        <CalendarDays className="h-3 w-3" /> {anime.year}
                      </span>
                    )}
                    {anime.type && (
                      <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                        <Tv className="h-3 w-3" /> {anime.type}
                      </span>
                    )}
                    {anime.episodes && (
                      <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                        <Film className="h-3 w-3" /> {anime.episodes} episodes
                      </span>
                    )}
                    {anime.status && (
                      <span className="rounded-md bg-muted px-2 py-1 capitalize">{anime.status.toLowerCase().replace(/_/g, " ")}</span>
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
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button asChild size="lg" className="brand-gradient border-0 text-white">
                      <Link href={`/watch?key=${encodeURIComponent(key)}&ep=1`}>
                        <Play className="mr-2 h-5 w-5 fill-white" /> Watch episode 1
                      </Link>
                    </Button>
                    <Button variant="outline" size="lg" onClick={addToList}>
                      {listStatus ? <BookmarkCheck className="mr-2 h-4 w-4 text-primary" /> : <ListPlus className="mr-2 h-4 w-4" />}
                      {listStatus ? `In list (${listStatus})` : "Add to list"}
                    </Button>
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

      {/* ------------------------------------------------------ episodes */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Episodes</h2>
          {episodes && episodes.length > 0 && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/watch?key=${encodeURIComponent(key)}&ep=1`}>Open player</Link>
            </Button>
          )}
        </div>
        {!episodes ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : episodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Episode titles aren&apos;t indexed for this title yet.</p>
        ) : (
          <div className="grid max-h-[280px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
            {episodes.map((e) => (
              <Link
                key={e.number}
                href={`/watch?key=${encodeURIComponent(key)}&ep=${e.number}`}
                className="rounded-lg border border-border/60 px-3 py-2 transition-all hover:border-primary/40 hover:bg-accent/50"
              >
                <span className="text-[11px] font-semibold text-muted-foreground">EP {e.number}</span>
                <span className="mt-0.5 line-clamp-1 block text-xs font-medium">{e.title || `Episode ${e.number}`}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ----------------------------------------------------- characters */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Users className="h-4 w-4 text-primary" /> Characters &amp; voice actors
        </h2>
        {!chars ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[150px] w-[100px] rounded-xl" />)}
          </div>
        ) : chars.length === 0 ? (
          <p className="text-sm text-muted-foreground">Character data unavailable for this title.</p>
        ) : (
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
            {chars.map((c) => (
              <div key={c.character.id ?? c.character.name} className="w-[100px] shrink-0" data-testid="character-card">
                <PosterImage src={c.character.image} alt={c.character.name || ""} aspect="square" className="rounded-xl" />
                <p className="mt-1.5 line-clamp-1 text-xs font-medium">{c.character.name}</p>
                {c.voiceActor ? (
                  <p className="line-clamp-1 text-[10px] text-muted-foreground">CV: {c.voiceActor.name}</p>
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
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[190px] w-[130px] rounded-xl" />)}
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
