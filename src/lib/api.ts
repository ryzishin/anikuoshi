/**
 * AniKuoshi API client — typed wrapper over APIKuoshi (v2.3.0).
 *
 * Live API: https://apikuoshi-v2.onrender.com  (CORS: echoes any origin)
 * Repo reference: https://github.com/ryzishin/apikuoshi
 *
 * FIX (v1.2.0): moved to the v2.3.0 deployment — the canonical-shape release.
 * Every browse/catalog row now carries key/slug/anilistId/malId/title…/
 * artSource, and /api/anime/episodes carries per-episode `thumbnail` +
 * `thumbSource` (upstream | kitsu | tmdb | poster | null).
 *
 * Response contracts (verified against the live deployment):
 *   list-shape   { success, api, kind?, count, results: [...] }
 *   object-shape { success, api, kind, data: {...} }
 *   watch        { success, key, episode, type, stream, streams: [...] }
 *   chain        { success, anime, episode, servers, streams, best, verdict, steps, timing }
 *
 * Stream objects carry: provider, originalName, type (sub|dub), url, embedUrl,
 * proxiedUrl (RELATIVE to the API origin — absolutized here), isHls, kind
 * (direct|embed), qualities, subtitles, skipIntro.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "https://apikuoshi-v2.onrender.com";

/* ---------------------------------------------------------------- types */

export type KazeItem = {
  /** v2.3.0 canonical rows always carry a resolvable key when identity exists */
  key?: string | null;
  slug?: string;
  animeId?: string;
  poster?: string;
  title: string;
  japaneseTitle?: string;
  sub?: number;
  dub?: number;
  total?: number;
  type?: string;
  rating?: string;
  rank?: number;
  episode_no?: number;
  time?: string;
};

export type SpotlightItem = {
  key?: string;
  slug?: string;
  poster?: string;
  /** v2.3.0 art enrichment — landscape cover/banner art (Kitsu/AniList/TMDB) */
  cover?: string;
  title: string;
  japaneseTitle?: string;
  description?: string;
  rating?: string;
  quality?: string;
  sub?: number;
  dub?: number;
  date?: string;
};

/**
 * FIX (v1.2.1): APIKuoshi v2.3.0 collapsed the old `{ data: { data: … } }`
 * double envelope to a single `{ data: … }` on /api/home and /api/top-ten.
 * Accept BOTH shapes so a future API flip can't blank these routes again.
 */
function unwrapPayload<T>(body: unknown): T | null {
  const seen = new Set<unknown>();
  let cursor: unknown = body;
  while (cursor && typeof cursor === "object" && !seen.has(cursor)) {
    seen.add(cursor);
    const obj = cursor as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj as T; // list envelope { results: [...] }
    if (typeof obj.data !== "undefined") {
      cursor = obj.data;
      continue;
    }
    break;
  }
  return (cursor && typeof cursor === "object" ? (cursor as T) : null);
}

export type SearchResult = {
  key: string | null;
  anilistId: number | null;
  malId: number | null;
  title: string;
  titleRomaji: string | null;
  titleEnglish: string | null;
  poster: string | null;
  year: number | null;
  type: string | null;
  episodes: number | null;
  status: string | null;
  /** v2.3.0 canonical rows also carry the listing slug */
  slug?: string | null;
  /** v2.3.0: where the poster came from — upstream | kitsu | tmdb | null */
  artSource?: string | null;
};

export type AnimeInfo = {
  key: string | null;
  /** v2.4.0 canonical shape — slug always present, survives every transform */
  slug?: string | null;
  anilistId: number | null;
  malId: number | null;
  title: string;
  titleRomaji: string | null;
  titleEnglish: string | null;
  /** v2.4.0 canonical detail fields (rendered on the details page) */
  titleNative?: string | null;
  poster: string | null;
  /** v2.4.0 detail-only art fields — explicit-null policy upstream */
  cover?: string | null;
  backdrop?: string | null;
  logo?: string | null;
  artSource?: string | null;
  banner: string | null;
  year: number | null;
  type: string | null;
  /** v2.4.0 — WINTER/SPRING/SUMMER/FALL when the source knows it */
  season?: string | null;
  episodes: number | null;
  status: string | null;
  /** v2.4.0 — average score (0-100 AniList scale) */
  score?: number | null;
  /** v2.4.0 — age rating string ("PG-13", "R", …) */
  rating?: string | null;
  genres: string[];
  synonyms: string[];
  synopsis: string | null;
};

