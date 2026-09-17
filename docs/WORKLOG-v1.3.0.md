# AniKuoshi v1.3.0 — Worklog

Every fix with root cause, files touched, and verification. Built against **APIKuoshi v2.4.0** (`https://apikuoshi-v2.onrender.com/api/docs.json`, `src/core/shape.js`, `src/core/enrich.js`, `src/core/keys.js` read before any code changed).

---

## 1. Global & Navigation

### 1.1 Keyboard shortcuts audit — FIXED
- **Root cause (conflicts):** (a) `Space`/`Enter` were hijacked globally while a button/link/switch had focus — pressing Space both clicked the focused control *and* toggled playback; (b) `?` and `/` lacked `preventDefault`, so `?` could also type into non-typing targets and `/` triggers Firefox quick-find; (c) ctrl/alt/meta chords were not filtered; (d) the removed server-panel toggle left a stale `S` binding + help entry; (e) the old Senshi shortcuts were wired to a `videoRef` that no longer exists after the engine removal.
- **Files:** `src/components/player/player-engine.tsx` (rewritten key handler, routes through a `PlayerControls` bridge), `src/components/app-providers.tsx` (GlobalShortcuts: preventDefault + chord filter), `src/components/shortcuts-modal.tsx` (help table updated, "S" removed).
- **Verification:** lint clean; help modal lists only live bindings; player shortcuts no-op safely on Embed (provider owns controls); global "/" focuses header search, "?" opens help on every route.

### 1.2 Bigger header search bar — DONE
- **Files:** `src/components/layout/navbar.tsx` (QuickSearch input `h-9 → h-11` (44px thumb-friendly), wider `sm:w-56 focus:w-80 lg:w-64 focus:w-96`, larger icon/padding, dropdown offset updated).
- **Verification:** poster-preview suggestions still open (EJS fragment route unchanged), keyboard ↑/↓/Enter/Esc flow unchanged.

### 1.3 Card hrefs use `/anime/:slug` or `:key`, never the title — FIXED
- **Root cause:** v1.2.x `itemKey()` fell back to the sanitized **title** when a row lacked a canonical id — title-based routing causes API errors (colon titles 400, title-search mismatches).
- **Fix:** with v2.4.0 every catalog row carries both `key` and a non-empty `slug` (shape.js contract). New order: canonical id key → row's listing slug (`/ep-N` tail stripped) → row's raw key → title only as a last resort. Non-canonical addresses still upgrade through `resolveAnimeKey()`.
- **Files:** `src/lib/api.ts` (`itemKey`).
- **Verification:** every card/carousel/relation/schedule link renders `/anime/<slug-or-key>`; details + watch pages resolve slugs to canonical ids on arrival.

### 1.4 Title language honored everywhere — FIXED
- **Root cause:** hardcoded `item.title` remained in the old Top 10 row and a few rows used stored titles directly.
- **Files:** `src/lib/api.ts` (`displayTitle` unchanged, reused), `src/components/home/top-ten-carousel.tsx` (new, uses `displayTitle`), `src/app/anime/[key]/page.tsx` (relation rows use titleRomaji/titleEnglish per setting), `src/app/watch/page.tsx`, `src/app/history/page.tsx` (unchanged, already compliant), characters get the new Characters setting (§8).
- **Verification:** switching Anime Titles to English flips every card/row/detail/watch/history surface to `titleEnglish`; Romaji flips back.

### 1.5 HTML entity artifacts (`&` → `;amp`) — FIXED AT THE SOURCE
- **Root cause:** upstream scrapes arrive with entities (`&amp;`, `&#039;`, `&mdash;`…) inside titles/synopses/names; React renders string content verbatim, so the artifacts leaked everywhere.
- **Fix:** `decodeEntities()` (named + numeric map) + `sanitizeDeep()` applied to **every** response inside `apiFetch()` — the single API boundary. Server-rendered EJS fragments inherit the clean data (and escape it properly for HTML context).
- **Files:** `src/lib/api.ts`.
- **Verification:** unit-reasoned through every consumer (cards, details, characters, episodes, fragments); no component-level decoding needed; URLs unaffected in practice.

### 1.6 Logo links to `/home` — FIXED
- **Files:** `src/components/layout/navbar.tsx` (header logo `<Link href="/"> → href="/home"`).
- **Verification:** clicking the wordmark from any page lands on `/home`.

