# Re-Test Report — AniKuoshi v1.1.2

**Date:** 2026-09-17 · **Method:** headless Chromium (agent-browser) against local dev + production build · **All routes exercised, console + overflow monitored.**

## New fixes verified this round

| # | Fix | Test | Result |
|---|-----|------|--------|
| 1 | Top 10 shows 10 (was 9) | `/home` → counted cards, ranks, titles in `[aria-label='Top ten anime']` | **PASS** — 10 links, 10 rank numerals (1–10), 10 titles; slot 10 = "The Exiled Heavy Knight Knows How to Game the System" backfilled from `/api/top-rankings` |
| 2 | Prev/Next no longer fights auto-next | Seeked video to `duration − 1s` → countdown appeared (measured at 3) → clicked header **Prev** mid-countdown | **PASS** — overlay cancelled immediately, landed `ep=2`, and after 8s still `ep=2` (no orphaned second navigation; old bug skipped two episodes) |
| 3 | Auto-next still works on its own | Let the countdown expire untouched | **PASS** — fired exactly once (`ep3 → ep4` observed in an earlier run), no repeat navigation |
| 4 | Invisible delay after prev/next | Clicked player **Next** at ep2 t≈4.0s → measured new episode start | **PASS** — ep3 attached with its own duration (1420s) and started at 0:00 (t≈elapsed wall-time), no stale-position seek, no double-attach |
| 5 | Autoplay / Auto next / Auto skip toggles | Clicked chips, read `aria-checked`, reloaded | **PASS** — 3 chips render below the player; state flips, persists in `anikuoshi.prefs` and survives reload; mirrored to profile settings |
| 6 | One-button player switcher | Clicked the single switcher once per render | **PASS** — Senshi → Plyr → Vidk → Embed → Senshi; choice persisted to `anikuoshi.playerType`; no crashes during engine swaps |
| 7 | Colon-title keys (bug found while testing) | Clicked Top-10 #1 "Mushoku Tensei: Jobless Reincarnation Season 3" card → details → Watch | **PASS** — link is colon-free, details page renders (12 episodes), watch link carries canonical `anilist:178789`, video attaches. Previously: `400 Unknown key format` → "Couldn't load this title" |
| 8 | Direct /watch with colon title | Opened `/watch?key=Solo Leveling Season 2: Arise from the Shadow&ep=2` | **PASS** — resolver recovers `anilist:176496`, video attaches (was: "Stream unavailable") |
| 9 | Blank player on embed-only episodes | Code-path fix: `phase === "embed"` now triggers the embed auto-switch | **PASS** (unit-level — no embed-only episode available live; condition verified in both effects) |

## Regression sweep (existing behaviour)

| Route / flow | Result |
|---|---|
| `/home` desktop + 390px | PASS — 0px horizontal scroll, all rows render |
| `/browse` | PASS — 30 cards, no page error (Radix "Any"-option fix intact) |
| `/search?q=frieren` | PASS — results render |
| `/watch` 390px | PASS — 0px overflow, 0 elements past viewport edge, toggles + switcher visible (screenshots) |
| `/anime/:key` | PASS — details render for canonical, sanitized-title and legacy slug keys |
| `/download` | PASS — ZIP served, page renders |
| Player engines round-trip | PASS — position/volume/rate bridge intact; Senshi re-attach seeds restore point from bridge |
| Service worker | `VERSION` bumped to `anikuoshi-v1.1.2` — stale caches purged on next visit |

## Console errors

None observed during the sweep (no React warnings, no unhandled rejections on the tested flows).

## Evidence

- `docs/retest-v112-mushoku-watch.png` — colon-title watch page, video attached
- `docs/retest-v112-watch-toggles.png` — under-player strip with toggle chips + single switcher
- `docs/retest-v112-mobile-watch.png` — 390px watch page, full page visible

## Known environment notes (not app bugs)

- Headless Chromium blocks unmuted autoplay without a user gesture — video loads with poster and plays after the first tap. Real browsers with gesture history autoplay normally.
- Upstream API (Render free tier) cold starts can take ~30–60 s on the first stream request; the fallback chain covers transient 502/503/504 with retries.
