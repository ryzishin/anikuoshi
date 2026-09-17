# AniKuoshi v1.2.1 — Re-test Report

Date: 2026-09-17 · Built against **APIKuoshi v2.3.0** (`https://apikuoshi-v2.onrender.com`, health-verified at test time) · Browser-tested via headless Chromium (1366×900 + 390×844) on the dev server; production build green (`bun run build`, 26 routes).

## Requested fixes

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Landing Page BG Hero | **FIXED** — hero was rendering only the flat brand gradient because v2.3.0 collapsed `/api/home` to a single `{ data }` envelope; `homePage()` parsed `r.data?.data` → empty spotlights. New `unwrapPayload()` accepts both shapes; slideshow renders art-enriched banners/covers again (+ `cover` fallback). | `docs/retest-v121-landing-hero.png` (full-bleed art + slide dots) |
| 2 | Trending Page no content | **ROOT-CAUSED, then REMOVED per instruction** — same envelope bug blanked `home.trending`, but probing the live API showed `/api/trending` (12) is byte-for-byte the same title list as the first 12 of `/api/latest-updated` (40) — **12/12 overlap**. The row is a duplicate of "Recently updated", so it was removed from `/home` per the "remove if they keep having same data" rule. | live API diff; `docs/retest-v121-home-order.png` |
| 3 | Homepage order | **DONE** — Continue watching (signed in) → **Top 10 → Spotlight → Recently updated → Popular with everyone → Top airing → Coming soon** (DOM-verified heading order). New **Spotlight** row (star icon) surfaces the v2.3.0 spotlights; page subtitle updated. | `docs/retest-v121-home-order.png` |
| 4 | Profile settings → Settings | **DONE** — Preferences panel (title language, default server, auto-play next, autoplay, auto-skip, ambient mode, reduced motion) moved to `/settings` as the "Playback & preferences" card. `/profile` = identity + My list + Continue watching + a compact "Settings →" link card. | `docs/retest-v121-settings.png` |

## Additional bugs found & fixed during re-test

| Bug | Root cause | Fix |
|-----|-----------|-----|
| **Signed-in preference sync silently dead** | SQLite `preferences` column is `String` — Prisma returns the JSON blob as a string; `mergePreferences()` spread the string's *characters* over the defaults, so every read (`/api/auth/me`, PATCH responses, sign-in merge) returned pure defaults while writes stored correctly. Toggles never survived a reload for signed-in users. | `mergePreferences()` parses strings before merging. Verified end-to-end: UI toggle → DB row changes → `/api/auth/me` reflects it → reload restores server state. |
| **"★ NaN" score badges on Spotlight cards** | v2.3.0 spotlight rows put age ratings ("PG-13", "R") in `rating`; `Number("PG-13").toFixed(1)` → NaN badge. | Badge renders only finite, positive numeric ratings. Numeric rows (Recently updated ★6.0 etc.) unaffected. |
| **Top 10 per-period data degraded** | `/api/top-ten` received the same envelope change — Today/Week/Month parsed empty, tabs silently fell back to the `/api/top-rankings` backfill (identical lists per tab). | Shared `unwrapPayload` parser restores real per-period data; rankings backfill remains as safety net. |

## Verification log (browser, dev server)

- **Landing** `/`: hero slideshow = 5 art-enriched slides, dots switch slides, no overflow at 1366×900 and 390×844.
- **Home** `/home` (signed in, test account): heading order DOM-verified; row counts Top 10 = 10 · Spotlight = 9 · Recently updated = 40 · Popular = 30 · Top airing = 9 · Coming soon = 12; no "★ NaN" anywhere; numeric score badges still render on other rows.
- **Spotlight card → details**: `/anime/Mushoku%20Tensei%20Jobless%20Reincarnation%20Season%203` resolves (TV · 14 episodes · 12 ep cards) — no "Couldn't load this title".
- **Settings** `/settings`: Default player + Playback & preferences (selects + 5 switches) + Appearance all render; signed-in toggle round-trip verified through UI → server (`/api/auth/me`) → reload; guest mode verified with localStorage persistence across reload.
- **Profile** `/profile` (signed out and in): identity, display name, password cards, My list, Continue watching, Settings link card.
- **Regression sweep**: `/browse` (30 cards, no error), `/search?q=frieren` (3 results), `/history` (guest empty state), `/download` (v1.2.1 ZIP link serves 19.7 MB), `/watch?key=anilist:21&ep=2` correctly showed the graceful "Stream unavailable + Retry" card while the API answered 502 (upstream metadata flake, verified via direct API call — designed behavior, not a regression), then `/watch?key=Tomb Raider King&ep=1` attached video (readyState 4, duration 23:39) with servers panel and strip intact.
- **Build**: `bunx tsc --noEmit` clean (pre-existing `examples/aos` notes only); `bun run lint` 0 errors (7 pre-existing warnings); `bun run build` green (26 routes).
- **Console**: no new errors (Next dev hydration notices on signed-out profile page are pre-existing).

## Evidence screenshots

- `docs/retest-v121-landing-hero.png` — landing BG hero slideshow restored (1366×900)
- `docs/retest-v121-home-order.png` — home feed new order, signed in (1366×900)
- `docs/retest-v121-settings.png` — consolidated settings page (1366×900)
- `docs/retest-v121-mobile-home.png` — home feed at 390×844, no overflow