### 1.7 AI-generated design indicators removed — DONE
- **What changed:** gradient CTA buttons/chips/avatars → solid `bg-primary text-primary-foreground`; landing hero fallback + CTA band wash + blur-blob removed; `.glow` shadow removed from the primary CTA; feature icon tiles → `bg-primary/10` tint; card play-overlay circle → solid primary; progress bars → solid primary; poster error placeholder → neutral `bg-muted`; account initials avatar → solid primary; footer kept its (valid) arbitrary-value safe-area padding.
- **Files:** `src/app/page.tsx`, `src/app/profile/page.tsx`, `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/app/offline/page.tsx`, `src/app/history/page.tsx`, `src/app/browse/page.tsx`, `src/app/settings/page.tsx`, `src/app/download/page.tsx`, `src/components/anime/anime-card.tsx`, `src/components/anime/poster-image.tsx`, `src/components/home/continue-row.tsx`, `src/components/home/home-feed-tabs.tsx`, `src/components/home/top-ten-carousel.tsx`, `src/components/layout/navbar.tsx`, `src/components/pwa/install-button.tsx`, `src/lib/fragments/suggestions.ejs`.
- **Kept:** the small brand marks (logo tile, loader core) retain the signature gradient — one intentional accent, not slop. Dark theme + accent palette system untouched.

### 1.8 Performance — DONE
- hls.js (~500 KB) and Plyr no longer imported anywhere (`src/components/player/player-engine.tsx` rewritten; `plyr-player.tsx` deleted) — Vidstack loads its own HLS engine lazily (`dynamic(() => import("./vidk-player"), { ssr: false })`).
- Idle prefetch of `/home /browse /search /history /settings` from the header (`router.prefetch` in `requestIdleCallback`) — sidebar links never enter the viewport so Next never warmed them.
- Catalog TTL cache (120 s + in-flight dedup) kept for all browse GETs; `/api/home` cache kept.
- Files: `src/components/layout/navbar.tsx`, `src/lib/api.ts`, player components.

## 2. Home Page — RESTRUCTURED
- **Files:** `src/components/home/top-ten-carousel.tsx` (new), `src/components/home/home-feed-tabs.tsx` (new), `src/app/home/page.tsx` (rewritten), deleted `top-ten-row.tsx` + `card-row.tsx`.
- **Top 10 first, looping carousel** (like the landing hero): full-bleed backdrop (spotlight `cover`/`backdrop` enrichment matched by key/slug, poster fallback), big rank numeral, title + meta, 6.5 s auto-advance that wraps, arrows + dots, pause on hover/focus, reduced-motion aware, Today/Week/Month tabs.
- **Tabbed feeds**: Spotlight · Trending · Recently updated · Popular · Top airing · Upcoming, with a **`‹ n ›` pagination control** beside the tab bar; **grid layout** (2/3/4/6 columns) instead of horizontal rows. Pagination depth follows the API — `/api/latest-updated` paginates; the other lanes are single-page upstream and the control honestly shows 1/1.
- **Hero art from the API**: carousel art lookup is built from `/api/home` spotlights/trending/top-airing (cover/backdrop per row).
- **Verification:** tab switch renders skeletons then the grid; page flip refetches with cache; carousel loops and pauses; all links use `itemKey()`.

## 3. Browse Page — keyword waits for Apply
- **Root cause of the complaint:** the fetch `useEffect` depended on every form field, so typing in the keyword input auto-fetched like a live search.
- **Fix:** form fields are DRAFT state; a separate `applied` snapshot commits on **Apply** (and Reset). The fetch effect reads only `applied`. Multi-select genres + "All" chips unchanged (immediate, as shipped).
- **Files:** `src/app/browse/page.tsx`.
- **Verification:** typing alone never triggers a fetch (no network activity until Apply); Apply fetches and renders; Reset restores the full catalog view.

## 4. Watch Page — player & controls

### 4.1 Players — Senshi + Plyr removed; Vidk + Embed kept
- `player-engine.tsx` rewritten around two engines; `plyr-player.tsx` **deleted**; hls.js import gone.
- Fallback chain preserved: direct → silent token refresh → next server → embed → clean empty/error card. Auto-fallback into Embed (not persisted) and auto-return to Vidk after a successful refresh both kept.
- Player switcher button cycles Vidk ↔ Embed.

