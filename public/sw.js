/*
 * AniKuoshi service worker — offline shell + smart runtime caching.
 *
 * Strategy matrix:
 *   - App shell (/, /offline, manifest, icons, htmx)  : precached
 *   - Immutable hashed assets (/_next/static/<hash>*) : cache-first
 *   - Other static files (unhashed css/js/img)        : stale-while-revalidate
 *   - Upstream API GETs (apikuoshi)                   : network-first w/ cache fallback
 *     (EXCEPT token-bearing stream endpoints — never cached)
 *   - User APIs (/api/auth/*, /api/user/*)            : network only
 *   - Navigation requests                             : network-first, offline fallback
 *
 * FIX (v1.1.1):
 *   1. Unhashed css/js previously went through cache-FIRST, so users could be
 *      stuck on a stale UI after any deploy until the cache was manually
 *      cleared (observed in testing: old stylesheet served after an update).
 *      They now use stale-while-revalidate: instant answer + background refresh.
 *   2. /api/watch, /api/chain and /api/anime/servers return short-lived CDN
 *      tokens. Serving a cached stream response after network loss produced
 *      guaranteed 403s (dead token) — worse than a clean error. These are now
 *      network-only, in line with the player's "fresh token per switch" rule.
 *   3. VERSION is bumped per release so activate() purges every cache an
 *      older build may have left behind.
 */
const VERSION = "anikuoshi-v1.2.1";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const API_CACHE = `${VERSION}-api`;

const SHELL_ASSETS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/vendor/htmx.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function isImmutable(url) {
  // Content-hashed Next.js output + truly static vendor art.
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/vendor/")
  );
}

function isStatic(url) {
  return isImmutable(url) || /\.(?:css|js|woff2?|png|jpe?g|webp|svg|avif)$/.test(url.pathname);
}

function isUpstreamApi(url) {
  return url.hostname.endsWith("apikuoshi-v2.onrender.com") && url.pathname.startsWith("/api/");
}

/** Stream endpoints mint short-lived CDN tokens — caching them is harmful. */
function isTokenApi(url) {
  return (
    url.pathname.startsWith("/api/watch") ||
    url.pathname.startsWith("/api/chain") ||
    url.pathname.startsWith("/api/anime/servers") ||
    url.pathname.startsWith("/api/proxy/")
  );
}

function isUserApi(url) {
  return url.pathname.startsWith("/api/auth") || url.pathname.startsWith("/api/user");
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

/** Serve fast from cache, refresh the copy in the background. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || (await network) || Response.error();
}

async function networkFirst(request, cacheName, fallbackResponse) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    return fallbackResponse ?? Response.json({ success: false, error: "offline" }, { status: 503 });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Never let the SW handle itself — browsers must always revalidate it,
  // otherwise updates (like this one) would never reach installed clients.
  if (url.pathname.endsWith("/sw.js")) return;

  // User data APIs: never cache, always live.
  if (isUserApi(url)) return;

  // Navigations: try network, fall back to offline shell.
  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request, SHELL_CACHE, caches.match("/offline").then((r) => r || Response.error()))
    );
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      isImmutable(url) ? cacheFirst(request, STATIC_CACHE) : staleWhileRevalidate(request, STATIC_CACHE)
    );
    return;
  }

  if (isUpstreamApi(url)) {
    // Token-bearing stream responses must always hit the network.
    if (isTokenApi(url)) return;
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }
});
