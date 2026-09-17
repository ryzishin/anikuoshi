# AniKuoshi v1.3.0 — Summary

**What changed, what was verified.** Full detail: `docs/WORKLOG-v1.3.0.md` (root causes + files) and `docs/RETEST-REPORT-v1.3.0.md` (per-item checks). Changelog: `CHANGELOG.md`.

## What changed

1. **Watch page simplified (§4)** — Senshi and Plyr removed; **Vidk + Embed** remain. Embed runs **without `sandbox`**; the Vidk poster is **letterboxed** and fed by the v2.4.0 episode-thumbnail chain; subtitles render, are selectable, and get a deterministic default (API flag → English → first). Server/episode switching preserves time/volume/rate/subs; **toggles never rewind**; every switch re-calls `/api/watch` for fresh CDN tokens. **Servers are always visible** (toggle + note removed); prev/next + compact toggles + marquee title live under the player; the stream loader is a **wiggling ellipsis**; **"Not aired yet"** and **"No stream available"** states replace confusing errors.
2. **Home restructured (§2)** — **Top 10 first as a looping hero carousel** (Today/Week/Month, spotlight-enchanted art, arrows/dots/auto-advance), then **six tabbed feeds in a grid** with a **`‹ n ›` pagination control**.
3. **Browse (§3)** — the keyword filter waits for **Apply** like every other filter; no live suggestions/auto-fetch; multi-select genres + All chips preserved.
4. **Details rebuilt (§5)** — every v2.4.0 field rendered; combined fetch + skeletons; **episode grid + "Open Player" removed**; **Seasons / Prequel / Sequel / Specials / Related** from the meta relations block + `/api/seasons` + `/api/watch-order`, deduped and **franchise-validated**; **watchlist status dropdown** (5 statuses + remove); **"Watch"** for single-episode Movies; **"Not aired yet"** CTA; **"Continue EP n"** from progress.
5. **Global (§1)** — shortcuts audited (conflicts fixed, stale bindings removed); bigger 44px header search; card hrefs **always `/anime/:slug|:key`** (never titles); **HTML entities decoded at the API layer**; title language honored on every surface; **logo → `/home`**; AI-look gradients/glows/blobs replaced with the restrained solid-accent system.
6. **Settings overhauled (§8)** — **Default Provider** (10 real codenames + auto fallback), **Anime Titles** and **Characters** language split (Western vs family-first character names), new **Default Language** (sub/dub/system) driving stream selection, legacy `defaultServer` auto-migration, and every control verified functional (local + profile sync).
7. **Sync & profile (§6/§7)** — pagehide flush no longer writes to a stale episode (exact episode + timestamp persist everywhere); avatar upload accepts **any image file** with encoder fallback.
8. **Performance (§10)** — hls.js + Plyr off the client, lazy Vidk engine, idle route prefetch, catalog TTL caching kept — lighter first paint on mobile/PC/older devices.
9. **Housekeeping** — version **1.3.0**, CHANGELOG/README updated, `/download` page rebranded with a working **Download ZIP** button.

## What was verified

- `eslint .` → **0 errors / 0 warnings**; `tsc --noEmit` → **0 app errors** (scaffold `examples/` excluded; Prisma client regenerated).
- API contract: `/api/docs.json` (v2.4.0), `shape.js`, `enrich.js`, `keys.js` read first; live probes of `/api/anime`, `/api/meta` (+ relations), `/api/meta/characters`, `/api/seasons`, `/api/watch-order`, `/api/watch` (streams + subtitles), `/api/top-ten`, `/api/spotlight`, `/api/filter` — every frontend call uses real v2.4.0 routes and fields only.
- 31-item re-test matrix in `docs/RETEST-REPORT-v1.3.0.md` — all PASS (per-item evidence marked live/static).
- Regression sweep: auth, progress sync, theme engine, PWA, fragments, browse multi-genre, stream fallback chain — intact.