### 4.2 Embed sandbox removed
- **File:** `src/components/player/embed-player.tsx` — `sandbox` attribute deleted entirely; `referrerPolicy="origin"` + `allow` list stay; slow-embed helper and postMessage end/progress listeners unchanged.

### 4.3 Vidk thumbnail stretching fixed
- Poster renders letterboxed: `.vds-poster { object-fit: contain !important }` in `globals.css` (black shell = true letterbox/pillarbox).
- The watch page passes the **episode thumbnail** (`currentEpisode.thumbnail` — the v2.4.0 enrichment chain with `thumbSource`) falling back to the series poster.
- **Files:** `src/app/globals.css`, `src/components/player/vidk-player.tsx`, `src/app/watch/page.tsx` (`episodePoster`).

### 4.4 Subtitles fixed
- Tracks proxied through `/api/proxy/subtitle` (CORS-safe), rendered as Vidstack `Track`s (selectable in the player captions menu).
- Deterministic default: stream's own `default` flag → English track (`eng`/`en`/label) → first track; exactly one track marked default (`subtitlesWithDefault` in the engine).
- **Files:** `src/components/player/player-engine.tsx`, `src/components/player/vidk-player.tsx`.

### 4.5 Seamless switching; no reset on toggle
- Cross-engine bridge (`crossRef`: time/volume/muted/rate) + per-mount `startAt`/`startVolume`/`startMuted`/`startRate` — server switches (loader `switchTo`) and episode switches preserve position where technically possible; the render-scope reset prevents cross-episode position leaks (kept from v1.2).
- Toggles (`autoplay`, `autoplayNext`, `autoSkip`) only mutate the preferences store — the player key/instance does not change, so playback never restarts.
- Token freshness: every switch re-calls `/api/watch` (`useStreamLoader.load/switchTo/refresh`) before the stream loads — the API's 403-avoidance contract.
- **Files:** `src/components/player/player-engine.tsx`, `src/components/player/use-stream-loader.ts`.

### 4.6 Layout — always-visible servers, no note, clean strip
- Server panel rendered unconditionally below the player (`data-testid="server-panel"`); the Show/Hide toggle, the "panel hidden" card and the explanatory note are gone.
- Under-player strip: **prev/next beside smaller auto-play/auto-next/auto-skip chips**, anime name + episode title/number between them with **marquee** overflow (`MarqueeText`, CSS `animate-marquee` kept).
- **Files:** `src/components/player/player-engine.tsx`, `src/app/watch/page.tsx` (serversOpen state + hidden-panel card deleted).

### 4.7 Loader — wiggling ellipsis
- `EllipsisLoader` (three dots, staggered `ellipsis-wiggle` keyframes — translate + slight rotate; disabled under reduced motion) replaces the circular Kuoshi spinner in the playback path (resolving/refreshing overlay, embed loading, engine mount skeleton).
- **Files:** `src/components/layout/logo.tsx`, `src/app/globals.css`, `src/components/player/player-engine.tsx`, `src/components/player/embed-player.tsx`.

### 4.8 Unaired / no-stream handling
- `isEpisodeUnaired()` parses `aired` ("Sep 29, 2023" / ISO) with a 1-minute tolerance; series-level check uses `status === "Not Yet Aired"`. `PlayerEngine` renders the "Not aired yet" state (no player, no CTA); unaired grid buttons are disabled with a "not aired" chip.
- `failure === "empty"` (no streams at all) renders a clean "No stream available" state with no scary error copy.
- **Files:** `src/app/watch/page.tsx`, `src/components/player/player-engine.tsx`.

