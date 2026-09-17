# AniKuoshi v1.2.0 — Release Summary

**Date:** 2026-09-17 · Built against **APIKuoshi v2.3.0** (`https://apikuoshi-v2.onrender.com`) · No refactors, no stack changes, no invented endpoints.

## What changed (by task section)

1. **Player playback fixes** — the start-of-playback "Skip intro" prompt and the "Play next episode" countdown (UI + timer + every arm/cancel path) are removed entirely. `skipIntro` data stays wired to the Auto-skip toggle; auto-next fires only from true end-of-playback.
2. **Player order & default** — engines are now Plyr → Vidk → Senshi → Embed. A new **Default player** preference in the new Settings page decides which engine loads first (profile-synced; per-device last choice is the fallback; factory default remains Senshi). The cross-engine state bridge and the full fallback chain (refresh token → retry → next server → next player → embed → error card, fresh `/api/watch` tokens per hop) are untouched.
3. **Toggles that work** — Auto-play (auto-start after auto-next / server switch / episode switch), Auto-next (true `ended` only, every engine), Auto-skip (intro/outro via `skipIntro`, once per window; embeds excluded). All three persist to the user profile and localStorage.
4. **Episode data** — the watch-page episode grid renders per-episode `thumbnail` (v2.3.0 enrichment chain: upstream → Kitsu → TMDB → poster fallback) and full aired dates including the year (the old `slice(0,10)` chopped "Sep 29, 2023" to "Sep 29, 20").
5. **"Couldn't load this title"** — root-caused against the live API: `/api/meta` can return canonical entries keyed by title-derived pseudo-slugs the API itself cannot resolve back. `resolveAnimeKey()` now verifies non-canonical keys (falling through to the search ladder) and slug keys resolve directly via `meta` (upgrading to `anilist:`/`mal:` ids). Verified across TV / Movie / OVA-era / romaji / English titles, colon-titles, canonical ids and legacy kaze slugs.
6. **Layout & navigation** — mobile bottom nav deleted; the header nav stays visible on /watch; a chevron back button returns to the originating page (history-aware, `/home` fallback); Appearance moved into a new `/settings` page (with the default-player preference); the sidebar's inline Appearance section is gone; the sidebar double-close stays removed.
7. **Search & sync** — header quick search beside the account area: debounced, aborting, poster previews, works signed-out, mobile-visible, keyboard navigation (↑/↓/Enter/Esc). New **History** page (`/history`) with progress bars for signed-in users and a localStorage fallback for guests. Watch progress now resumes the exact episode + timestamp on the watch page and flushes on pause / visibilitychange / `pagehide` / unmount — consistent across watch page, History and home Continue-Watching.
8. **Watch page strip** — Prev/Next moved below the player beside the toggles; full anime name + episode title renders between them with a **marquee** on overflow (reduced-motion aware); toggles shrank; "Add to List" removed (details page owns it); "Change server (s)" became **"Show Servers"** with the panel's upper-right **Hide** link.
9. **Browse** — Types and Genres "All" chips render the full catalog (previously empty pages); Genres are multi-select, sent as the API's comma-separated `genre` param, shareable via URL.
10. **Performance** — 120 s client cache with in-flight dedup for catalog GETs and `/api/home` (playback never cached); API `preconnect`/`dns-prefetch`; progressive episode rendering (60-item chunks + IntersectionObserver) for 1000+-episode series; `AnimeCard` memoized; /home broken `lg:grid-cols-[...]` template repaired; SW version bumped to `anikuoshi-v1.2.0` (new API host allowlist) so clients purge stale caches.

## Bugs found during verification (fixed in place)

1. Watch page could stay titled "Loading…" forever when `/api/chain` failed — leaked into progress records and History. Fixed with an `/api/meta` fallback.
2. The Plyr engine reported time through a mount-time callback closure, so progress records kept stale title/poster. Fixed with the v1.1.1-style `cbRef` pattern (as Vidk already used).
3. /home's desktop two-column layout was silently collapsed by a malformed Tailwind template shipped in v1.1.2. Repaired.
4. The new strip's toggles overflowed 390 px viewports — the row now wraps (0 px horizontal scroll everywhere).

## What was verified

Full browser pass (Chromium, desktop 1366×900 + mobile 390×844) over every section above — `docs/RETEST-REPORT-v1.2.0.md` holds the item-by-item matrix with 20 evidence screenshots; `docs/CHANGELOG.md` lists every change; build green (`bun run build`, 26 routes), `tsc` clean, `eslint` 0 errors.
