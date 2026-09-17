"use client";

/**
 * /search?q= — debounced suggestions + full result grid.
 */
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimeCard, type CardItem } from "@/components/anime/anime-card";
import { PageLoader } from "@/components/layout/logo";
import { search as searchApi, suggestions as fetchSuggestions, type SearchResult } from "@/lib/api";

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initialQ = params.get("q") || "";

  const [q, setQ] = useState(initialQ);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [sugg, setSugg] = useState<CardItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const list = await searchApi(term.trim());
      setResults(list);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // live suggestions (debounced)
  useEffect(() => {
    if (!touched || !q.trim()) {
      setSugg(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const list = await fetchSuggestions(q.trim());
        setSugg(list as unknown as CardItem[]);
      } catch {
        setSugg([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, touched]);

  // initial + back/forward
  useEffect(() => {
    if (initialQ) runSearch(initialQ);
  }, [initialQ, runSearch]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setTouched(false);
    if (q.trim()) {
      router.replace(`/search?q=${encodeURIComponent(q.trim())}`);
      runSearch(q.trim());
    }
  };

  const showSuggestions = touched && sugg && q.trim() && (!results || loading);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Search anime</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Live typeahead + full deduped results. Press <kbd className="rounded border px-1 text-[10px]">/</kbd> anywhere to jump here.
      </p>

      <form onSubmit={submit} className="relative mt-5" role="search">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          data-testid="search-input"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setTouched(true);
          }}
          placeholder="Try “frieren”, “solo leveling”, “spy x family”…"
          className="h-13 rounded-2xl border-border/70 bg-card/70 pl-11 pr-10 text-base shadow-sm backdrop-blur focus-visible:ring-primary/40"
          aria-label="Search anime"
          autoFocus
        />
        {q && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => { setQ(""); setResults(null); setTouched(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {/* suggestions strip */}
      {showSuggestions && (
        <div className="mt-3 rounded-xl border border-border/70 bg-card/70 p-3 backdrop-blur" data-testid="suggestions">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Suggestions</p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {sugg.map((s, i) => (
              <button
                key={`${s.title}-${i}`}
                onClick={() => {
                  setTouched(false);
                  // FIX (v1.1.1): title-first, matching itemKey() everywhere
                  // else — slug navigation was the "No anime found" path.
                  router.push(`/anime/${encodeURIComponent(s.title || s.slug || "")}`);
                }}
                className="flex w-[210px] shrink-0 items-center gap-2 rounded-lg border border-border/60 p-2 text-left transition-colors hover:border-primary/40 hover:bg-accent/50"
              >
                {s.poster && (
                   
                  <img src={s.poster} alt="" loading="lazy" className="h-12 w-9 rounded object-cover" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{s.title}</span>
                  <span className="block text-[10px] text-muted-foreground">{s.type || "Anime"}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* results */}
      <div className="mt-8" data-testid="search-results">
        {loading && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                <Skeleton className="h-3.5 w-4/5" />
              </div>
            ))}
          </div>
        )}

        {!loading && results && (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {results.length} result{results.length === 1 ? "" : "s"} for “{q.trim()}”
            </p>
            {results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 py-16 text-center">
                <p className="text-sm font-medium">No matches</p>
                <p className="mt-1 text-xs text-muted-foreground">Check the spelling or try a shorter query.</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href="/browse">Browse the catalog</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5">
                {results.map((r, i) => (
                  <AnimeCard
                    key={`${r.anilistId || r.title}-${i}`}
                    item={{
                      title: r.title,
                      poster: r.poster ?? undefined,
                      type: r.type ?? undefined,
                      slug: r.key || r.title,
                    }}
                    index={i}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {!loading && !results && !touched && (
          <div className="rounded-2xl border border-dashed border-border/70 py-16 text-center">
            <p className="text-sm font-medium">Start typing to search</p>
            <p className="mt-1 text-xs text-muted-foreground">Suggestions appear as you type.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading search…" />}>
      <SearchInner />
    </Suspense>
  );
}
