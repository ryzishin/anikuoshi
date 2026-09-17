# AniKuoshi v1.1.0 — Re-Test Report

**Date:** 2026-09-17 · **Environment:** production build (`bun run build` → standalone server, localhost:3000) against the live API `https://apikuoshi-etau.onrender.com`. Verified in a real browser (Chromium via agent-browser) at desktop (1366×900) and mobile (iPhone 14, 390×844) viewports. Evidence screenshots in `docs/retest-*.png`.

## 1. Critical bug fixes — PASS

| Area | Before | After | Evidence |
|---|---|---|---|
| `/browse` filters/genre/type/A–Z | Page crashed at hydration: Radix `<Select.Item value="">` threw for every "Any" option (Status/Season/Year/Language/Rating/Source/Sort); cards linked to unresolvable Kaze slugs so every click dead-ended | Empty options use an `"any"` sentinel (mapped back to `""` for the API); all cards link resolvable title keys; tab/genre/type/letter state syncs to the URL | `retest-browse.png`; `GET /browse?tab=genre&genre=action`, `/browse?tab=az&letter=b` → 200 with rendered grids |
| `/search` + suggestions | Results OK (canonical `anilist:` keys) but the EJS quick-search / suggestion strip linked Kaze slugs → 404 details | `suggestions.ejs` links the title (API-resolvable); search page unchanged otherwise | `retest-search` flow; fragment returns `href="/anime/Sousou%20no%20Frieren..."` (title keys); `/search?q=frieren` → 6 results, 0 console errors |
| `/anime/:slug` | Blank / "Couldn't load this title" for any browse/home/suggestion entry (`/api/meta?key=<kaze-slug>` → 404) | `itemKey()` prefers title; details page canonicalizes any legacy slug via `resolveAnimeKey()` (meta-verify → `/api/search` fallback) before loading meta/episodes/characters/recommendations | `retest-details-page.png`: `/anime/Tomb%20Raider%20King` AND legacy `/anime/tomb-raider-king-91d21` both render full details with real MAL episode titles |

**Root cause (all three):** the API resolves only `anilist:<id>` | `mal:<id>` | bare id | plain title (`apikuoshi/src/core/keys.js`); the frontend navigated with Kaze listing slugs. No API changes were needed or made.

## 2. Sidebar — PASS
- Duplicate X removed (the shadcn `SheetContent` built-in close is the single button). `retest-sidebar-single-close.png`.
- Outside-click, Escape and route-change dismissal unchanged (Sheet primitive behavior untouched).

## 3. Watch page order — PASS
Verified order on `/watch?key=Tomb%20Raider%20King&ep=1`:
1. **Player** — top, primary focus (`retest-watch-player-servers.png`)
2. **Servers** — switcher panel directly below the player (sub/dub grouped chips, active highlight, collapsible; strip toggle + `S` key intact)
3. **Episodes** — grid with thumbnail + episode name + airdate + filler/now-playing badges (`retest-watch-episodes.png`)
4. **Seasons & specials** — grouped Seasons / Movies / OVA-ONA-Specials via franchise search on the existing `/api/search` (`retest-watch-seasons-recs.png`; graceful empty state)
5. **Recommendations** — bottom (`More like this`)

State/scroll/player controls unaffected: progress sync, skip-intro (visible when in intro window), auto-next countdown, prev/next all wired to the same episode-navigation callback.

## 4. Player switching — PASS
- Switcher in the under-player strip: **Senshi (default) | Plyr | Vidk | Embed** (`radio` group, persisted in `localStorage`).
- Plyr (`retest-player-plyr.png`) and Vidk (`retest-player-vidk.png`) both attach the HLS stream and render video; Senshi behavior unchanged (regression-safe default).
- Cross-engine state bridge: position/volume/rate/subtitles snapshot on switch and restore on load; `startAt` honored by all engines.
- Fallback chain: 403/stall/decode → refresh token (`/api/watch` re-call) → retry → next server → **embed** → error card. Silent refresh recovery hands control back from the auto-embed fallback.
- Token freshness: every server switch and failure path re-calls `/api/watch` (server cache 60s ⇒ fresh CDN tokens); playback rides the API `proxiedUrl`.

## 5. Mobile (iPhone 14, 390×844) — PASS
- `scrollWidth <= innerWidth` ⇒ **no horizontal scroll** on home/browse/watch.
- Sticky bottom nav (Home/Browse/Search/Profile) with safe-area padding; hidden on `/watch` (`retest-mobile-home.png`).
- 44px touch targets: player controls (secondary back-10s/PiP hidden on phones), icon buttons, chips/tabs, sidebar links, search clear (`retest-mobile-watch.png`).
- Safe-area insets respected (bottom nav, footer); skeletons present on all data fetches.

## 6. Regression sweep — PASS
- Routes `/, /home, /browse, /search?q=frieren, /anime/:key, /watch, /download` → 200 in production.
- Assets: `/manifest.webmanifest` (4 icons incl. 2 maskable), `/favicon.ico`, `/favicon.svg`, `/icons/icon-512.png`, `/icons/icon-maskable-192.png`, `/download/anikuoshi-v1.1.0-source.zip` → 200.
- Auth/progress/list API routes untouched; EJS fragments (`/api/fragments/suggestions`, `/api/fragments/schedule`) working; htmx vendor script loads.
- Zero page errors in the browser console on home/browse/search/watch (only a pre-existing Radix `aria-describedby` warning on dialogs, unchanged from v1.0).
- TypeScript: no new errors (`bunx tsc --noEmit`; pre-existing `examples/` + `aos.css` module notes remain as in v1.0, excluded from build per `next.config.ts`).
- Production build completes with all 24 routes.

## 7. Branding assets — PASS
- `推` (oshi) mark on `#8b5cf6 → #d946ef` gradient tile with play accent; legible at 16px (favicon.ico 16/32/48 verified).
- PWA: icon-192/512 (any), icon-maskable-192/512 (full-bleed, safe zone), apple-touch-icon 180.
- `logo.svg` horizontal lockup + `logo-mark.svg`; all glyphs embedded as paths (no font dependency).
- Manifest + layout metadata + in-app `BrandedLogo` updated to match.
