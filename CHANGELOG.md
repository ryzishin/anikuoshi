# Changelog

All notable changes to AniKuoshi are documented here. Format: [Keep a Changelog](https://keepachangelog.com), SemVer-ish (major.minor.patch).

## [1.2.1] — 2026-09-17

Minor-fix round on top of the v1.2.0 overhaul: landing-page BG hero restored, the duplicate Trending row removed and the home feed reordered, all user settings consolidated into `/settings`, plus a silent **signed-in preference-sync** bug found and fixed during re-test.

### Fixed — landing page BG hero
- The cinematic hero rendered only the flat brand gradient because **APIKuoshi v2.3.0 collapsed the `/api/home` response envelope** from `{ data: { data: … } }` to a single `{ data: … }` — `homePage()` parsed `r.data?.data`, got `undefined`, and spotlights came back empty. The parser now accepts **both shapes** (`unwrapPayload` walks the `data`/`results` envelopes to the first object payload), so the art-enriched slideshow (AniList banners, Kitsu covers, TMDB backdrops) is back on the landing page, with a new `cover` fallback when a spotlight has no `poster`.

### Changed — home feed: Trending removed, Spotlight added, new order
- **"Trending now" removed from `/home`.** Verified against the live API: `/api/trending` (12 entries) and `home.trending` carry **exactly the same 12 titles that lead `/api/latest-updated`** (12/12 overlap), so the row read as a duplicate of "Recently updated" — removed per the standing rule for API-level duplicates.
- **New "Spotlight" row** in its place, surfacing the v2.3.0 art-enriched spotlight picks from `/api/home`.
- **New row order**: Continue watching (signed in) → **Top 10 → Spotlight → Recently updated** → Popular with everyone → Top airing → Coming soon. Page subtitle updated to match.
- The anime card's score badge now renders only genuinely numeric ratings — spotlight rows put **age ratings** ("PG-13", "R") in `rating`, which previously rendered as **"★ NaN"**.

### Fixed — Top 10 per-period data (same envelope change)
- `/api/top-ten` got the same v2.3.0 envelope change, so `topTen()`'s per-period lists parsed empty and every Today/Week/Month tab silently fell back to the `/api/top-rankings` backfill. With the shared `unwrapPayload` parser the **real per-period Top 10 data renders again** (the rankings backfill remains as the safety net).

### Changed — all user settings now live in `/settings`
- The **Preferences panel moved from `/profile` to `/settings`** (new "Playback & preferences" card: title language, default server, auto-play next, autoplay, auto-skip, ambient mode, reduced motion). `/settings` is now the single home for appearance, default player and playback prefs; `/profile` is identity (avatar, display name, password), My list and Continue watching, with a compact link card to Settings.
- Wired through the same preferences store: instant localStorage persistence for guests, PATCH `/api/user/preferences` for signed-in users; the under-player toggle chips stay in sync.

### Fixed — signed-in preference sync silently discarded (found in re-test)
- **The SQLite `preferences` column is declared `String`**, so Prisma handed the JSON blob back as a string and `mergePreferences()` spread the string's **characters** over the defaults — every read (`/api/auth/me`, PATCH responses, the sign-in merge) returned pure defaults while the writes stored the JSON correctly. Preference sync across sessions/devices never actually survived a reload for signed-in users. `mergePreferences()` now parses strings before merging (Mongo's object shape passes through unchanged). Verified end-to-end: toggle in Settings → server record changes → reload restores the server state.

## [1.2.0] — 2026-09-17

Player UX overhaul, watch sync, browse fixes & performance pass — built against **APIKuoshi v2.3.0** (new live base `https://apikuoshi-v2.onrender.com`, canonical-shape + art-enrichment release).

### Removed — start-of-playback skip-intro prompt (§1)
- The "Skip intro/outro" prompt button that appeared at the beginning of every playback is gone entirely. The underlying `skipIntro` data is untouched and stays wired to the **Auto-skip** toggle, which seeks past intro/outro automatically when enabled (embeds keep their own mechanisms).

