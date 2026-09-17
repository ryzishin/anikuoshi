# AniKuoshi — Architecture Overview

## What it is

AniKuoshi is a mobile-first anime streaming PWA. It talks to the **APIKuoshi** REST API (v2.1) for everything content-related — search, catalog, metadata, episode lists, servers and streams — and owns everything user-related — accounts, progress, lists and preferences — in its own database.

```
┌─────────────────────────── Browser ───────────────────────────┐
│  Next.js 16 App Router (React 19, Tailwind 4, shadcn/ui)      │
│  ├── Pages: / /home /anime/[key] /watch /browse /search …     │
│  ├── Player engine (hls.js + embed iframe + fallback chain)   │
│  ├── PWA: manifest + service worker + offline shell           │
│  └── Theme engine: 4 dark variants × 8 accents (CSS vars)     │
└─────────┬──────────────────────────────┬──────────────────────┘
          │ REST (CORS, direct)          │ /api/auth/* /api/user/*
          ▼                              ▼
┌─────────────────────────┐    ┌───────────────────────────┐
│  APIKuoshi API (v2.1)   │    │  Next.js Route Handlers   │
│  apikuoshi-v2           │    │  JWT (jose) + bcryptjs    │
│  .onrender.com          │    │  Store layer (dual):      │
│  search/browse/meta/    │    │   • MongoDB Atlas (prod)  │
│  watch/chain + proxies  │    │   • Prisma/SQLite (dev)   │
└─────────────────────────┘    └───────────────────────────┘
```

## Layers

### 1. Typed API client — `src/lib/api.ts`
One module wraps every used endpoint with strict types, timeouts, abort support and error normalization:
- list shape `{ success, kind, count, results }`, object shape `{ data }`, watch shape `{ stream, streams }` and chain shape `{ anime, servers, streams, best, verdict }` are all mapped to app-level types.
- `proxiedUrl` values are relative paths on the API origin — `absoluteUrl()` makes them absolute so playback and subtitle proxies work from any deploy target.
- Helpers: `cleanSlug` (strips `/ep-N` tails from catalog slugs), `itemKey` (stable navigation key), `displayTitle` (Romaji/English preference with fallbacks).

### 2. Player engine — `src/components/player/`
- **`use-stream-loader.ts`** — the state machine. Fetches `/api/watch?type=all` (fresh tokens each call), orders streams (direct first, preferred audio type first), and owns the failure ladder: silent refresh (re-call API) → next stream → embed → exhausted. All transitions raise non-blocking toasts.
- **`player-engine.tsx`** — attaches hls.js (or native HLS) to `proxiedUrl`, manages the custom control bar, subtitles (API VTTs via the API's subtitle proxy), quality picker (variant playlists via the HLS proxy), speed, PiP, fullscreen, skip intro/outro, auto-next countdown, stall watchdog and progress sync. Every switch preserves time, volume, rate and subtitle language.
- **`embed-player.tsx`** — sandboxed iframe fallback with `referrerpolicy="origin"`, slow-load hint, postMessage hooks.
- **`server-panel.tsx`** — sub/dub grouped server buttons with codenames (`riyo`, `kaito (beta)`, `hana`…) and original upstream labels.

Why direct browser→API calls? APIKuoshi echoes any CORS origin **and** its HLS/video/subtitle proxies re-tokenize token-gated CDNs on every hop. Keeping playback on the API host means zero serverless streaming cost, no Vercel bandwidth penalty and always-fresh 90s CDN tokens.

### 3. Store layer — `src/lib/store/`
One interface (`UserStore`), two drivers:
- **`mongo.ts`** — native `mongodb` driver, indexes on username/email/progress/list, activated by `MONGODB_URI`.
- **`sqlite.ts`** — Prisma models (User, WatchProgress, UserListEntry) for zero-config local runs.
The driver is chosen lazily at first use, so the same codebase runs on the sandbox preview (SQLite) and on Vercel + Atlas (Mongo) with only env changes.

### 4. Auth — `src/lib/auth.ts`
- Register: unique username (3–24 chars, restricted alphabet) + unique email + bcrypt hash (cost 10).
- Login: email or username (case-insensitive on both drivers).
- Session: HS256 JWT (jose) in an httpOnly, SameSite=Lax, Secure-in-prod cookie; 30-day TTL; issuer-checked.
- Password change: requires current password; no recovery flow exists anywhere in the product by design.

### 5. Fragments — EJS + htmx
Where server-rendered partials genuinely help (quick-search suggestions, today's schedule), route handlers render EJS templates (`src/lib/fragments/*.ejs`) to HTML and clients swap them in htmx-style. Suggestions responses carry a 30s TTL cache that never caches empty results (upstream cold-start protection). The vendored `htmx.min.js` is globally available; swapped content is processed through `window.htmx.process()`.

### 6. PWA — `public/sw.js` + `manifest.webmanifest`
- Precached shell: `/`, `/offline`, manifest, icons, htmx.
- Cache-first for `/_next/static`, icons, fonts, images.
- Network-first with cache fallback for upstream API GETs (search still works offline-when-cached).
- Navigations: network-first, `/offline` fallback.
- User APIs (`/api/auth/*`, `/api/user/*`): never cached.
- Versioned cache names with cleanup on activate.

### 7. Theme engine — `src/components/theme-engine.tsx` + `globals.css`
Dark-first design (Vercel/Apple/Stripe-calibrated neutrals) implemented with OKLCH CSS custom properties. Four dark variants map to `<html class="theme-*">`; eight accent palettes map to `<html data-accent="…">` overriding `--primary/--ring/--brand/--brand-2`; reduced-motion toggles `data-reduced-motion`. Persisted in localStorage, mirrored to the user profile on sign-in, applied pre-paint where possible.

## Data flow examples

**Play an episode:** `/watch?key=…&ep=N` → `chain()` warms anime+servers → `use-stream-loader` fetches `/api/watch?type=all` → best direct stream attached through `/api/proxy/hls` → `timeupdate` throttles `POST /api/user/progress` → on failure: refresh once → advance stream → embed → error card.

**Search:** navbar quick search debounces 300ms → `GET /api/fragments/suggestions?keyword=…` → EJS HTML swapped into the dropdown; full page `/search?q=` also fetches `/api/search` for the deduped grid.
