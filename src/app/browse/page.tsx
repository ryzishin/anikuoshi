"use client";

/**
 * /browse — full catalog exploration.
 * Tabs: Filters (keyword, genre, year, season, type, status, language,
 * rating, source, sort, episode range) · Genres · Types · A–Z list.
 *
 * FIX (v1.2.0 — §9):
 *  - Types tab: the "All" chip shows the FULL catalog (via /api/az-list/all)
 *    instead of an empty list — previously `typeParam ? fetch : []` rendered
 *    nothing at all for "All".
 *  - Genres tab: "All" chip shows the full catalog the same way, and genre
 *    chips are MULTI-SELECT — click toggles a genre on/off, several can be
 *    active, and the selection is sent as one comma-separated `genre` param
 *    (the API's documented multi-genre contract, routed through /api/filter).
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Compass, Filter, Library, ListFilter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimeCard, type CardItem } from "@/components/anime/anime-card";
import { PageLoader } from "@/components/layout/logo";
import { azList, filter as filterApi, genreList, typeList } from "@/lib/api";

const TABS = ["filter", "genre", "type", "az"] as const;
type Tab = (typeof TABS)[number];

const GENRES = [
  "action", "adventure", "comedy", "drama", "ecchi", "fantasy", "horror", "mahou shoujo",
  "mecha", "music", "mystery", "psychological", "romance", "school", "sci-fi",
  "shounen", "slice of life", "space", "sports", "supernatural", "thriller",
];

const TYPES = ["tv", "movie", "ova", "ona", "special", "tv series"];

const YEARS = ["", "2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2000s", "90s", "80s"];
const SEASONS = ["", "winter", "spring", "summer", "fall"];
const STATUSES = ["", "airing", "completed", "upcoming"];
const LANGUAGES = ["", "sub", "dub", "sub & dub"];
const RATINGS = ["", "g - all ages", "pg - children", "pg-13 - teens 13 or older", "r - 17+", "r+ - mild nudity", "rx - hentai"];
const SOURCES = ["", "manga", "light novel", "original", "novel", "video game", "visual novel", "web novel", "doujinshi", "4-koma manga", "card game", "book", "picture book", "radio", "other"];
const SORTS = ["", "trending", "popularity", "most-favorite", "score", "name", "latest", "year"];

function BrowseInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "filter");
  const [letter, setLetter] = useState(params.get("letter") || "a");
  /** §9: multi-select — every active genre lives here; empty = All */
  const [genreParam, setGenreParam] = useState(
    (params.get("genre") || "").split(",").map((g) => g.trim()).filter(Boolean)
  );
  const [typeParam, setTypeParam] = useState(params.get("type") || "");

  // filter form — DRAFT state (typing never fetches)
  const [fKeyword, setFKeyword] = useState("");
  const [fGenre, setFGenre] = useState("");
  const [fType, setFType] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fSeason, setFSeason] = useState("");
  const [fLanguage, setFLanguage] = useState("");
  const [fRating, setFRating] = useState("");
  const [fSource, setFSource] = useState("");
  const [fSort, setFSort] = useState("");
  const [fYear, setFYear] = useState("");
  const [fEpMin, setFEpMin] = useState("");
  const [fEpMax, setFEpMax] = useState("");

  /**
   * FIX (v1.3.0 — §3): the keyword field is NOT a live search anymore — no
   * suggestions, no auto-fetch. Every filter field (keyword included) only
   * commits to `applied` when the Apply button is pressed, exactly like the
   * other filters. The fetch effect below reads `applied` only.
   */
  const [applied, setApplied] = useState({
    keyword: "", genre: "", type: "", status: "", season: "", language: "",
    rating: "", source: "", sort: "", year: "", epMin: "", epMax: "",
  });

  const applyFilters = () => {
    setPage(1);
    setApplied({
      keyword: fKeyword, genre: fGenre, type: fType, status: fStatus,
      season: fSeason, language: fLanguage, rating: fRating, source: fSource,
      sort: fSort, year: fYear, epMin: fEpMin, epMax: fEpMax,
    });
  };

  const resetFilters = () => {
    setFKeyword(""); setFGenre(""); setFType(""); setFStatus(""); setFSeason("");
    setFLanguage(""); setFRating(""); setFSource(""); setFSort(""); setFYear("");
    setFEpMin(""); setFEpMax("");
    setPage(1);
    setApplied({
      keyword: "", genre: "", type: "", status: "", season: "", language: "",
      rating: "", source: "", sort: "", year: "", epMin: "", epMax: "",
    });
  };

  const [items, setItems] = useState<CardItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setItems(null);
    try {
      let result: CardItem[] = [];
      if (tab === "filter") {
        // reads ONLY the applied snapshot — typing in the form never fetches
        result = await filterApi({
          keyword: applied.keyword, genre: applied.genre, type: applied.type, status: applied.status,
          season: applied.season, language: applied.language, rating: applied.rating, source: applied.source,
          sort: applied.sort, year: applied.year, epMin: applied.epMin, epMax: applied.epMax, page,
        });
      } else if (tab === "genre") {
        result = genreParam.length
          ? await genreList(genreParam.join(","), page)
          : await azList("all", page);
      } else if (tab === "type") {
        result = typeParam ? await typeList(typeParam, page) : await azList("all", page);
      } else {
        result = await azList(letter, page);
      }
      setItems(result);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, applied, genreParam, typeParam, letter, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [tab, genreParam, typeParam, letter]);

  // FIX (v1.1): keep tab/genre/type/letter in the URL so genre/type/A–Z
  // routes are shareable and back/forward behaves as expected.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (tab !== "filter") sp.set("tab", tab);
    if (tab === "genre" && genreParam.length) sp.set("genre", genreParam.join(","));
    if (tab === "type" && typeParam) sp.set("type", typeParam);
    if (tab === "az") sp.set("letter", letter);
    const qs = sp.toString();
    router.replace(qs ? `/browse?${qs}` : "/browse", { scroll: false });
  }, [tab, genreParam, typeParam, letter, router]);

  const hasFilters =
    fKeyword || fGenre || fType || fStatus || fSeason || fLanguage || fRating || fSource || fSort || fYear || fEpMin || fEpMax;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Compass className="h-6 w-6 text-primary" /> Browse
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Filter the entire catalog exactly like the upstream API allows.</p>
        </div>
      </div>

      {/* tabs */}
      <div className="mt-5 flex gap-1 overflow-x-auto rounded-xl border border-border/70 bg-card/60 p-1 backdrop-blur" role="tablist">
        {([
          ["filter", "Filters", <Filter key="i" className="h-4 w-4" />],
          ["genre", "Genres", <Library key="i" className="h-4 w-4" />],
          ["type", "Types", <ListFilter key="i" className="h-4 w-4" />],
          ["az", "A–Z", <Compass key="i" className="h-4 w-4" />],
        ] as [Tab, string, React.ReactNode][]).map(([id, label, icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------ filter form */}
      {tab === "filter" && (
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-border/70 bg-card/50 p-4 backdrop-blur sm:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <Label htmlFor="f-keyword" className="text-[11px] text-muted-foreground">Keyword</Label>
            <Input id="f-keyword" placeholder="Search by title…" value={fKeyword} onChange={(e) => setFKeyword(e.target.value)} className="mt-1" />
          </div>
          <Field label="Genre">
            <Select value={fGenre} onValueChange={setFGenre}>
              <ST value={fGenre} placeholder="Any" />
              <SelectContent className="max-h-72">
                {GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={fType} onValueChange={setFType}>
              <ST value={fType} placeholder="Any" />
              <SelectContent>{TYPES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={fStatus || "any"} onValueChange={(v) => setFStatus(v === "any" ? "" : v)}>
              <ST value={fStatus} placeholder="Any" />
              <SelectContent>{STATUSES.map((g) => <SelectItem key={g || "any"} value={g || "any"}>{g || "Any"}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Season">
            <Select value={fSeason || "any"} onValueChange={(v) => setFSeason(v === "any" ? "" : v)}>
              <ST value={fSeason} placeholder="Any" />
              <SelectContent>{SEASONS.map((g) => <SelectItem key={g || "any"} value={g || "any"}>{g || "Any"}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Year">
            <Select value={fYear || "any"} onValueChange={(v) => setFYear(v === "any" ? "" : v)}>
              <ST value={fYear} placeholder="Any" />
              <SelectContent>{YEARS.map((g) => <SelectItem key={g || "any"} value={g || "any"}>{g || "Any"}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Language">
            <Select value={fLanguage || "any"} onValueChange={(v) => setFLanguage(v === "any" ? "" : v)}>
              <ST value={fLanguage} placeholder="Any" />
              <SelectContent>{LANGUAGES.map((g) => <SelectItem key={g || "any"} value={g || "any"}>{g || "Any"}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Rating">
            <Select value={fRating || "any"} onValueChange={(v) => setFRating(v === "any" ? "" : v)}>
              <ST value={fRating} placeholder="Any" />
              <SelectContent className="max-h-64">{RATINGS.map((g) => <SelectItem key={g || "any"} value={g || "any"}>{g || "Any"}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Source">
            <Select value={fSource || "any"} onValueChange={(v) => setFSource(v === "any" ? "" : v)}>
              <ST value={fSource} placeholder="Any" />
              <SelectContent className="max-h-64">{SOURCES.map((g) => <SelectItem key={g || "any"} value={g || "any"}>{g || "Any"}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Sort by">
            <Select value={fSort || "any"} onValueChange={(v) => setFSort(v === "any" ? "" : v)}>
              <ST value={fSort} placeholder="Default" />
              <SelectContent>{SORTS.map((g) => <SelectItem key={g || "any"} value={g || "any"}>{g || "Default"}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Ep ≥">
              <Input inputMode="numeric" placeholder="0" value={fEpMin} onChange={(e) => setFEpMin(e.target.value)} />
            </Field>
            <Field label="Ep ≤">
              <Input inputMode="numeric" placeholder="∞" value={fEpMax} onChange={(e) => setFEpMax(e.target.value)} />
            </Field>
          </div>
          <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-2">
            <Button className="border-0 bg-primary text-primary-foreground hover:bg-primary/90" onClick={applyFilters} data-testid="browse-apply">
              <Filter className="mr-1.5 h-4 w-4" /> Apply
            </Button>
            {hasFilters && (
              <Button variant="ghost" onClick={resetFilters}>
                <RotateCcw className="mr-1.5 h-4 w-4" /> Reset
              </Button>
            )}
          </div>
        </div>
      )}

      {/* genre chips — MULTI-SELECT (§9): click toggles, several can be
          active at once; the joined selection goes to /api/genre as one
          comma-separated param (API's multi-genre path). "All" clears. */}
      {tab === "genre" && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Chip active={genreParam.length === 0} onClick={() => setGenreParam([])}>All</Chip>
          {GENRES.map((g) => (
            <Chip
              key={g}
              active={genreParam.includes(g)}
              onClick={() =>
                setGenreParam((prev) =>
                  prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
                )
              }
            >
              {g}
            </Chip>
          ))}
        </div>
      )}

      {/* type chips — "All" now loads the whole catalog (§9) */}
      {tab === "type" && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Chip active={!typeParam} onClick={() => setTypeParam("")}>All</Chip>
          {TYPES.map((g) => (
            <Chip key={g} active={typeParam === g} onClick={() => setTypeParam(g)}>{g}</Chip>
          ))}
        </div>
      )}

      {/* az letters */}
      {tab === "az" && (
        <div className="mt-4 flex flex-wrap gap-1">
          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ0-9".split("").map((ch) => (
            <Chip key={ch} active={letter === ch} onClick={() => setLetter(ch)} small>
              {ch === "0-9" ? "0-9" : ch}
            </Chip>
          ))}
        </div>
      )}

      {/* results */}
      <div className="mt-6" data-testid="browse-results">
        {loading ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                <Skeleton className="h-3.5 w-4/5" />
              </div>
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 py-16 text-center">
            <p className="text-sm font-medium">No results</p>
            <p className="mt-1 text-xs text-muted-foreground">Try loosening the filters or a different letter.</p>
          </div>
        ) : (
          <>
            {tab === "genre" && genreParam.length > 1 && (
              <p className="mb-3 text-xs text-muted-foreground" data-testid="genre-multi-note">
                Filtering by {genreParam.length} genres: {genreParam.join(", ")}
              </p>
            )}
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {items.map((item, i) => (
                <AnimeCard key={`${item.slug || item.title}-${i}`} item={item} index={i % 12} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* pagination */}
      <div className="mt-8 flex items-center justify-center gap-3">
        <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <Button variant="outline" size="sm" disabled={loading || !items || items.length === 0} onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ST({ value, placeholder }: { value: string; placeholder: string }) {
  return (
    <SelectTrigger className="w-full">
      <SelectValue placeholder={placeholder}>{value || placeholder}</SelectValue>
    </SelectTrigger>
  );
}

function Chip({ active, onClick, children, small }: { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[44px] rounded-full border transition-all ${
        small ? "min-w-[44px] px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-xs"
      } ${
        active
          ? "border-transparent bg-primary font-semibold text-primary-foreground"
          : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<PageLoader label="Loading browse…" />}>
      <BrowseInner />
    </Suspense>
  );
}
