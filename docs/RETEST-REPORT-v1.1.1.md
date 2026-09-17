# AniKuoshi v1.1.1 — Re-Test Report (follow-up fixes)

**Date:** 2026-09-17 · **Scope:** the three reported minor fixes (Top 10 on home, watch-page mobile responsiveness, card-click inconsistency) plus every bug found during a self-run browser sweep. Verified in a real browser (Chromium via agent-browser) against the dev server and the live API `https://apikuoshi-etau.onrender.com`, at desktop (1366×900) and mobile (390×844) viewports. Evidence screenshots in `docs/`.

## 1. Top 10 section (home) — FIXED ✅

| Check | Before | After |
|---|---|---|
| Titles | Every poster rendered a blank label (`/api/top-ten` returns `name`, component read `item.title` → undefined) | Titles render for all 9 items per period — `fix-topten-desktop.png`, `fix-topten-mobile.png` |
| Links | Slug-based (`/anime/one-piece-odmau`) — the only cards in the app still navigating by slug | Title-based via `itemKey()` (`/anime/One%20Piece`), verified by clicking through |
| Click → details | "Couldn't load this title" for items like `one-piece-odmau` | Correct anime loads (ONE PIECE, `anilist:21` — exact-title match scoring) |
| Tabs | Today/Week/Month all carried the same broken shape | All three periods normalized (verified data from live API: 9/9/9 items) |

## 2. Watch page on phones (390×844) — FIXED ✅

| Check | Before | After |
|---|---|---|
| Page width | Grid had no mobile template → implicit `auto` track sized to the player's intrinsic width: main column measured **656px** on a **390px** viewport; overflow-x clipped = "can't see the full page" | `grid-cols-1` (minmax(0,1fr)) constrains the track: main column **366px**, `scrollWidth == clientWidth` |
| Clipped content | Player, engine switcher, "refresh token → next…" hint, schedule rows and footer all cut at the right edge | Nothing clipped: **0 elements** extend past the viewport outside intentional horizontal carousels (`fix-watch-mobile-final.png`) |
| Sweep | — | `/`, `/home`, `/browse`, `/search`, `/anime/:key`, `/profile`, `/download` all `overflow: false` at 390px |
| Desktop | — | Unchanged: sidebar `330px` column renders normally (`fix-watch-desktop.png`) |

## 3. Card-click consistency ("No anime found" in some routes) — FIXED ✅

Root causes found and fixed (all reproduced first):
1. **Transient API failures** — live API intermittently returns 502/503 (Render) — network trace captured `meta?key=anilist:19123 → 502` between 200s. Single-shot calls turned that into a permanent error card. `apiFetch()` now retries 502/503/504/429 + network drops twice with backoff.
2. **Slug links from non-browse routes** — Top 10, schedule fragment and search typeahead all emitted slug keys while browse emitted titles (why it "worked in browse"). All now emit title-first keys (`navKey` computed route-side in the schedule API; `itemKey()` in Top 10; `s.title || s.slug` in typeahead).
3. **Weak resolver** — `one-piece-odmau` used to adopt the first fuzzy hit ("One Piece: Episode of Merry") or fail entirely when the API returned key-less catalog rows. `resolveAnimeKey()` now walks a query ladder and prefers exact/startsWith title matches.
4. **Recovery** — the details error card now offers "Search <key>" (pre-filled) + "Browse catalog" + Retry.

Verified paths (all load the correct anime, zero "No anime found"):
- Browse card → details (Red River → `anilist:207809`) → Watch episode 1 → player attaches (`readyState 4`)
- Top 10 card (One Piece) → `/anime/One%20Piece` ✅
- Legacy slug `/anime/one-piece-odmau` → resolves to ONE PIECE ✅
- Typeahead suggestion "Sousou no Frieren - Marumaru no Mahou (Mini Anime)" → resolves to `anilist:170068` ✅ (`bug-no-anime-found.png` = the repro, now fixed)
- Schedule sidebar item "Clevatess Season 2" → details ✅ (fragment now emits title links, verified via curl)

## 4. Bugs found during the self-run sweep — reported & fixed ✅

| # | Bug | Root cause | Fix |
|---|---|---|---|
| 1 | Switching engines back to **Senshi left a dead player** (no source, duration NaN) | HLS attach effect didn't depend on `playerType`; the remounted `<video>` never re-attached | `playerType` added to the effect deps; round-trip Senshi→Plyr→Senshi verified (`readyState 4`, duration 1370s) |
| 2 | Position could drift on engine switch | — | Verified exact carry-over: 4.0s (Senshi) → 4.0s (Plyr) |
| 3 | **Service worker could pin stale assets** after deploys (cache-first on all `.css`/`.js` — observed serving old chunks during testing) | `cacheFirst` for every static file incl. unhashed ones | Unhashed files → stale-while-revalidate; hashed `/_next/static/` + icons/vendor stay cache-first |
| 4 | SW cached **stream responses** (`/api/watch`, `/api/chain`, servers, proxy) — expired CDN tokens served after network loss = guaranteed 403s | Upstream-API network-first cache had no token-endpoint exception | Token endpoints are network-only now (aligned with the fresh-token-per-switch rule) |
| 5 | SW `VERSION` never bumped → old caches never purged for existing users | Static `anikuoshi-v1` | Bumped to `anikuoshi-v1.1.1`; `sw.js` itself never intercepted; SW registration skipped in dev |
| 6 | React rule violation in `vidk-player.tsx` (ref written during render) — the only ESLint **error** | — | Moved into an effect; `bun run lint` now reports **0 errors** |
| 7 | Next.js console warning: smooth-scroll on `<html>` | Missing attribute | `data-scroll-behavior="smooth"` added to layout |
| 8 | Type error from the search-page key change (`encodeURIComponent(undefined)`) | — | `s.title || s.slug || ""` |

Known pre-existing (unchanged, not regressions): Radix `aria-describedby` dialog warning; Vidstack `NotAllowedError` autoplay log in headless tests; `tsc` notes for `examples/` (socket.io demo deps) and `aos.css` module — all excluded from builds (`ignoreBuildErrors` per v1.0 config).

## 5. Regression sweep — PASS ✅

- All routes 200 with correct titles: `/`, `/home`, `/browse`, `/search?q=frieren`, `/anime/One%20Piece`, `/watch?key=anilist:21&ep=1`, `/profile`, `/login`, `/register`, `/download`, `/offline`.
- No horizontal overflow on any page at 390px.
- Player: all four engines switchable (Senshi/Plyr/Vidk/Embed verified in DOM), servers panel groups sub/dub chips, skip-intro appears in intro window, fallback-chain hint text intact.
- Watch page section order unchanged (Player → Servers → Episodes → Seasons & Specials → Recommendations).
- `/api/fragments/schedule` renders title-based links; suggestions fragment unchanged (already fixed in v1.1.0).
- Packaging: `anikuoshi-v1.1.1-source.zip` (223 files) served at `/download/anikuoshi-v1.1.1-source.zip` and linked from the `/download` page (Download ZIP button).
- Lint: **0 errors** (5 pre-existing warnings). TypeScript: no new errors.

Evidence screenshots: `fix-topten-desktop.png`, `fix-topten-mobile.png`, `fix-watch-mobile-1.png`, `fix-watch-mobile-final.png`, `fix-watch-desktop.png`, `fix-details-clevatess.png`; repro shots `bug-topten-1.png`, `bug-watch-mobile-1.png`, `bug-top10-click.png`, `bug-no-anime-found.png`.