export type Episode = {
  number: number;
  title: string | null;
  titleJapanese?: string | null;
  id?: string | null;
  aired?: string | null;
  filler?: boolean;
  recap?: boolean;
  /**
   * FIX (v1.2.0): v2.3.0 per-episode art — the enrichment chain fills
   * upstream → Kitsu → TMDB, series poster last (thumbSource: "poster").
   * Rendered in the watch-page episode grid instead of the series poster.
   */
  thumbnail?: string | null;
  thumbSource?: string | null;
};

export type ApiServer = {
  name: string;
  originalName: string | null;
  type: string | null; // "sub" | "dub"
  beta?: boolean;
  id?: string | null;
};

export type SubtitleTrack = {
  label: string;
  language: string;
  url: string;
  format?: string;
  default?: boolean;
};

export type Stream = {
  provider: string;
  originalName: string | null;
  type: string | null;
  url: string | null;
  embedUrl: string | null;
  proxiedUrl: string | null;
  isHls: boolean;
  kind: "direct" | "embed";
  qualities?: { label: string; url: string }[];
  subtitles?: SubtitleTrack[];
  skipIntro?: { intro?: { start: number; end: number }; outro?: { start: number; end: number } };
  latencyMs?: number;
  httpStatus?: number;
};

export type CharacterEntry = {
  role: string | null;
  character: { id: number | null; name: string | null; image: string | null };
  voiceActor: { id: number | null; name: string | null; image: string | null } | null;
};

export type ScheduleEntry = KazeItem & { time?: string; episode_no?: number };

export type HomePayload = {
  spotlights: SpotlightItem[];
  trending: KazeItem[];
  topAiring: KazeItem[];
  genres: { name: string; slug?: string }[];
};

/* ------------------------------------------------------------- internals */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(path: string, opts: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<T> {
  const { timeoutMs = 45_000, signal } = opts;

  /**
   * FIX (v1.1.1): the live API occasionally answers 502/503/504 (Render
   * restarts) or drops a connection. Those are TRANSIENT — retrying twice
   * with a short backoff turns the "No anime found / Couldn't load" error
   * cards users saw after a single bad response into a silent recovery.
   * Only network-level and gateway errors retry; real API 404s return once.
   */
  const RETRIABLE = [502, 503, 504, 429];
  const backoff = [700, 1_800];
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= backoff.length; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error("Request timed out")), timeoutMs);
    const onOuterAbort = () => ctrl.abort();
    signal?.addEventListener("abort", onOuterAbort);
    try {
      const res = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal, headers: { Accept: "application/json" } });
      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; message?: string; error?: string }
        | null;
      if (RETRIABLE.includes(res.status)) {
        lastError = new ApiError(body?.message || body?.error || `API error (${res.status})`, res.status);
        if (attempt < backoff.length) {
          await new Promise((r) => setTimeout(r, backoff[attempt]));
          continue;
        }
        throw lastError;
      }
      if (!res.ok || !body?.success) {
        throw new ApiError(body?.message || body?.error || `API error (${res.status})`, res.status);
      }
      // FIX (v1.3.0 — §1): decode HTML entities at the source — every title,
      // synopsis, character name, episode title and schedule row that leaves
      // this function is already clean.
      return sanitizeDeep(body) as T;
    } catch (e) {
      // Network failures (TypeError from fetch) and aborts caused by our own
      // timeout are transient — same retry ladder. Caller aborts do NOT retry.
      const isCallerAbort = signal?.aborted === true;
      const isTimeout = e instanceof Error && /timed out/i.test(e.message);
      const isNetwork = e instanceof TypeError;
      lastError = e;
      if (!isCallerAbort && (isNetwork || isTimeout || (e instanceof ApiError && RETRIABLE.includes(e.status)))) {
        if (attempt < backoff.length) {
          await new Promise((r) => setTimeout(r, backoff[attempt]));
          continue;
        }
      }
      throw e;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onOuterAbort);
    }
  }
  throw lastError instanceof Error ? lastError : new ApiError("API error", 0);
}

