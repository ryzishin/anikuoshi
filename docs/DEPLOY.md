# Deploying AniKuoshi

## Deploy to Vercel (recommended)

### 1. Create a MongoDB Atlas cluster
1. Create a free M0 cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a database user and allow your deploy IP (or `0.0.0.0/0` for serverless).
3. Copy the SRV connection string, e.g.
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

### 2. Push the repo
```bash
git init && git add . && git commit -m "AniKuoshi v1.0.0"
git remote add origin https://github.com/YOU/anikuoshi.git
git push -u origin main
```
(Or deploy the included ZIP directly with `vercel deploy`.)

### 3. Import to Vercel
1. [vercel.com/new](https://vercel.com/new) → import the repo (framework auto-detects Next.js).
2. Environment variables:

| Key | Value |
|---|---|
| `MONGODB_URI` | your Atlas SRV string |
| `MONGODB_DB` | `anikuoshi` |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_API_BASE` | *(optional)* defaults to the public APIKuoshi deployment |

3. Deploy. First boot creates indexes automatically (`users`, `progress`, `listEntries`).

> Playing streams stays out of your serverless functions entirely — the browser talks to the API's own CORS/proxy layer — so Vercel's function limits never affect playback.

## Run locally

```bash
npm install
cp .env.example .env.local

# Option A — MongoDB Atlas (mirror production)
#   set MONGODB_URI + MONGODB_DB in .env.local

# Option B — SQLite (no account needed)
#   leave MONGODB_URI unset, then:
npm run db:push          # creates prisma/dev.db via DATABASE_URL

npm run dev              # http://localhost:3000
```

## Docker-style self-host (any Node host)

```bash
npm ci
npm run build
# serve with any Next-compatible runner:
npm start                # uses .next/standalone when built with the bundled config
```

Requirements: Node ≥ 18.17, outbound HTTPS to `apikuoshi-v2.onrender.com` (or your `NEXT_PUBLIC_API_BASE`), and — for the SQLite fallback — a writable `db/` directory. Prefer MongoDB on ephemeral hosts.

## Environment reference

| Variable | Scope | Notes |
|---|---|---|
| `MONGODB_URI` | server | Atlas SRV string; presence switches the store driver |
| `MONGODB_DB` | server | database name (default `anikuoshi`) |
| `DATABASE_URL` | server | Prisma/SQLite URL for the fallback driver |
| `AUTH_SECRET` | server | **required in prod** — session JWT signing key |
| `NEXT_PUBLIC_API_BASE` | client | override the upstream API base URL |
| `NEXT_PUBLIC_SITE_URL` | build | absolute URL used in metadata |

## Post-deploy checklist

- [ ] Register an account; verify the user appears in Atlas (`users` collection).
- [ ] Play an episode; check `progress`/`watchProgress` updates ~every 15s.
- [ ] Install the PWA from the address bar; relaunch standalone.
- [ ] Kill the network and reload — the `/offline` shell renders.
- [ ] Change theme variant + accent; reload — choices persist.
- [ ] Password change works from Profile (old + new + confirm).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Streams 403 briefly then recover | Expected — CDN tokens live ~90s; the player auto-refreshes and the API proxy re-tokenizes each hop. |
| "Stream unavailable" on every server | Upstream hiccup on the API's sources; retry in a minute or switch sub/dub. |
| API feels slow on first use | Render free tier cold-start (~40–60s); responses cache after warm-up. |
| Login says "Invalid credentials" after deploy | `AUTH_SECRET` changed → old cookies invalid; users just sign in again. |
| SQLite "User not found" after redeploys | Ephemeral filesystem wiped the db file — use MongoDB on serverless. |