### Removed — "Play next episode" countdown (§1)
- The countdown overlay and its timer are removed entirely. It fired on the wrong trigger (entering an episode could immediately start a countdown toward the NEXT one) and fought the prev/next buttons. All five orphaned state paths (`ended`, episode-change cancel, play-replay cancel, control-bar cancels, the overlay itself) were excised together.

### Changed — player order & default player (§2)
- Player order is now **Plyr → Vidk → Senshi → Embed** (switcher cycle + Settings ordering). The Senshi engine remains the factory default.
- New **Default player** preference in **Settings** (`prefs.defaultPlayer`): which engine loads first. Resolution order: Settings default → per-device last manual choice → Senshi. Persisted to the user profile (PATCH `/api/user/preferences`), synced across devices; the under-player switcher still changes engines for the current session without overriding the default.
- Cross-engine state bridge (time / volume / rate / subtitles / fullscreen / PiP) and the full fallback chain (403/stall/decode → refresh token → retry → next server → next player type → embed → error card; every switch re-calls `/api/watch` for fresh CDN tokens) are unchanged.

### Fixed — auto-play / auto-next / auto-skip semantics (§3)
- **Auto-play** starts playback automatically after auto-next fired, a server switch, or an episode switch (gates the attach-time `play()` call).
- **Auto-next** fires ONLY at true end-of-playback — the `ended` event on every engine (Senshi video, Plyr, Vidk, embed postMessage) — never on entry.
- **Auto-skip** seeks past intro/outro using the API's `skipIntro` ranges, once per window, on every direct engine (embeds excluded by design).
- All three are the compact checkmark chips below the player and persist to the user profile; guests keep them in localStorage.

### Added — episode thumbnails & aired-date fix (§4)
- The watch-page episode grid now renders **per-episode `thumbnail`** from the v2.3.0 enrichment chain (upstream → Kitsu → TMDB → series poster fallback, `thumbSource` reported per episode). The series poster is only the fallback now, not the universal art.
- **Aired dates render in full** — the API returns `"Sep 29, 2023"` and the old `String(aired).slice(0, 10)` chopped it to `"Sep 29, 20"`, losing the year. The complete date (including year) now renders.

### Fixed — "Couldn't load this title" (§5)
- **API base moved to the v2.3.0 deployment** (`apikuoshi-v2.onrender.com`); the client, service worker allowlist and `.env.example` all follow.
- `itemKey()` now uses a row's canonical `key` (`anilist:<id>` / `mal:<id>`) directly when the v2.3.0 catalog provides one — exact identity instead of title search. Title-first ordering stays for key-less rows; slugs remain the last resort.
- The quick-search suggestions fragment and schedule fragment prefer canonical keys the same way.
- Verified in-browser across TV / Movie / OVA titles, colon-titles ("Mushoku Tensei: …", "Re:ZERO"), romaji / English / Japanese eras and legacy slug URLs.

