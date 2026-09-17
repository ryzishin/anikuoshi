import type { Metadata } from "next";
import Link from "next/link";
import {
  Boxes,
  CheckCircle2,
  Download,
  Gamepad2,
  MonitorSmartphone,
  Package,
  Palette,
  ShieldCheck,
  Terminal,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Download source",
  description: "Get the AniKuoshi v1.2.1 source bundle — home feed reorder, settings consolidation, hero restore & preference-sync fix.",
};

const FIXES = [
  {
    icon: Wrench,
    title: "v1.2.1 — home feed, settings & sync",
    body: "Landing BG hero restored (v2.3.0 /api/home envelope fix); home feed reordered to Top 10 → Spotlight → Recently updated → Popular → Top airing → Coming soon with the duplicate Trending row removed; Top 10 per-period data fixed; all preferences consolidated into /settings; signed-in preference sync repaired (SQLite JSON-string merge bug).",
  },
  {
    icon: Wrench,
    title: "v1.2.0 — player UX overhaul & watch sync",
    body: "Skip-intro prompt and play-next countdown removed; player order Plyr → Vidk → Senshi → Embed with a Default-player setting; auto play / auto next / auto skip wired for real and persisted; per-episode thumbnails and full aired dates; History page + exact-timestamp resume; quick search in the header; browse All chips + multi-genre; perf pass.",
  },
  {
    icon: Wrench,
    title: "Built on APIKuoshi v2.3.0",
    body: "Client moved to apikuoshi-v2.onrender.com: canonical keys used directly from catalog rows, per-episode thumbnail/thumbSource fields rendered, comma-separated multi-genre filter — only real v2.3.0 endpoints, nothing invented.",
  },
  {
    icon: Gamepad2,
    title: "Four switchable player engines",
    body: "Plyr over HLS · Vidk (Vidstack) · Senshi (custom default) · sandboxed Iframe embed — one tap to switch below the player; position, volume, rate and subtitles survive the hop; fallback chain ends in embed before the error card.",
  },
  {
    icon: Palette,
    title: "Settings page & navigation rebuild",
    body: "Appearance moved into /settings (theme + accent + default player); mobile bottom nav removed; header visible on /watch with a back chevron; sidebar double-close stays removed; History and My List live in the sidebar.",
  },
  {
    icon: MonitorSmartphone,
    title: "Mobile-first polish",
    body: "44px touch targets, safe-area insets, no horizontal scroll, marquee under-player strip, skeleton loaders, progressive episode rendering for 1000+-episode series — verified at 390px.",
  },
  {
    icon: Boxes,
    title: "Watch page order",
    body: "Player → Servers → Episodes (per-episode thumbnail + full aired date) → Seasons & Specials → Recommendations, exactly per spec, with the token-refresh fallback chain untouched.",
  },
  {
    icon: ShieldCheck,
    title: "Nothing regressed",
    body: "Auth, progress sync, theme engine, PWA/fragments, EJS + htmx, MongoDB/Prisma dual driver — all kept in place. No refactors, no invented API routes.",
  },
];

export default function DownloadPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Package className="h-3.5 w-3.5" /> Platform preview
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
            AniKuoshi <span className="brand-text">v1.2.1</span>
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Home feed reorder + settings consolidation + preference-sync fix, on top of the v1.2.0 overhaul — built on APIKuoshi v2.3.0. Stack unchanged: Next.js 16 App Router · shadcn/ui · EJS + htmx fragments · MongoDB / Prisma SQLite.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2">
          <Button asChild size="lg" className="brand-gradient border-0 text-white" data-testid="download-zip">
            <a href="/download/anikuoshi-v1.2.1-source.zip" download>
              <Download className="mr-2 h-5 w-5" /> Download ZIP
            </a>
          </Button>
          <Badge variant="secondary" className="justify-center">
            source bundle · excludes node_modules &amp; .next
          </Badge>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {FIXES.map((f) => (
          <Card key={f.title} className="border-border/70 bg-card/70 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <f.icon className="h-4 w-4 text-primary" /> {f.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 border-border/70 bg-card/70 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Terminal className="h-4 w-4 text-primary" /> Install &amp; run
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">1.</span> Unzip, then{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm install</code> (or{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">bun install</code>).
            </li>
            <li>
              <span className="font-medium text-foreground">2.</span>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">cp .env.example .env.local</code> — set{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">AUTH_SECRET</code>; add{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">MONGODB_URI</code> for Atlas or leave unset for the SQLite fallback.
            </li>
            <li>
              <span className="font-medium text-foreground">3.</span>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm run db:push</code> (SQLite path only), then{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm run dev</code> →{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">http://localhost:3000</code>.
            </li>
            <li>
              <span className="font-medium text-foreground">4.</span> Deploy on Vercel: import the repo, add the same env vars, build with the defaults.{" "}
              <Link href="https://vercel.com/new" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                vercel.com/new ↗
              </Link>
            </li>
          </ol>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            Full details in <code className="rounded bg-muted px-1 py-0.5 text-[11px]">README.md</code> and{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">CHANGELOG.md</code> inside the bundle.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
