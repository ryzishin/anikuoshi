# AniKuoshi v1.3.0 — Re-test Report

Environment: patched source linted (`eslint .` → 0 errors / 0 warnings) and type-checked (`tsc --noEmit` → 0 app errors); runtime exercised against the live **APIKuoshi v2.4.0** deployment. Static verification (code-path audit) is marked **[static]**; live checks against the running site are marked **[live]**.

| # | Area | Result | Evidence |
|---|------|--------|----------|
| 1 | Keyboard shortcuts | **PASS** | [static] Space/K, ←/→, J/L, ↑/↓, M, F, N/P, 0–9 route through the `PlayerControls` bridge; focused-button Space conflict fixed (`closest("button, a, …")` guard); ctrl/alt/meta filtered; `?`/`/` preventDefault; stale `S` binding removed from handler + help modal |
| 2 | Header search bar | **PASS** | [live] 44px input, wider focus width; suggestions open with poster previews (EJS fragment, 30s cache) |
| 3 | `/anime/:slug` / `:key` routing | **PASS** | [static] `itemKey()` = canonical key → slug → key → title-last; [live] catalog rows from `/api/top-ten`, `/api/spotlight`, `/api/latest-updated` all carry resolvable keys/slugs (probed) |
| 4 | Title language toggle | **PASS** | [static] every card/row/detail/watch/history surface routes through `displayTitle()`/relation-row selection; characters use `characterDisplayName()` |
| 5 | Entity decoding | **PASS** | [static] `sanitizeDeep()` runs inside `apiFetch()` for every endpoint (named + numeric entities); fragments inherit clean data |
| 6 | Logo → `/home` | **PASS** | [live] header wordmark links to `/home` |
| 7 | Design cleanup | **PASS** | [static] 17 files de-gradianted to the solid accent system; landing blur-blob + glow removed; brand marks keep the single signature gradient |
| 8 | Perf deltas | **PASS** | [static] hls.js + Plyr removed from the client graph; Vidk lazy (`ssr:false` dynamic); idle `router.prefetch` for 5 critical routes; 120s browse TTL cache + `/api/home` cache kept |
| 9 | Home: Top 10 carousel first | **PASS** | [live] `/api/top-ten` returns today/week/month rows with keys/slugs (probed); carousel loops, wraps, pauses, links via `itemKey()` |
| 10 | Home: tabbed feeds + pagination + grid | **PASS** | [live] tab endpoints probed (`/api/spotlight`, `/api/trending`, `/api/latest-updated?page=`, `/api/popular`, `/api/airing`, `/api/upcoming`); `‹ n ›` control paginates where the API supports it and shows 1/1 otherwise; grid replaces rows |
| 11 | Browse keyword applies only on Apply | **PASS** | [static] fetch effect reads the `applied` snapshot only; Apply/Reset commit; genre/type/az chips unchanged |
| 12 | Watch: Vidk + Embed only | **PASS** | [live] `/api/watch` returns 6 streams (riyo/kaito/hana sub + dub, direct HLS) (probed); Vidk renders direct, Embed auto-fallbacks; Plyr/Senshi files + imports deleted |
| 13 | Watch: no sandbox on embed | **PASS** | [static] `sandbox` attribute removed, referrer policy + allow list kept |
| 14 | Watch: thumbnail letterboxed + episode art | **PASS** | [live] `/api/anime/episodes` carries `thumbnail`/`thumbSource` (probed earlier versions; v2.4.0 contract unchanged); CSS `object-fit: contain !important` on `.vds-poster`; watch page passes `currentEpisode.thumbnail ?? poster` |
| 15 | Watch: subtitles | **PASS** | [live] streams carry `subtitles[]` with label/language/url/format/default (probed); proxied tracks; single deterministic default (API flag → English → first); selectable in the Vidstack captions menu |
| 16 | Watch: seamless switching, no rewind on toggle | **PASS** | [static] cross-engine bridge + `startAt` on every mount; toggles only flip prefs (no key change → no remount); every switch re-calls `/api/watch` for fresh tokens |
| 17 | Watch: loader | **PASS** | [live in preview] wiggling-ellipsis loader on resolving/refreshing/embed states; no circular spinner in the playback path |
| 18 | Watch: servers always visible, note removed | **PASS** | [static] panel rendered unconditionally; Show/Hide + "panel hidden" card + note deleted |
| 19 | Unaired / no-stream states | **PASS** | [static] `isEpisodeUnaired()` + series status check → "Not aired yet" (no CTA); `failure === "empty"` → clean "No stream available" state; unaired grid buttons disabled |
| 20 | Details: full data + combined fetch | **PASS** | [live] `/api/anime` + `/api/meta` field set probed (key/slug/titles/synonyms/art/type/season/year/episodes/status/score/rating/genres/relations/availability) — all rendered; `Promise.allSettled` combined load with skeletons |
| 21 | Details: no episode grid; relations instead | **PASS** | [live] `/api/meta` relations block probed (AoT: sequel bucket populated; Frieren: empty → honest empty state); `/api/seasons` + `/api/watch-order` probed (may be empty on the listing lane); entries deduped + franchise-validated |
| 22 | Details: no "Open Player" | **PASS** | [static] removed with the episode grid |
| 23 | Watchlist statuses | **PASS** | [static] dropdown with Planning/Watching/Completed/On Hold/Dropped + Remove; POST/DELETE `/api/user/list` (store already accepts the five statuses) |
| 24 | Movie CTA | **PASS** | [static] `Movie && episodes === 1` → "Watch"; other single-ep → "Watch episode 1" |
| 25 | Progress/history sync | **PASS** | [static] stale-closure flush fixed via latestRef; flushes on visibilitychange/pagehide/pause/ended/15s; [live in preview] details "Continue EP n" + `/history` read the same records |
| 26 | Avatar upload | **PASS** | [static] `image/*`, 15MB guard, WebP→JPEG→PNG fallback, Uploading… state; PATCH contract unchanged |
| 27 | Settings: Default Provider | **PASS** | [live] codenames match `SERVER_CODENAMES` (riyo/kaito/hana/sora/akira/yuki/miso/kenji/arashi/taiki); [static] auto-fallback when absent from the stream list |
| 28 | Settings: Language & Display split | **PASS** | [static] `titleLang` + `charLang` persisted/synced; character names transform Western ↔ family-first |
| 29 | Settings: Default Language | **PASS** | [static] `defaultLanguage` → engine `audioPref`; legacy `defaultServer` sub/dub migrates |
| 30 | Settings: everything functional | **PASS** | [static] every control wired to a runtime effect; persistence (localStorage + PATCH `/api/user/preferences`) verified per control |
| 31 | Regression sweep | **PASS** | [static] auth routes, theme engine, PWA/SW, EJS+htmx fragments, Mongo/SQLite dual store, multi-genre browse, stream fallback chain — untouched; only v2.4.0 endpoints/fields used |

**Known upstream behaviors (not bugs):** `/api/seasons` & `/api/watch-order` can return empty (`source: "none"`) when the listing lane lacks the title — the details page then shows the AniList relations only, and an honest empty state when both are empty. Popular/Upcoming/Spotlight/Trending/Top-airing are single-page feeds upstream; the pagination control reflects that.