/**
 * FIX (v1.3.0 — §1): HTML entity artifacts ("&" rendering as ";amp" and
 * similar) — upstream scrapes arrive with entities like &amp; &#039; &mdash;
 * baked into titles/synopses/character names, and React renders string
 * content VERBATIM (it never decodes entities), so the artifacts leaked
 * onto every card. Decode ONCE at the source: every response that flows
 * through apiFetch() is deep-sanitized below, so no component ever has to
 * think about it. URLs survive untouched in practice (a decoded & is the
 * correct separator there anyway).
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "\u2014", ndash: "\u2013", hellip: "\u2026", laquo: "\u00ab", raquo: "\u00bb",
  ldquo: "\u201c", rdquo: "\u201d", lsquo: "\u2018", rsquo: "\u2019",
  copy: "\u00a9", reg: "\u00ae", trade: "\u2122", deg: "\u00b0",
  plusmn: "\u00b1", times: "\u00d7", divide: "\u00f7", frac12: "\u00bd",
  eacute: "\u00e9", egrave: "\u00e8", agrave: "\u00e0", ccedil: "\u00e7",
  uuml: "\u00fc", ouml: "\u00f6", auml: "\u00e4", ntilde: "\u00f1",
  bull: "\u2022", dagger: "\u2020", permil: "\u2030", prime: "\u2032", Prime: "\u2033",
};

const ENTITY_RE = /&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});/g;

/** Decode HTML entities (named + numeric) in a plain string. Never throws. */
export function decodeEntities(input: string): string {
  if (!input || (!input.includes("&") && !input.includes("#"))) return input;
  return input.replace(ENTITY_RE, (match, body: string) => {
    if (body.charCodeAt(0) === 35 /* # */) {
      const hex = body[1] === "x" || body[1] === "X";
      const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

const SANITIZE_MAX_DEPTH = 8;

function sanitizeDeep(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return decodeEntities(value);
  if (!value || typeof value !== "object" || depth >= SANITIZE_MAX_DEPTH) return value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = sanitizeDeep(value[i], depth + 1);
    return value;
  }
  for (const k of Object.keys(value as Record<string, unknown>)) {
    const obj = value as Record<string, unknown>;
    obj[k] = sanitizeDeep(obj[k], depth + 1);
  }
  return value;
}

/** proxiedUrl values are same-origin RELATIVE paths on the API host. */
export function absoluteUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

export function subtitleProxyUrl(sub: SubtitleTrack): string | null {
  return absoluteUrl(`/api/proxy/subtitle?url=${encodeURIComponent(sub.url)}&ref=${encodeURIComponent("https://megaplay.buzz/")}`);
}

/* ------------------------------------------------------------------ core */

export async function search(q: string, page = 1): Promise<SearchResult[]> {
  const r = await apiFetch<{ results: SearchResult[] }>(
    `/api/search?q=${encodeURIComponent(q)}&page=${page}`
  );
  return r.results ?? [];
}

export async function suggestions(keyword: string) {
  const r = await apiFetch<{ suggestions: KazeItem[] }>(
    `/api/suggestions?keyword=${encodeURIComponent(keyword)}`,
    { timeoutMs: 15_000 }
  );
  return r.suggestions ?? [];
}

export async function meta(key: string): Promise<{ anime: AnimeInfo; relations?: RelationsBlock }> {
  return apiFetch(`/api/meta?key=${encodeURIComponent(key)}`);
}

export async function resolveTitle(title: string) {
  return apiFetch<{ found: boolean; playable: boolean; key: string; anime: AnimeInfo }>(
    `/api/resolve?title=${encodeURIComponent(title)}`,
    { timeoutMs: 60_000 }
  );
}

/* ----------------------------------------------------------------- anime */

export async function animeEpisodes(key: string): Promise<Episode[]> {
  const r = await apiFetch<{ episodes: Episode[] }>(`/api/anime/episodes?key=${encodeURIComponent(key)}`, {
    timeoutMs: 60_000,
  });
  return r.episodes ?? [];
}

export async function animeServers(key: string, ep: number, type = "all"): Promise<ApiServer[]> {
  const r = await apiFetch<{ servers: ApiServer[] }>(
    `/api/anime/servers?key=${encodeURIComponent(key)}&ep=${ep}&type=${type}`,
    { timeoutMs: 60_000 }
  );
  return r.servers ?? [];
}

/**
 * Fresh stream resolution. Every call re-fetches (server caches 60s) which
 * guarantees a fresh CDN token — this is our "token refresh" primitive.
 */
export async function watch(key: string, ep: number, type: "sub" | "dub" | "all" = "sub"): Promise<Stream[]> {
  const r = await apiFetch<{ streams: Stream[] }>(
    `/api/watch?key=${encodeURIComponent(key)}&ep=${ep}&type=${type}`,
    { timeoutMs: 90_000 }
  );
  return (r.streams ?? []).map((s) => ({
    ...s,
    url: absoluteUrl(s.url),
    proxiedUrl: absoluteUrl(s.proxiedUrl),
  }));
}

/** One-shot chain (resolve -> streams -> probe). Great for deep links. */
export async function chain(params: { key?: string; q?: string; ep?: number; type?: string }) {
  const p = new URLSearchParams();
  if (params.key) p.set("key", params.key);
  if (params.q) p.set("q", params.q);
  p.set("ep", String(params.ep ?? 1));
  if (params.type) p.set("type", params.type);
  const r = await apiFetch<{ anime: AnimeInfo; servers: ApiServer[]; streams: Stream[]; best: Stream | null; verdict: string }>(
    `/api/chain?${p.toString()}`,
    { timeoutMs: 90_000 }
  );
  return {
    ...r,
    streams: (r.streams ?? []).map((s) => ({
      ...s,
      url: absoluteUrl(s.url),
      proxiedUrl: absoluteUrl(s.proxiedUrl),
    })),
  };
}

/* ----------------------------------------------------------------- meta */

export async function characters(key: string, limit = 16): Promise<CharacterEntry[]> {
  const r = await apiFetch<{ characters: CharacterEntry[] }>(
    `/api/meta/characters?key=${encodeURIComponent(key)}&limit=${limit}`,
    { timeoutMs: 60_000 }
  );
  return r.characters ?? [];
}

export async function recommendations(key: string, limit = 12) {
  const r = await apiFetch<{ recommendations: KazeItem[] }>(
    `/api/meta/recommendations?key=${encodeURIComponent(key)}&limit=${limit}`,
    { timeoutMs: 60_000 }
  );
  return r.recommendations ?? [];
}

/* ---------------------------------------------------------------- browse */

type ListResp = { results?: KazeItem[]; data?: unknown };

function items(r: ListResp): KazeItem[] {
  if (Array.isArray(r.results)) return r.results;
  if (r.data && typeof r.data === "object" && Array.isArray((r.data as { data?: KazeItem[] }).data)) {
    return (r.data as { data: KazeItem[] }).data;
  }
  if (Array.isArray(r.data)) return r.data as KazeItem[];
  return [];
}

/**
 * FIX (v1.2.0 — §10 PERF): tiny client-side TTL cache for browse/catalog
 * GETs. The API is cold-start sensitive (Render free tier); repeating the
 * same tab switch / page flip inside the TTL should not re-storm it.
 *   - 120 s TTL, max 80 entries (LRU-ish trim)
 *   - in-flight dedup: parallel callers share one request
 *   - cacheApiClear() exposed for hard refreshes
 * Playback endpoints (watch/chain/servers/proxy) are NEVER cached — their
 * CDN tokens are short-lived by design.
 */
const browseCache = new Map<string, { at: number; data: KazeItem[] }>();
const browseInflight = new Map<string, Promise<KazeItem[]>>();
const BROWSE_TTL = 120_000;

export function cacheApiClear() {
  browseCache.clear();
}

async function browse(path: string, timeoutMs = 45_000, cacheable = true): Promise<KazeItem[]> {
  if (!cacheable) {
    const r = await apiFetch<ListResp>(path, { timeoutMs });
    return items(r);
  }
  const key = path;
  const hit = browseCache.get(key);
  if (hit && Date.now() - hit.at < BROWSE_TTL) return hit.data;
  const inflight = browseInflight.get(key);
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const r = await apiFetch<ListResp>(path, { timeoutMs });
      const data = items(r);
      if (browseCache.size > 80) {
        const oldest = browseCache.keys().next().value;
        if (oldest) browseCache.delete(oldest);
      }
      browseCache.set(key, { at: Date.now(), data });
      return data;
    } finally {
      browseInflight.delete(key);
    }
  })();
  browseInflight.set(key, p);
  return p;
}