## 5. Details Page
- **Files:** `src/app/anime/[key]/page.tsx` (rewritten), `src/lib/api.ts` (`seasonsList`, `watchOrder`, `RelationEntry`, `RelationsBlock`, meta relations type).
- **Data completeness:** every field the v2.4.0 detail endpoints expose is rendered — synopsis, type, season, year, status, episodes, score, age rating, genres, synonyms, native title, poster/cover/backdrop/banner art. (Studio/source/duration/trailer are **not** part of the v2.4.0 `/api/anime`+`/api/meta` payloads — verified live — and per the "no invented fields" rule nothing was fabricated.)
- **Combined fetch:** `meta` + `characters` + `recommendations` + `seasonsList` + `watchOrder` in one `Promise.allSettled` effect with per-section skeletons; the hero gates on meta.
- **Episode grid removed** + **"Open Player" removed**; replaced by **Seasons / Prequel / Sequel / Specials·Movies·OVA·ONA / Related** rows built from `/api/meta`'s `relations` block (AniList-authoritative buckets), `/api/seasons/:slug` and `/api/watch-order/:slug`, deduped by key/slug, and **validated against the franchise base title** (`sameFranchise()` on the listing-lane entries) so unrelated shows cannot appear.
- **Watchlist status dropdown:** Planning / Watching / Completed / On Hold / Dropped + Remove (POST/DELETE `/api/user/list`); the trigger shows the current status with a BookmarkCheck icon.
- **Movie CTA:** `type === "Movie" && episodes === 1` → **"Watch"**; other single-episode entries → "Watch episode 1".
- **Not aired:** disabled "Not aired yet" CTA, no watch link.
- **Continue:** server/guest progress surfaces "Continue EP n".

## 6. Watch Progress Sync & History — FIXED
- **Root cause:** the engine's flush-on-hide effect had `[]` deps and captured the FIRST render's `syncProgress` closure — after an episode switch, a pagehide flushed the position onto the wrong episode, corrupting continue-watching.
- **Fix:** a `latestRef` mirrors the live key/title/poster/episode + writer; the flush (visibilitychange + `pagehide` + unmount) always writes the current episode/timestamp. Milestone flushes (15 s throttle, pause, ended) unchanged; guest localStorage map unchanged; `/history` + home Continue row read the same records.
- **Files:** `src/components/player/player-engine.tsx`.
- **Verification:** play ep N → switch to N+1 → background the tab → server record has ep N+1 at the live timestamp; details page "Continue EP n" matches; History progress bars agree.

## 7. Profile — avatar upload
- Any image file (`accept="image/*"`), 15 MB pre-check, canvas center-crop to 256×256 with **WebP → JPEG → PNG encoder fallback** (older engines can't encode canvas WebP), explicit "Uploading…" state, actionable toasts. PATCH `/api/user/profile` contract unchanged (data-URL ≤ 420 KB, mime allow-list).
- **Files:** `src/app/profile/page.tsx`.

## 8. Settings — rebuilt, everything functional
- **Files:** `src/app/settings/page.tsx` (rewritten), `src/lib/store/types.ts` (`Preferences` + `migratePreferences`), `src/components/preferences-provider.tsx`, `src/components/player/use-stream-loader.ts`.
- **Default Provider** (renamed from "Default Server"): codenames riyo · kaito · hana · sora · akira · yuki · miso · kenji · arashi · taiki · System (auto) — the exact `SERVER_CODENAMES` served by v2.4.0. Runtime effect: `orderStreams(streams, pref, providerPref)` bubbles the chosen provider to the front **only when present**; otherwise pure auto ordering (the documented fallback).
- **Language & Display split:** **Anime Titles** (English/Romaji → `titleLang`) and **Characters** (English/Romaji → `charLang`; Western order via `characterDisplayName()` — "Zoro Roronoa" ↔ "Roronoa Zoro").
- **Default Language** (Sub/Dub/System → `defaultLanguage`): feeds the engine's `audioPref`, driving default stream selection.
- **Migration:** stored `defaultServer: "sub"|"dub"` auto-migrates to `defaultLanguage`; missing new keys backfill defaults; idempotent, user choice always wins.
- **Every control verified functional:** default player (2 engines) → engine resolution; autoplay trio → engine behavior; ambient/reduced-motion → theme engine; theme variant/accent → CSS vars; all persist locally + PATCH-sync when signed in.

## 9. Version & docs
- `package.json` → **1.3.0**; `CHANGELOG.md` v1.3.0 entry; README rewritten for the new player/settings/home; `docs/DEPLOY.md` updated; this worklog + `docs/RETEST-REPORT-v1.3.0.md` + `docs/SUMMARY-v1.3.0.md` added; `/download` page rebranded v1.3.0 with a working **Download ZIP** button (`/anikuoshi-v1.3.0-source.zip`).
