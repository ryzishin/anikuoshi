# AniKuoshi v1.2.0 — Re-test Report

**Date:** 2026-09-17 · **Scope:** every item in the v1.2.0 task spec (player UX overhaul, watch sync, browse fixes, perf pass), verified in a real browser (Chromium via agent-browser) against the dev server and the live **APIKuoshi v2.3.0** (`https://apikuoshi-v2.onrender.com`). Viewports: desktop 1366×900, mobile 390×844. Evidence screenshots in `docs/retest-v12-*.png`.

Build status: `bun run build` green (26 routes), `tsc --noEmit` clean (pre-existing `examples/` + `aos` type notes only), `eslint src` 0 errors.

## §1 — Player playback fixes

| Item | Result | Evidence |
|---|---|---|
| "Skip intro" prompt removed | ✅ No skip-intro/outro button renders at any playback position; `skipIntro` data still powers the Auto-skip toggle | `retest-v12-watch-desktop.png` |
| "Play next" countdown removed | ✅ No countdown overlay state, effect, UI or timer remains (`countdown-shown=false` at every checked position); no code path arms it | browser eval on /watch |

## §2 — Player order & default player

| Item | Result |
|---|---|
| Order Plyr → Vidk → Senshi → Embed | ✅ `PLAYER_TYPES` reordered; switcher cycles in that order (verified click cycle: Senshi → Embed wraps correctly, Plyr → Vidk on load) |
| Default player preference in Settings | ✅ `/settings` card lists the four engines in the new order; picking **Plyr** persisted to `anikuoshi.prefs.defaultPlayer` and the next watch-page load opened with **engine=Plyr** |
| No UI/UX regression on switch | ✅ Vidk(27s) → Senshi resumed at ~27s and continued (54s, 58s readings); cross-engine bridge + fallback chain untouched; fallback auto-switch to embed still fires |

## §3 — Toggles

| Item | Result |
|---|---|
| Auto-play | ✅ gates `play()` on attach — playback auto-started after the episode switch caused by auto-next |
| Auto-next at true end only | ✅ seeking to 1.2 s before the end and letting `ended` fire navigated ep 2 → ep 3 **immediately with no countdown**; never fires on entry |
| Auto-skip | ✅ toggle wired to `skipIntro` windows (once-per-window guard, all direct engines; embeds excluded by design) |
| Persist to profile | ✅ all three live in the preferences store: localStorage (guest) + PATCH `/api/user/preferences` (signed-in); Settings/profile/strip stay in sync |

## §4 — Episode data

| Item | Result |
|---|---|
| Per-episode thumbnails | ✅ episode grid renders `thumbnail` per episode (AniList CDN art observed); series poster only as fallback |
| Aired date year fix | ✅ grid shows full dates ("Jan 16, 2026", "Sep 29, 2023" format) — the old `slice(0,10)` truncation is gone |

## §5 — "Couldn't load this title"

Reproduced, root-caused and fixed. **Root cause:** API v2.3.0 `/api/meta` can return a canonical entry whose `key` is a title-derived pseudo-slug (`"Cowboy Bebop"` → `cowboy-bebop`) that the API itself 404s on later (no listing/metadata for that slug); only real listing slugs (`…-kb7hu`) or canonical ids resolve.

Fix: `resolveAnimeKey()` verifies non-canonical meta keys (falls through to the search ladder on 404), and slug keys now try `meta` first (one call, upgrades to `anilist:`/`mal:` when available).

| Title (type · era · language) | Result |
|---|---|
| Sousou no Frieren 2nd Season (TV · 2023 · romaji) | ✅ details + 12 episodes + playback |
| Cowboy Bebop (TV · 1998 · english) | ✅ was the failing case — now resolves (28 watch links) |
| Kimi no Na wa. / Your Name (Movie · 2016) | ✅ resolves with year badge |
| `anilist:1` (canonical id) | ✅ direct |
| `frieren-odmau` (legacy kaze slug) | ✅ resolves (slow when the API cold-404s the slug — skeleton shown, no error card) |
| Colon-titles ("Frieren: …", "Re:ZERO") | ✅ via quick search + details (regression) |

## §6 — Layout & navigation