/**
 * FIX (v1.2.0 — §10 PERF): /api/home is the heaviest call on the landing
 * route — a short TTL cache + in-flight dedup keeps back/forward navigation
 * instant instead of re-downloading the whole discovery payload.
 */
let homeCache: { at: number; data: HomePayload } | null = null;
let homeInflight: Promise<HomePayload> | null = null;

export async function homePage(): Promise<HomePayload> {
  if (homeCache && Date.now() - homeCache.at < 120_000) return homeCache.data;
  if (homeInflight) return homeInflight;
  homeInflight = (async () => {
    try {
      const r = await apiFetch<unknown>(`/api/home`, { timeoutMs: 60_000 });
      const d = unwrapPayload<HomePayload>(r) ?? { spotlights: [], trending: [], topAiring: [], genres: [] };
      const data = {
        spotlights: d.spotlights ?? [],
        trending: d.trending ?? [],
        topAiring: d.topAiring ?? [],
        genres: d.genres ?? [],
      };
      homeCache = { at: Date.now(), data };
      return data;
    } finally {
      homeInflight = null;
    }
  })();
  return homeInflight;
}

export const trending = () => browse(`/api/trending`);
export const spotlight = () => browse(`/api/spotlight`);
export const popular = () => browse(`/api/popular`);
export const upcoming = () => browse(`/api/upcoming`);
export const topTen = async (): Promise<{ today: KazeItem[]; week: KazeItem[]; month: KazeItem[] }> => {
  const r = await apiFetch<unknown>(`/api/top-ten`, { timeoutMs: 60_000 });
  const d = unwrapPayload<{ today: KazeItem[]; week: KazeItem[]; month: KazeItem[] }>(r) ?? {
    today: [],
    week: [],
    month: [],
  };

  /**
   * FIX (v1.1.1): the top-ten endpoint shapes items as
   * { slug, rank, NAME, poster, sub, dub, type } — every other list endpoint
   * uses `title`. The component rendered item.title → undefined, so the Top 10
   * row showed posters with NO names (the "top ten section bug"). Normalize
   * here once so all consumers see the standard KazeItem shape.
   */
  const normalize = (list: unknown): KazeItem[] =>
    (Array.isArray(list) ? list : [])
      .map((raw) => {
        const it = (raw ?? {}) as Record<string, unknown>;
        return {
          key: typeof it.key === "string" ? it.key : undefined,
          slug: typeof it.slug === "string" ? it.slug : undefined,
          poster: typeof it.poster === "string" ? it.poster : undefined,
          title: String(it.title ?? it.name ?? "").trim(),
          japaneseTitle: typeof it.japaneseTitle === "string" ? it.japaneseTitle : undefined,
          sub: typeof it.sub === "number" ? it.sub : undefined,
          dub: typeof it.dub === "number" ? it.dub : undefined,
          type: typeof it.type === "string" ? it.type : undefined,
          rank: typeof it.rank === "number" ? it.rank : undefined,
        } satisfies KazeItem;
      })
      .filter((it) => it.title.length > 0);

  /**
   * FIX (v1.1.2): the upstream "Top 10" widget only exposes NINE entries per
   * period (verified against the page DOM and the API extractor — nothing is
   * sliced server-side), so the row showed 9 cards under a "Top 10" heading.
   * Backfill each period to 10 from /api/top-rankings (ranked catalog, 27
   * entries): append the highest-ranked titles not already present. The
   * rankings call is best-effort — if it fails we still return what we have.
   */
  const backfill = (list: KazeItem[], ranked: Array<Record<string, unknown>>): KazeItem[] => {
    if (list.length >= 10) return list.slice(0, 10);
    const seen = new Set(list.map((x) => (x.slug || x.title).toLowerCase()));
    const extras = ranked
      .filter((raw) => {
        const slug = typeof raw.slug === "string" ? raw.slug : "";
        const title = typeof raw.title === "string" ? raw.title.trim() : "";
        return (slug || title) && !seen.has((slug || title).toLowerCase());
      })
      .sort((a, b) => (typeof a.rank === "number" ? a.rank : 99) - (typeof b.rank === "number" ? b.rank : 99))
      .slice(0, 10 - list.length)
      .map((raw, i) => ({
        slug: typeof raw.slug === "string" ? raw.slug : undefined,
        poster: typeof raw.poster === "string" ? raw.poster : undefined,
        title: String(raw.title ?? "").trim(),
        rank: list.length + i + 1,
      } satisfies KazeItem))
      .filter((it) => it.title.length > 0);
    return [...list, ...extras];
  };

  let ranked: Array<Record<string, unknown>> = [];
  try {
    const rr = await apiFetch<{ results: Array<Record<string, unknown>> }>(`/api/top-rankings`, {
      timeoutMs: 30_000,
    });
    ranked = Array.isArray(rr.results) ? rr.results : [];
  } catch {
    /* rankings are optional — the base lists still render */
  }

  const base = {
    today: normalize(d.today),
    week: normalize(d.week),
    month: normalize(d.month),
  };

  return ranked.length
    ? {
        today: backfill(base.today, ranked),
        week: backfill(base.week, ranked),
        month: backfill(base.month, ranked),
      }
    : base;
};
export const topRankings = (sort = "top") =>
  browse(`/api/top-rankings?sort=${encodeURIComponent(sort)}`);