### Changed — layout & navigation (§6)
- **Bottom nav removed entirely** (component deleted; main content no longer reserves its strip). Sidebar + header handle navigation at every width.
- **The header nav is visible on /watch again** — it is the way out of the site without closing the tab.
- **Back chevron** at the top of the watch page returns to the originating page (browser history with a `/home` fallback on fresh deep links).
- **Appearance moved into a new `/settings` page** (theme variants + accent palettes, plus the new default-player preference); the sidebar's inline Appearance section is gone, and the profile page links to Settings. The sidebar's double close button was already removed in v1.1 (Sheet primitive's own close + outside-click + Esc remain).

### Added — quick search, History page & watch-progress resume (§7)
- **Header quick search** (beside the account area): debounced (300 ms), aborts stale requests, renders the EJS suggestions fragment with poster previews, works signed-in AND signed-out, visible on mobile now that the bottom nav is gone, and keyboard-friendly (↑/↓ highlight, Enter opens the highlighted row or full search, Esc closes).
- **New History ("Continue Watching") nav page** (`/history`): watch history with progress bars, "almost done" markers, per-entry remove; signed-in reads `/api/user/progress`, guests fall back to the localStorage progress map (which now also stores title/poster/duration/timestamp).
- **Watch-progress resume tightened**: the watch page fetches the saved record for the anime; when its episode matches the URL, the exact timestamp seeds the player (signed-in). Guests resume from localStorage. Progress flushes on pause, visibility-change, **`pagehide`** (new), and unmount — the exact episode + timestamp is consistent across the watch page, History page, and the home Continue-Watching row.

### Changed — watch page strip (§8)
- **Prev/Next episode buttons moved below the player**, beside the toggles (out of the Senshi control bar; keyboard `n`/`p` unchanged).
- The strip shows the **full anime name + episode title/number**, scrolling as a **marquee** when it overflows (CSS `animate-marquee`, respects `prefers-reduced-motion`).
- Toggles made smaller to fit. **"Add to List" removed** (the details page owns list management). The redundant **"Change server (s)"** button became **"Show Servers"**, and the open panel keeps its small **Hide** link in the upper-right corner.

### Fixed — browse Types / Genres "All" chips + multi-genre (§9)
- The **Types tab "All" chip** renders the full catalog (via `/api/az-list/all`) — previously `typeParam ? fetch : []` showed an empty page.
- Same fix for the **Genres tab "All" chip**.
- **Genres are multi-select**: click toggles a genre on/off, several can be active, and the selection is sent as one comma-separated `genre` param (the API's documented multi-genre contract routed through its filter extractor). The active selection is visible in the URL (`?tab=genre&genre=action,comedy`) and echoed above the results.

### Performance pass (§10)
- **Client-side TTL cache** (120 s, in-flight dedup) for browse/catalog GETs and `/api/home` — tab switches and back/forward navigation stop re-storming the cold-start-prone API. Playback endpoints are never cached (short-lived CDN tokens).
- **`preconnect` + `dns-prefetch`** to the API base so the first catalog request skips DNS/TLS latency.
- **Progressive episode rendering** — long lists (1000+ episodes) mount in 60-item chunks driven by an IntersectionObserver sentinel instead of one giant DOM drop; the active episode is always in the rendered window.
- **`AnimeCard` wrapped in `React.memo`** — cards are the bulk of reconciled nodes on home/browse rows.
- Repaired a broken `lg:grid-cols-[...]` template class on /home (v1.1.2 shipped it without the opening `[`, silently collapsing the desktop two-column layout).
- Skeletons and lazy-loading kept in place; service worker version bumped (`anikuoshi-v1.2.0`) so clients purge stale caches on deploy.

### Compatibility
- No stack changes, no refactors: Next.js App Router, shadcn/ui, EJS+htmx fragments, MongoDB Atlas / Prisma SQLite fallback all untouched.
- Only v2.3.0 fields/endpoints are used (`thumbnail`, `thumbSource`, canonical keys, comma-separated multi-genre) — nothing invented.
- Auth, progress sync, theme engine, PWA and the player fallback chain are preserved (and exercised in the re-test report).

## [1.1.2] — 2026-09-17

Player-experience fix round from live testing: the Top 10 count, prev/next vs auto-next conflicts, the post-skip "invisible delay", and under-player controls.

### Fixed — Top 10 showed only 9 (home)
- **Not a CSS bug**: the upstream "Top 10" widget exposes exactly **9 entries per period** (verified in the source page DOM and the API extractor — nothing is sliced server-side). `topTen()` now backfills slot 10 from `/api/top-rankings` (ranked catalog): the highest-ranked title not already present is appended with the next rank. The rankings fetch is best-effort — the row degrades to 9 if it fails. The "Top 10" heading is now truthful again.

### Fixed — Prev/Next vs auto-next countdown (watch)
- Clicking **Next/Prev while the auto-next countdown overlay was up** left the orphaned timer running: it kept counting over the *new* episode and fired a second `onEpisodeChange` at zero — skipping two episodes. Any episode change (player buttons, keyboard `n`/`p`, header buttons, episode grid, the countdown itself) now cancels a pending countdown.
- Resuming playback manually (replay after `ended`) also cancels the countdown instead of being hijacked seconds later.
- Added a **Previous-episode button** to the Senshi control bar (the bar previously only had Next).

### Fixed — invisible delay after prev/next (watch)
- **Root cause (double bug):** the first React commit after an episode change still has `phase="direct"` with the *previous* episode's stream, so the attach effect re-attached the OLD stream and snapshotted the old episode's `currentTime`, which `restorePosition()` then replayed inside the NEW episode — a multi-second seek/buffer "invisible delay" (worst at auto-next, where the old position is near the end). Fixed with a scope guard (`animeKey:episode`) on the attach effect: stale commits are consumed, the loader drives a clean attach, and positions are never carried across episodes.
- The guest-progress restore point is now cleared on episode change (it could leak from ep N into ep N+1 through the same path).
- Alt engines (Plyr/Vidk) had the mirror bug: `startAt` came from the cross-engine bridge holding the previous episode's position — the bridge is now episode-scoped and late time-reports from unmounting engines are discarded.

### Added — playback toggles under the player
- Three compact checkmark chips below the player: **Autoplay** (auto-start on stream attach — the play call is now gated on it), **Auto next** (end-of-episode countdown, was previously only in profile settings), **Auto skip** (automatically seek past intro/outro windows, once per window, works on every engine). All three live in the preferences store — synced to localStorage locally and to the server for signed-in users, and mirrored in the profile settings page.

### Changed — one-button player switcher
- The 4-button engine radiogroup (Senshi · Plyr · Vidk · Embed) is now a **single button showing the active engine**; clicking cycles Senshi → Plyr → Vidk → Embed → Senshi. Same engines and persistence, a quarter of the strip space. Tooltip lists the full cycle.

### Fixed — blank player on embed-only episodes (bug found while testing)
- An episode whose servers are **all embed-kind** set `phase="embed"` but the auto-switch to the embed player only fired on `exhausted` — the player area rendered nothing at all. The fallback now covers `embed` phase too.

### Fixed — Senshi re-attach lost position after engine switch
- Returning to Senshi from Plyr/Vidk remounts a fresh `<video>` (currentTime 0) and had no restore point; the switch handler now seeds the restore ref from the cross-engine bridge so position carries over exactly.

## [1.1.1] — 2026-09-17

Follow-up repair pass driven by live testing: the Top 10 row, watch-page mobile layout, and card-click consistency ("No anime found" from some routes while others worked), plus fixes for every bug surfaced by a full browser sweep.

### Fixed — Top 10 section (home)
- **Titles never rendered**: `/api/top-ten` shapes items as `{ slug, rank, name, poster, sub, dub, type }` while every other list endpoint uses `title` — the component rendered `item.title` (undefined), so the row showed posters with blank labels. `topTen()` now normalizes `name` → `title` (and preserves `rank`, used for the numerals).
- **Top 10 cards were the only cards still linking by Kaze slug** (`/anime/one-piece-odmau`) — the exact "works in browse, fails here" inconsistency. They now build links with the same `itemKey()` (title-first) used by every other row.

### Fixed — watch page unusable on phones
- The watch grid had no explicit mobile column template, so phones used an *implicit* `auto` track sized to content; the player's intrinsic width ballooned the track to ~656px on a 390px screen and overflow-x clipping hid the rest — "can't see the full page". `grid-cols-1` (minmax(0,1fr)) now constrains the track at every width; the same guard was applied to the home grid. Verified: zero horizontal overflow and zero clipped elements on 390px across all pages.

### Fixed — "No anime found" / "Couldn't load this title" from any route
- **Transient API failures are now retried**: the upstream API intermittently answers 502/503/504 or drops connections (Render restarts). A single bad response used to surface a permanent error card. `apiFetch()` now retries gateway errors (502/503/504/429) and network drops twice with short backoff; genuine 404s still return immediately.
- **Smarter slug resolution**: `resolveAnimeKey()` adopted the first search hit blindly and gave up when the API returned key-less catalog rows. It now walks a query ladder (full query → de-parenthesized → hyphen/paren segments → significant tokens) until a *keyed* result appears, and prefers exact/startsWith title matches (e.g. `one-piece-odmau` now lands on ONE PIECE itself, not the first fuzzy hit; `Sousou no Frieren - Marumaru no Mahou (Mini Anime)` resolves to its AniList entry).
- **Title-first links everywhere** (consistency): the /search typeahead suggestions and the schedule EJS fragment now emit title-based nav keys computed route-side (`navKey`), matching `itemKey()` semantics on every other card.
- **Recoverable error card**: the details error state now offers "Search <key>" (pre-filled) and "Browse catalog" alongside Retry, so any unresolvable key has a one-tap way out.

### Fixed — player engine switching
- **Switching back to Senshi left a dead (source-less) player**: the HLS attach effect didn't depend on `playerType`, so the remounted Senshi `<video>` never re-attached after visiting another engine. `playerType` is now a dependency (`changePlayerType()` already forces the re-attach). Verified: Senshi → Plyr → Senshi round-trip re-attaches, and playback position carries over exactly (4.0s → 4.0s).
- Fixed a React rule violation in `vidk-player.tsx` (ref written during render → moved into an effect).

### Fixed — service worker staleness (report bugs you find)
- Unhashed `.css`/`.js` responses were cached **cache-first**, so users could be stuck on a stale UI after any deploy (observed during testing). They now use stale-while-revalidate; only content-hashed `/_next/static/`, icons and vendor files stay cache-first.
- `/api/watch`, `/api/chain`, `/api/anime/servers` and `/api/proxy/` responses are **never cached** — they mint short-lived CDN tokens, and a cached stream response after network loss guaranteed 403s (contradicts the fresh-token-per-switch rule).
- `VERSION` bumped to `anikuoshi-v1.1.1` so `activate()` purges every cache left by older builds; `sw.js` itself is never intercepted; registration is skipped in dev so stale chunks can't mask freshly edited code.

### Improved
- Layout metadata: `data-scroll-behavior="smooth"` on `<html>` (removes the Next.js smooth-scroll console warning).
- Minor: Top 10 card width/rank alignment tightened now that titles occupy the label row.

## [1.1.0] — 2026-09-17

Full production repair pass: fixed the three broken critical paths (browse, search, details), regenerated the brand, removed the sidebar double close button, reordered the watch page, added switchable player engines, and a mobile-first polish pass.

### Fixed — critical (key-format mismatch, the root cause of all three)
- **Details page 404s / blank pages** (`/anime/:key`): the API's key system resolves only `anilist:<id>` | `mal:<id>` | bare id | **plain title** — but every list item linked with a Kaze slug (`tomb-raider-king-91d21`) which the API rejects. `itemKey()` now prefers the resolvable title; `src/lib/api.ts` gains `resolveAnimeKey()` (meta-verify → search fallback), `slugToQuery()`, `isCanonicalKey()`.
- **Details page hardening**: `/anime/[key]` first canonicalizes any legacy slug URL via `resolveAnimeKey()` before loading meta/episodes/characters/recommendations — old shared links work again.
- **Browse** (`/browse`): filters, genre/type/A–Z tabs were healthy upstream but every card linked to an unresolvable slug → dead ends. Fixed via `itemKey()`; tab/genre/type/letter state now syncs to the URL so those routes are shareable.
- **Search** (`/search`): results already carried canonical `anilist:` keys; suggestion strips and the EJS quick-search fragment linked slugs — `suggestions.ejs` now links the title (API-resolvable).
- **Watch** (`/watch`): slug keys resolved before any chain/episode call; Prev/Next/links use the resolved canonical key.

### Fixed — sidebar
- Removed the duplicate close button (custom `SheetTrigger` X on top of the primitive's built-in close). Outside-click, Escape and route-change dismissal unchanged.

### Added — watch page section order (per spec)
- Enforced order: **Player → Servers → Episodes → Seasons/Specials → Recommendations**. The server switcher panel now sits directly below the player (open by default, collapsible; the "Change server" strip toggle and `S` key still work).
- Episodes grid now shows a thumbnail (series poster; the API exposes no per-episode art) + episode name + airdate/filler/now-playing badges.
- **Seasons & specials** panel: franchise discovery via the existing `/api/search` endpoint — grouped into Seasons (prequel/sequel entries), Movies, and OVA/ONA/Specials.

### Added — switchable player engines
- **Senshi** (the original custom engine) — default, unchanged behavior.
- **Plyr** — Plyr UI over hls.js for HLS sources.
- **Vidk** — Vidstack-based engine (`@vidstack/react`); "Vidk" is the in-app name (no `vidk` package exists on npm).
- **Iframe embed** — sandboxed embed for streams that only expose `embedUrl`.
- Switcher lives in the under-player strip (persisted in `localStorage`, Senshi unless changed). Cross-engine state bridge preserves position, volume, rate and subtitle choice across switches where technically possible.
- Fallback chain extended: 403/stall/decode → refresh token → retry → next server → **embed player** → error card. Silent token refreshes hand control back from the embed fallback automatically.

### Added — branding assets (regenerated)
- New kanji-based mark 「推」 (oshi — "your favorite"; echoes the "-koshi" in AniKuoshi) on the brand gradient tile `#8b5cf6 → #d946ef` with a play accent.
- PWA icons: 192/512 "any", 192/512 **maskable**, apple-touch-icon (180).
- `logo.svg` horizontal lockup + `logo-mark.svg` square mark + `favicon.svg`/`favicon.ico` (16/32/48) — all glyph paths embedded (no font dependency).
- Generator scripts: `scripts/gen-brand-paths.py` (fontTools) + `scripts/gen-brand-raster.mjs` (sharp).
- `manifest.webmanifest` + metadata updated; in-app `BrandedLogo` redrawn to match.

### Improved — mobile-first pass
- New sticky **bottom navigation** (Home/Browse/Search/Profile) on <md viewports, hidden on `/watch`, safe-area aware.
- 44px minimum touch targets: icon buttons (`size-11` on mobile), player controls, browse tabs/chips, sidebar links, search clear button.
- No horizontal scroll on any viewport (`overflow-x: clip` + contained rows); safe-area padding for notched devices (body, bottom nav, footer).
- Secondary player controls (back-10s, PiP) hidden on phones so one-handed reach never overflows.

### Added — developer
- `.env.example` (referenced by the README but previously missing).
- `/download` platform preview page with Download ZIP button (links the source bundle served from `public/download/`).

## [1.0.0] — 2026-09-17

First production-ready release. Everything below shipped in this version.

### Added — Platform
- Next.js 16 (App Router) + TypeScript 5 + Tailwind CSS 4 + shadcn/ui (New York) foundation.
- Installable PWA: web manifest with shortcuts, custom service worker (`public/sw.js`) with precached shell, cache-first statics, network-first upstream-API caching and an `/offline` fallback route; `beforeinstallprompt`-driven install button.
- Mobile-first responsive layout with safe-area aware sticky footer, skeleton loaders on every data fetch, AOS entrance animations (auto-disabled under reduced motion), branded `KuoshiLoader` spinner.
- Service-worker-backed offline shell + graceful network error states everywhere.

### Added — Pages & navigation
- `/` landing: rotating spotlight hero from `/api/home`, value-prop grid, install CTA.
- `/home`: Continue Watching (signed in), Trending, Top 10 (Today/Week/Month), Recently Updated, Popular, Top Airing, Coming Soon + Today's-releases sidebar (EJS fragment) and "Jump back in" card.
- `/anime/[key]`: banner hero, poster, meta chips, genres, expandable synopsis, episode grid with real MAL titles, characters & voice actors, recommendations, add-to-list.
- `/watch`: player engine + server panel + episode grid + upcoming releases + per-episode server list + recommendations; Prev/Next, save-to-list.
- `/browse`: Filters tab (keyword, genre, type, status, season, language, rating, source, sort, year, episode range, pagination) + Genres / Types / A–Z tabs.
- `/search`: debounced live suggestions + full deduped results.
- `/login`, `/register`: validation, error states, redirects.
- `/profile`: avatar upload (client-resized 256px WebP data URL), display name, password change, preferences, My List, Continue Watching.
- `/offline` PWA fallback page; `/download` source-bundle page with Download ZIP button.

### Added — Player engine (critical path)
- Direct HLS player via `hls.js` with native HLS fallback (Safari/iOS); playback always uses the API's `proxiedUrl` so CDN tokens are re-minted per hop upstream.
- Embed player (iframe) with sandbox, `referrerpolicy="origin"`, `allowfullscreen`, and postMessage progress/end support when providers emit it.
- Full fallback chain: 403/401/CORS/timeout/decode/stall detection → silent token refresh (fresh `/api/watch` call) → retry once → auto-switch to next direct server → embed server → error card with retry, server picker and copy-diagnostics report.
- Non-blocking toasts for "Refreshing stream…" / "Switching server…".
- Playback continuity: position, volume, rate, subtitle language preserved across server switches; no hard page refreshes.
- Subtitle track selection from API-provided VTTs (proxied through `/api/proxy/subtitle`), quality picker, playback-speed menu, PiP, fullscreen.
- Skip intro / skip outro buttons driven by API `skipIntro` timestamps.
- Auto-next with 5-second cancelable countdown.
- Watchdog stall detector (readyState + time delta) triggering token refresh.
- Progress sync: 15s throttled POST + flush on pause/visibility-change/unmount; guest fallback in localStorage; resume-with-toast on return.
- Keyboard shortcuts: Space/K, ←/→, J/L, ↑/↓, M, F, N/P, S, 0–9, plus global `/` (search) and `?` (shortcuts modal).

### Added — Auth & user data
- Register (unique username + unique email), login by email **or** username, logout; HS256 JWT in an httpOnly, SameSite=Lax cookie (30 days).
- bcryptjs password hashing; no reset/recovery flow by design; password change requires old + new + confirm.
- Dual database driver behind one interface: MongoDB Atlas (native `mongodb` driver, active when `MONGODB_URI` is set) and Prisma/SQLite fallback for local dev/preview.
- Synced entities: watch progress, history (derived), lists (watching/planning/completed/on-hold/dropped), avatar, preferences.

### Added — Design system
- Theme engine: 4 dark variants (Kuoshi, Midnight, Dim, Contrast) × 8 accent palettes (violet, sakura, ocean, emerald, amber, crimson, azure, mint) via CSS custom properties; sidebar + navbar + profile pickers; localStorage + server persistence; reduced-motion flag.
- Sidebar drawer with outside-click **and** Escape dismissal; htmx-powered quick search dropdown (EJS-rendered suggestions); theme popover on desktop.

### Added — Server-rendered fragments
- EJS templates (`src/lib/fragments/*.ejs`) rendered by route handlers with TTL caching (empty results never cached) and swapped htmx-style: quick-search suggestions and today's release schedule.

### Added — SEO & metadata
- Metadata templates per page, Open Graph/Twitter cards, dynamic OG image route, apple-touch-icon, theme-color viewport, manifest shortcuts.

### Infrastructure
- Vercel-ready: zero serverless dependencies for playback (stream proxying stays on the API host), env-driven configuration, `.env.example` shipped.
- ESLint clean (0 errors) with React 19 compiler-aware config.

### Decisions
- **MongoDB native driver over mongoose** — fewer deps, same schema control; mirrors the Prisma models 1:1.
- **SQLite fallback** — the preview environment has no Atlas credentials, but auth/lists/progress must be fully functional; `MONGODB_URI` flips the store with no code changes.
- **Direct browser→API calls** — APIKuoshi echoes any CORS origin, so playback proxies stay on the API host (fresh tokens per hop) and serverless functions stay out of the streaming path.
- **Trailers omitted** — the API resolves trailer data internally but does not expose it publicly; feature gated behind API support per spec.
- **Seasons/OVA related rail omitted** — `/api/seasons/:slug` requires exact listing slugs and 502s for most keys; episodes grid covers specials via the flat list.

## [Unreleased]
- Watch-party sync room (needs its own websocket mini-service).
- Import/export lists in MAL/AniList JSON.
- New-episode notifications for list items (requires cron + push).