| Item | Result |
|---|---|
| Bottom nav removed | ✅ component deleted; `data-testid=bottom-nav` absent on every route; main no longer reserves the strip |
| Header nav visible on /watch | ✅ `headerVisible=true` on the watch page (desktop + 390px) |
| Back chevron on watch page | ✅ `data-testid=watch-back`; history-aware with `/home` fallback (verified return) |
| Appearance moved into Settings | ✅ `/settings` hosts Appearance + default player; sidebar inline section removed; profile links to Settings |
| Sidebar double-close | ✅ still a single Sheet-primitive close (+ outside-click/Esc/route dismissal); 0 custom close buttons in the sidebar |

## §7 — Quick search, History, progress sync

| Item | Result |
|---|---|
| Header quick search | ✅ debounced, poster previews render (3/3 rows with posters), works signed-out, arrow-key highlight (`aria-selected`) + Enter commit (opened the highlighted row) + Esc/outside-click close; visible on mobile |
| History nav page | ✅ `/history` in sidebar; guest mode falls back to localStorage progress; signed-in reads `/api/user/progress`; progress bars render ("EP 1 · 1m 46s of 23m 59s", 7% bar); per-entry remove |
| Exact episode + timestamp resume | ✅ real playback flow: video played → progress record written every 15 s + flush; watch page re-entry resumed from the saved position; consistent key/episode across watch page, History and home Continue-Watching |
| Flush on hide/unload | ✅ `visibilitychange` + **`pagehide`** + unmount flushes |

## §8 — Watch page strip

| Item | Result |
|---|---|
| Prev/Next below the player | ✅ `strip-prev`/`strip-next` beside the toggles; Next navigated ep 2 → ep 3 with canonical-key URL |
| Marquee for long titles | ✅ strip title shows "Sousou no Frieren 2nd Season — EP n · <episode title>"; CSS marquee (reduced-motion aware) scrolls on overflow; ResizeObserver measures |
| Smaller toggles | ✅ compact chips (28px) on desktop; wrap to their own line on 390px (togglesRight 265 < 390) |
| Add to List removed | ✅ button + per-page list fetch removed from watch (details page owns it) |
| Show Servers + panel Hide | ✅ strip button toggles "Show Servers"/"Hide servers"; panel's upper-right **Hide** link closes it |

## §9 — Browse

| Item | Result |
|---|---|
| Types "All" chip | ✅ shows the full catalog (20 cards page 1) — was an empty page before |
| Genres "All" chip | ✅ full catalog |
| Multi-genre select | ✅ action + comedy toggled → URL `?tab=genre&genre=action,comedy`, note "Filtering by 2 genres: action, comedy", 30 results from the API's multi-genre path |

## §10 — Performance

| Item | Result |
|---|---|
| Client cache | ✅ 120 s TTL + in-flight dedup on browse/catalog + /api/home (playback endpoints never cached) |
| Preload | ✅ `preconnect` + `dns-prefetch` to the API base in the root layout |
| Long-list optimization | ✅ episode grid renders in 60-item chunks via IntersectionObserver sentinel; active episode always in window |
| Re-render reduction | ✅ `AnimeCard` memoized |
| Misc | ✅ /home `lg:grid-cols-[minmax(0,1fr)_320px]` template repaired (v1.1.2 typo collapsed the desktop two-column layout); skeletons + lazy-loading kept; SW bumped to `anikuoshi-v1.2.0` with the new API host allowlist |
| No horizontal scroll | ✅ 0px overflow at 390px on /home /browse /search /history /settings /profile /watch |

## Bugs found during re-test (and fixed)

1. **"Loading…" title leaked into watch-progress / History** — when the heavy `/api/chain` call failed, the watch page kept "Loading…" as the title and the player's progress records stored it. Fixed with an `/api/meta` fallback for the identity block (verified: record now stores "Sousou no Frieren 2nd Season" + poster).
2. **Plyr engine reported time through a stale callback** — Plyr's listeners were bound once per `src` to the mount-time `onTime`, so after the title resolved the progress records kept the stale title/poster. Fixed with the v1.1.1-style `cbRef` pattern (same one Vidk already used).
3. **/home desktop grid template broken** — `lg:grid-cols-inmax(0,1fr)_320px]` (missing `[`) silently collapsed the two-column layout. Repaired.
4. **Strip toggles overflowed 390px** — the first strip row now wraps (toggles drop to a second line) — verified 0 overflow.

## Console

No page errors on any tested route (dev-mode Fast-Refresh notices only, absent in production builds).

## Verdict

All ten task sections implemented and verified; four additional bugs found during testing were fixed in place. Version bumped to **1.2.0** (package.json, CHANGELOG, SW, download page).