export const completedList = (page = 1) => browse(`/api/completed?page=${page}`);
export const newRelease = (page = 1) => browse(`/api/new-release?page=${page}`);
export const newlyAdded = (page = 1) => browse(`/api/newly-added?page=${page}`);
export const latestUpdated = (page = 1) => browse(`/api/latest-updated?page=${page}`);
export const recentlyUpdated = (tab = "all") =>
  browse(`/api/recently-updated?tab=${encodeURIComponent(tab)}`);
export const airing = () => browse(`/api/airing`);
export const schedule = async (): Promise<ScheduleEntry[]> => {
  const r = await apiFetch<{ results: ScheduleEntry[] }>(`/api/schedule`, { timeoutMs: 60_000 });
  return r.results ?? [];
};
export const azList = (letter: string, page = 1) =>
  browse(`/api/az-list/${encodeURIComponent(letter)}?page=${page}`);
export const genreList = (genre: string, page = 1) =>
  browse(`/api/genre/${encodeURIComponent(genre)}?page=${page}`);
export const typeList = (type: string, page = 1) =>
  browse(`/api/type/${encodeURIComponent(type)}?page=${page}`);

export type FilterParams = {
  keyword?: string;
  genre?: string;
  type?: string;
  status?: string;
  season?: string;
  language?: string;
  rating?: string;
  source?: string;
  sort?: string;
  year?: string;
  epMin?: string;
  epMax?: string;
  page?: number;
};

