# AniKuoshi — Anime Streaming PWA

**Discover and stream anime — a Top 10 hero carousel, tabbed discovery feeds, sub & dub servers with automatic failover, and two focused player engines (Vidk · Embed). Installable, offline-capable, keyboard-friendly, mobile-first.**

AniKuoshi is a full streaming front-end built on the [APIKuoshi](https://github.com/ryzishin/apikuoshi) REST API (live base: `https://apikuoshi-v2.onrender.com`, v2.4.0). It is a Next.js 16 App Router project with shadcn/ui, a dual database driver (MongoDB Atlas **or** Prisma/SQLite), a hardened HLS/embed player engine, and a complete PWA layer.

---

## What's new in v1.3.0 (UI/UX fixes, watch page simplification, settings overhaul & perf)

- **Watch page simplified** — Senshi and Plyr are **removed**; **Vidk** (Vidstack HLS with captions) and **Embed** remain. The embed **`sandbox` attribute is removed**, the Vidk poster is **letterboxed (never stretched)** and fed by the v2.4.0 episode-thumbnail chain, subtitles render/select correctly with a deterministic default, and the server panel is **always visible** (Show/Hide toggle + note removed). Switching servers/episodes preserves time/volume/rate/subs and **toggling auto-play/auto-next/auto-skip never rewinds** — every switch still re-calls `/api/watch` for fresh CDN tokens.
- **New stream loader** — a moving/wiggling ellipsis replaces the circular spinner in the playback path; clean **"Not aired yet"** and **"No stream available"** states replace confusing player errors.
- **Home restructured** — **Top 10 first as a looping hero carousel** (Today/Week/Month), then **Spotlight / Trending / Recently updated / Popular / Top airing / Upcoming as tabs** with a **`‹ n ›` pagination control**, rendered as a **grid**.
- **Browse keyword waits for Apply** — no live suggestions/auto-fetch; multi-select genres and the All chips stay.
- **Details page rebuilt** — full v2.4.0 data (synopsis, season, score, rating, synonyms, art set…), combined fetch with skeletons, the **episode grid removed** in favor of validated **Seasons / Prequel / Sequel / Specials / Related** (from `/api/meta` relations + `/api/seasons` + `/api/watch-order`), watchlist upgraded to a **status dropdown** (Planning/Watching/Completed/On Hold/Dropped), **"Watch"** CTA for single-episode Movies, and a **"Not aired yet"** state. The redundant **"Open Player"** button is gone.
- **Routing & text integrity** — card hrefs always use `/anime/:slug|:key` (never titles); **HTML entities are decoded at the API layer** so `&` never renders as `;amp`; the title-language setting is honored on **every** surface; the logo links to `/home`.
- **Settings overhauled** — **"Default Server" → "Default Provider"** (riyo/kaito/hana/sora/akira/yuki/miso/kenji/arashi/taiki, auto fallback when unavailable), title language **split into Anime Titles and Characters** (Western vs family-name-first order), and a new **Default Language** (Sub/Dub/System) that drives stream selection. Legacy `defaultServer` migrates automatically. Every setting is functional and synced.
- **Keyboard shortcuts audited** — Space/K, arrows, J/L, M, F, N/P, 0–9, "/", "?" all fire and no longer conflict with focused buttons or player controls; the removed server-panel binding is gone from the help modal.
- **Bigger header search** — 44 px tall, wider focus width, poster-preview suggestions intact.
- **Sync & profile** — the pagehide flush no longer writes to a stale episode (exact episode + timestamp persist); details page shows **"Continue EP n"**; **avatar upload accepts any image file** with encoder fallback.
- **Restrained product design** — gradient buttons/blobs/glows replaced with the solid accent system; the AI-generated look is gone.
- **Faster** — hls.js and Plyr no longer ship to the client, Vidk mounts lazily, critical routes idle-prefetch, catalog TTL caching kept.

## What's new in v1.2.1 (home feed, settings consolidation & sync fix)

- **Landing page BG hero restored** — APIKuoshi v2.3.0 collapsed the `/api/home` envelope to a single `{ data }` layer, which left the hero on its flat gradient fallback; the parser now accepts both shapes and the art-enriched spotlight slideshow (banners/covers) is back, with a `cover` fallback per slide.
- **Home feed reordered**: **Top 10 → Spotlight → Recently updated → Popular → Top airing → Coming soon**. The **"Trending now" row was removed** — verified live that the API serves `/api/trending` (and `home.trending`) with exactly the titles that lead `/api/latest-updated` (12/12 overlap), i.e. a duplicate of "Recently updated". A new **Spotlight** row takes its place.
- **Top 10 per-period data fixed** — `/api/top-ten` had the same envelope change, so Today/Week/Month tabs were silently falling back to the rankings backfill; the real per-period lists render again.
- **All user settings now live in `/settings`** — the Preferences panel (title language, default server, auto-play/auto-skip/ambient toggles) moved from the profile page into a "Playback & preferences" card next to Default player and Appearance. `/profile` stays identity + lists, with a link card to Settings.
- **Signed-in preference sync repaired** — the SQLite `preferences` column returns a JSON *string*, which `mergePreferences()` spread character-by-character over the defaults, so every server read returned defaults while writes stored correctly (sync silently never survived a reload). Strings are now parsed before merging; verified toggle → server → reload round-trip.
- Card score badges no longer render "★ NaN" when a row carries age ratings ("PG-13") instead of numeric scores.

## What's new in v1.2.0 (player UX overhaul, watch sync, browse fixes & perf)

- **Skip-intro prompt and play-next countdown removed** — auto-skip (toggle) seeks past intro/outro via the API's `skipIntro` data; auto-next fires only at true end-of-playback. No more countdown UI to fight the prev/next buttons.
- **Player order Plyr → Vidk → Senshi → Embed**, plus a **Default player** preference in the new **Settings** page (which engine loads first, synced to your profile).
- **Auto play / Auto next / Auto skip** toggles locked to their real semantics and persisted to the user profile.
- **Per-episode thumbnails** (v2.3.0 enrichment chain: upstream → Kitsu → TMDB → poster) in the watch-page episode grid, and **full aired dates** — the year no longer truncates.
- **"Couldn't load this title" hardening** against the v2.3.0 contract: canonical `anilist:`/`mal:` keys used directly from catalog rows; API base moved to `apikuoshi-v2.onrender.com`.
- **Navigation rebuilt**: mobile bottom nav removed; header (with quick search + poster suggestions) visible everywhere including /watch; new watch-page **back chevron**; **Appearance moved into Settings**; sidebar double-close stays removed.
- **New History page** (`/history`) — continue-watching with progress bars for signed-in users and guests, remembering the **exact episode + timestamp**; the watch page resumes from it, flushing on `pagehide` too.
- **Watch page strip**: prev/next below the player with a **marquee** for long titles, smaller toggles, "Show Servers" + panel Hide link; "Add to List" removed (details page owns it).
- **Browse fixed**: Types and Genres "All" chips show the full catalog, and **genres are multi-select** (`genre=action,comedy`).
- **Performance pass**: client-side TTL cache for catalog GETs, API preconnect, progressive episode rendering for 1000+-episode lists, memoized cards, repaired /home grid template, SW version bump.

## What's new in v1.1.0 (repair pass)

- **Fixed** the broken critical paths — browse cards, search suggestions and `/anime/:slug` linked Kaze slugs the API cannot resolve; all keys now resolve canonically (`anilist:`/`mal:`/title) with a search-based fallback for legacy URLs.
- **Added** switchable player engines below the player: Senshi (default) · Plyr · Vidk (Vidstack) · Iframe embed, with the fallback chain extended to end in the embed before the error card.
- **Reordered** the watch page: Player → Servers → Episodes (thumbnail + name) → Seasons & Specials → Recommendations.
- **Regenerated** the brand: kanji 「推」 (oshi) mark, new PWA icons (any + maskable), logo lockups, favicon.ico/.svg.
- **Removed** the sidebar's duplicate close button; **added** a mobile bottom nav + 44px touch targets + safe-area hardening.
- Full details in [CHANGELOG.md](CHANGELOG.md).

## Quick start (local)

```bash
# 1. unzip / clone, then:
npm install            # or: bun install

# 2. configure environment
cp .env.example .env.local
#   • local-only? leave MONGODB_URI unset → SQLite fallback works out of the box
#   • using Atlas? set MONGODB_URI + MONGODB_DB
#   • set AUTH_SECRET (openssl rand -base64 32)

# 3. (SQLite path only) push the Prisma schema
npm run db:push

# 4. run
npm run dev            # http://localhost:3000
```

First run checklist: open `/` → hit **Start watching** → play anything on `/home` → press `?` for shortcuts.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Start the production server |
| `npm run lint` | ESLint |
| `npm run db:push` | Push Prisma schema (SQLite fallback) |

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | production | MongoDB Atlas SRV connection string; when set, users/progress/lists persist to Mongo |
| `MONGODB_DB` | no | Mongo database name (default `anikuoshi`) |
| `DATABASE_URL` | dev only | SQLite file URL for the Prisma fallback (e.g. `file:./db/anikuoshi.db`) |
| `AUTH_SECRET` | production | HS256 signing secret for session JWTs |
| `NEXT_PUBLIC_API_BASE` | no | APIKuoshi base URL (defaults to the public deployment) |
| `NEXT_PUBLIC_SITE_URL` | no | Absolute site URL for metadata |

**No reset flow:** there is deliberately no forgot-password endpoint. Password changes require the current password (profile → Change password).

## Feature map

- **Pages** — `/` landing · `/home` feed · `/anime/[key]` details · `/watch` player · `/browse` filters · `/search` typeahead · `/login` `/register` · `/profile` settings · `/offline` PWA shell · `/download` source bundle
- **Player engines** — Vidk (Vidstack HLS with captions — default) and Embed (no sandbox) — switchable below the player with position/volume/rate/subtitles preserved; fallback chain `refresh token → retry → next server → embed → empty/error card`; deterministic subtitle defaults, auto-skip via `skipIntro`, auto-next at true end, fullscreen, full keyboard control
- **Key resolution** — every list/suggestion/legacy-slug key canonicalizes through `resolveAnimeKey()` (`src/lib/api.ts`) before hitting meta/episodes/watch endpoints
- **Token freshness** — every server switch and every failure path re-calls `/api/watch` for fresh CDN tokens; playback always rides the API's `proxiedUrl` (re-tokenized per hop upstream)
- **Auth & data** — register (unique username + email), login (email **or** username), JWT httpOnly cookie sessions, avatar upload (any image file, client-side resized to a 256px WebP/JPEG/PNG data URL with encoder fallback), display-name change, password change (old+new+confirm), watch progress sync (15s throttle + flush on hide/unload), anime lists with statuses (Planning/Watching/Completed/On Hold/Dropped), preference sync
- **PWA** — web manifest, custom service worker (precached shell, cache-first statics, network-first API with offline fallback), install prompt button, `/offline` fallback
- **Theme engine** — 4 dark variants (Kuoshi / Midnight / Dim / Contrast) × 8 accent palettes, applied via CSS custom properties, persisted locally + synced to the profile; reduced-motion mode
- **Fragments** — EJS server-rendered partials (suggestions + schedule) swapped htmx-style
- **AOS** — scroll entrance animations, disabled under reduced motion

## Project structure

```
src/
  app/                    # App Router pages + API route handlers
    download/             #   platform preview + source ZIP page
    api/auth/…            #   register / login / logout / me
    api/user/…            #   profile / password / preferences / progress / list
    api/fragments/…       #   EJS + htmx HTML fragments (suggestions, schedule)
    anime/[key]/          #   details page
    watch/                #   player page
    …                     #   home, browse, search, login, register, profile, …
  components/
    player/               #   vidk/embed engines, server panel, stream loader, ellipsis loader
    anime/                #   cards, posters, skeletons
    home/                 #   top-ten carousel, feed tabs, continue row
    layout/               #   navbar + sidebar, bottom nav, footer, logo/loader
    theme-engine.tsx      #   dark variants + accent palettes
    auth-provider.tsx     #   client auth context
    preferences-provider.tsx
  lib/
    api.ts                # typed APIKuoshi client (all endpoints)
    auth.ts               # JWT sessions, bcrypt, validation
    store/                # dual driver: mongo.ts / sqlite.ts / types.ts
    fragments/            # EJS templates
public/                   # sw.js, manifest, icons, vendored htmx
prisma/                   # schema for the SQLite fallback
docs/                     # OVERVIEW.md, DEPLOY.md
```

## API coverage (APIKuoshi v2.4.0)

Search, suggestions, resolve, anime info, episodes (per-episode thumbnails via the enrichment chain), servers, watch (streams+subtitles+skipIntro), chain, meta (+ relations block), characters, recommendations, home, spotlight, trending, top-ten, top-rankings, popular, upcoming, completed, new-release, newly-added, latest-updated, recently-updated, schedule, airing, az-list, filter, genre, type, seasons, watch-order — plus the built-in `proxy/hls`, `proxy/video` and `proxy/subtitle` restreamers used for playback.

## Disclaimer

Educational/personal-use project. AniKuoshi hosts no content — it is an interface over the public APIKuoshi API. Availability depends entirely on third-party sources.