/**
 * FIX (v1.2.0 — §9): the API's multi-genre contract is ONE `genre` param with
 * a comma-separated list ("genre=action,comedy") — routed through the filter
 * extractor which supports repeated genre[]= upstream-side. ("genres=" is an
 * unknown param the API reports in ignoredParams[] — never use it.)
 */
export async function filter(params: FilterParams): Promise<KazeItem[]> {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || v === null) continue;
    p.set(k === "epMin" ? "ep_min" : k === "epMax" ? "ep_max" : k, String(v));
  }
  return browse(`/api/filter?${p.toString()}`, 60_000);
}

/* ---------------------------------------------------------------- helpers */

/** Kaze slugs can carry an "/ep-N" tail — strip for anime-level navigation. */
export function cleanSlug(slug?: string | null): string | null {
  if (!slug) return null;
  return slug.replace(/\/ep-\d+.*$/i, "");
}

/**
 * Pick the details/watch address for any list item — ALWAYS `/anime/:key`
 * or `/anime/:slug`, NEVER the raw title.
 *
 * FIX (v1.3.0 — §1): v1.2.x fell back to the sanitized TITLE when a row had
 * no canonical id ("title-based routing causes API errors"). With API v2.4.0
 * every catalog row carries BOTH a resolvable `key` AND a non-empty `slug`
 * (shape.js contract: "slug survives every transformation"), so the title
 * fallback is gone:
 *   1. canonical id key (anilist:/mal:/numeric) — exact identity, zero latency
 *   2. the row's listing slug, "ep-N" tail stripped — resolves via /api/meta
 *   3. the row's raw key string (slug-shaped pseudo-keys included)
 *   4. title, ONLY when the row somehow has neither key nor slug
 * Anything non-canonical still goes through resolveAnimeKey() on the
 * details/watch pages, so slugs upgrade to canonical ids on arrival.
 */
export function itemKey(item: { slug?: string; title: string; key?: string | null }): string {
  if (item.key && isCanonicalKey(item.key)) return item.key;
  const slug = cleanSlug(item.slug);
  if (slug) return slug;
  if (item.key) return item.key;
  return sanitizeTitleKey(item.title?.trim() || "");
}

/**
 * FIX (v1.1.2): the API's key parser splits on ":" and expects the prefix to
 * be anilist/mal — a plain title that CONTAINS a colon ("Mushoku Tensei:
 * Jobless Reincarnation Season 3", "Re:ZERO") is read as an unknown
 * prefix:value pair and rejected with `400 Unknown key format`. That made
 * every card whose title had a colon land on "Couldn't load this title"/
 * "Stream unavailable" while the browse list itself loaded fine. Strip the
 * colons from title-shaped keys so card links always carry a key the parser
 * accepts; the details/watch resolvers still recover the canonical id via
 * meta-verify → search ladder when the stripped variant needs it.
 */
export function sanitizeTitleKey(title: string): string {
  return title
    .replace(/\s*:\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** True when the key is already in canonical id form (anilist:/mal:/123). */
export function isCanonicalKey(key: string): boolean {
  return /^(anilist|mal):\d+$/i.test(key) || /^\d+$/.test(key);
}

/**
 * Turn a kaze-style slug ("tomb-raider-king-91d21") into a human query
 * ("tomb raider king") by dropping the trailing hash token.
 */
export function slugToQuery(key: string): string {
  return decodeURIComponent(key)
    .replace(/-[a-z0-9]{5,6}$/i, "")
    .replace(/-/g, " ")
    .trim();
}

/**
 * Resolve ANY legacy/user-supplied key to a canonical one the API accepts.
 *
 * Order (all existing endpoints — nothing invented):
 *   1. canonical ids pass straight through
 *   2. plain titles pass straight through (API does AniList search)
 *   3. slug-looking keys AND titles that fail direct meta: run /api/search
 *      on progressively simplified queries until a resolvable key shows up:
 *        full query → hyphen/paren segments → significant single tokens
 *      (long kaze titles flood /api/search with key-less catalog rows —
 *      e.g. "Sousou no Frieren - Marumaru no Mahou (Mini Anime)" returned
 *      30 rows, none keyed, while its token "frieren" returns the AniList
 *      franchise. The ladder recovers the key in those cases.)
 * Returns the original key when nothing better is found so callers can
 * still attempt playback before surfacing an error card.
 */
const RESOLVE_STOPWORDS = new Set([
  "no", "the", "a", "an", "wa", "ga", "ni", "de", "to", "of", "and", "part", "season",
  "episode", "ep", "ova", "ona", "special", "movie", "dub", "sub", "uncut", "censored",
]);

function resolveQueryVariants(key: string): string[] {
  // Slug-shaped keys ("one-piece-odmau") must be de-slugged first — the
  // search endpoint matches words, not hyphenated slugs.
  const base = /^[a-z0-9-]+$/i.test(key) && key.includes("-") ? slugToQuery(key) : key.replace(/\s+/g, " ").trim();
  const variants: string[] = [];
  const push = (v?: string | null) => {
    const t = (v ?? "").replace(/\s+/g, " ").trim();
    if (t.length >= 3 && !variants.some((x) => x.toLowerCase() === t.toLowerCase())) variants.push(t);
  };

  push(base);
  // 1. drop parenthetical qualifiers: "(Mini Anime)", "(Dub)" …
  push(base.replace(/\s*\([^)]*\)\s*/g, " "));
  // 2. individual segments split on " - "/" – " (subtitle halves)
  for (const seg of base.split(/\s+[-–—]\s+/)) push(seg.replace(/\s*\([^)]*\)\s*/g, " "));
  // 3. significant single tokens, longest first (max 3 network attempts
  //    happen at the caller — this list is just ordered candidates)
  const tokens = base
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !RESOLVE_STOPWORDS.has(t))
    .sort((a, b) => b.length - a.length);
  for (const t of tokens.slice(0, 4)) push(t);

  return variants;
}

export async function resolveAnimeKey(
  rawKey: string
): Promise<{ key: string; anime?: AnimeInfo }> {
  const key = decodeURIComponent(rawKey || "").trim();
  if (!key) return { key };
  if (isCanonicalKey(key)) return { key };

  // Title-shaped (contains a space or CJK) → the API resolves it directly.
  // Verify cheaply so bad titles fall through to the search resolver.
  if (!/^[a-z0-9-]+$/i.test(key)) {
    try {
      const r = await meta(key);
      if (r.anime?.key) {
        // FIX (v1.2.0 — §5): v2.3.0's /api/meta can return a canonical entry
        // whose `key` is a TITLE-DERIVED pseudo-slug (e.g. "Cowboy Bebop" →
        // key "cowboy-bebop") that the API itself CANNOT resolve back
        // (meta/episodes 404: "No listing or metadata found for slug"). Only
        // trust canonical ids outright; for anything else, verify the key
        // resolves (the verify call also upgrades slug keys to their
        // canonical anilist:/mal: form) and fall through to the search
        // ladder when it doesn't.
        if (isCanonicalKey(r.anime.key)) return { key: r.anime.key, anime: r.anime };
        try {
          const verify = await meta(r.anime.key);
          if (verify.anime?.key) return { key: verify.anime.key, anime: verify.anime };
        } catch {}
      }
    } catch {}
  } else {
    // FIX (v1.2.0 — §5): slug keys became first-class in API v2.2+ — a REAL
    // listing slug (e.g. "cowboy-bebop-kb7hu") resolves via /api/meta and
    // usually upgrades to its canonical anilist:/mal: id. Try it first (one
    // call) before the search ladder; title-derived pseudo-slugs 404 and
    // fall through exactly like before.
    try {
      const r = await meta(key);
      if (r.anime?.key) return { key: r.anime.key, anime: r.anime };
    } catch {}
  }

  // Search ladder: full query first, then simplified variants.
  const variants = resolveQueryVariants(key);
  let budget = 4; // bound network attempts — the API is slow when cold
  for (const query of variants) {
    if (budget <= 0) break;
    try {
      const results = await search(query);
      // A variant only "counts" when at least one row carries a canonical
      // key — key-less kaze catalog rows would just reproduce the bug.
      const withKey = results.filter((r) => r.key);
      if (withKey.length === 0) continue;
      budget--;

      /**
       * FIX (v1.1.1): pick the BEST match, not blindly the first row.
       * "one-piece-odmau" → query "one piece" used to adopt the first result
       * ("One Piece: Episode of Merry" — a SPECIAL). Rank: exact title match,
       * then startsWith, then the first row that carries a resolvable key.
       */
      const q = query.toLowerCase();
      const hit =
        withKey.find((r) => r.title.toLowerCase() === q) ??
        withKey.find((r) => r.title.toLowerCase().startsWith(q)) ??
        withKey[0];
      if (hit?.key) return { key: hit.key };
    } catch {}
  }

  return { key };
}

/**
 * Franchise discovery for the watch page "Seasons & Specials" panel.
 * Strips season/part markers from the title and searches the API, then
 * groups results into Seasons (TV) / Movies (MOVIE) / Specials (OVA, ONA,
 * SPECIAL). Uses the existing /api/search endpoint only.
 */
export type FranchiseGroup = {
  seasons: SearchResult[];
  movies: SearchResult[];
  specials: SearchResult[];
};

export function franchiseBaseTitle(title: string): string {
  return title
    .replace(/\((mini anime|dub|sub|uncut|censored)\)/gi, "")
    .replace(
      /\b(\d+(?:nd|rd|st|th)\s+season|season\s+\d+|part\s+\d+|cour\s+\d+|final\s+season|ii+|iii+|iv|vi+)\b/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function franchiseSearch(
  title: string,
  currentKey: string
): Promise<FranchiseGroup> {
  const base = franchiseBaseTitle(title || "");
  const out: FranchiseGroup = { seasons: [], movies: [], specials: [] };
  if (!base || base.length < 2) return out;
  let results: SearchResult[] = [];
  try {
    results = await search(base);
  } catch {
    return out;
  }
  const seen = new Set<string>();
  for (const r of results) {
    if (!r.key || seen.has(r.key)) continue;
    seen.add(r.key);
    if (r.key === currentKey) continue;
    const t = r.type?.toUpperCase() || "";
    if (t === "MOVIE") out.movies.push(r);
    else if (t === "OVA" || t === "ONA" || t === "SPECIAL") out.specials.push(r);
    else out.seasons.push(r);
  }
  return out;
}

/* --------------------------------------------------------- relations (v1.3.0) */

/** One related entry from /api/meta `relations` / /api/watch-order. */
export type RelationEntry = {
  key: string | null;
  slug: string | null;
  title: string;
  titleRomaji?: string | null;
  titleEnglish?: string | null;
  type?: string | null;
  status?: string | null;
  year?: number | null;
  episodes?: number | null;
  poster?: string | null;
  relation?: string;
};

/** relationsBlock shape from shape.js — entries + canonical buckets. */
export type RelationsBlock = {
  entries: RelationEntry[];
  groups: Record<string, RelationEntry[]>;
  counts?: Record<string, number>;
};

/** /api/seasons/:slug — seasons list for the details panel. */
export async function seasonsList(slug: string): Promise<RelationEntry[]> {
  try {
    const r = await apiFetch<{ seasons?: RelationEntry[] }>(
      `/api/seasons/${encodeURIComponent(cleanSlug(slug) || slug)}`,
      { timeoutMs: 45_000 }
    );
    return r.seasons ?? [];
  } catch {
    return [];
  }
}

/** /api/watch-order/:slug — related + watch order for the details panel. */
export async function watchOrder(slug: string): Promise<{ related: RelationEntry[]; groups: RelationsBlock["groups"] }> {
  try {
    const r = await apiFetch<{ related?: RelationEntry[]; groups?: RelationsBlock["groups"] }>(
      `/api/watch-order/${encodeURIComponent(cleanSlug(slug) || slug)}`,
      { timeoutMs: 45_000 }
    );
    return { related: r.related ?? [], groups: r.groups ?? {} };
  } catch {
    return { related: [], groups: {} };
  }
}

export type TitleLang = "romaji" | "english";

/**
 * FIX (v1.3.0 — §8): Characters display split. APIKuoshi's /api/meta/characters
 * returns AniList `name.full` in ROMAJI with family-name-first order
 * ("Zoro Roronoa", "Chopper Tony Tony"). "english" renders the Western
 * order ("Roronoa Zoro") by rotating the first token to the end;
 * "romaji" renders the API value verbatim. Single-token names are
 * unchanged in both modes.
 */
export function characterDisplayName(name: string | null | undefined, lang: TitleLang): string {
  const raw = (name ?? "").trim();
  if (!raw) return "";
  if (lang !== "english") return raw;
  if (raw.includes(",")) return raw.replace(/^(.+),\s*(.+)$/, "$2 $1");
  const tokens = raw.split(/\s+/);
  if (tokens.length < 2) return raw;
  return [...tokens.slice(1), tokens[0]].join(" ");
}

export function displayTitle(
  item: { title?: string; japaneseTitle?: string; titleRomaji?: string | null; titleEnglish?: string | null },
  lang: TitleLang = "romaji"
): string {
  const romaji = item.titleRomaji || item.title || item.titleEnglish || item.japaneseTitle || "Untitled";
  if (lang === "english") {
    return item.titleEnglish || romaji;
  }
  return romaji;
}
