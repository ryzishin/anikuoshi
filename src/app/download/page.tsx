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
  description: "Get the AniKuoshi v1.3.0 source bundle — watch page simplification, settings overhaul, home restructure & perf.",
};

const FIXES = [
  {
    icon: Wrench,
    title: "v1.3.0 — watch page simplification & settings overhaul",
    body: "Senshi and Plyr players removed (Vidk + Embed remain); embed sandbox removed; Vidk poster letterboxed and fed by the v2.4.0 episode-thumbnail chain; subtitle defaults fixed and selectable; seamless server/episode switching with no rewind on toggle; always-visible servers; new wiggle-ellipsis loader; clean not-aired / no-stream states.",
  },
  {
    icon: Wrench,
    title: "Home, browse & details restructure",
    body: "Top 10 first as a looping hero carousel (Today/Week/Month), then Spotlight / Trending / Recently updated / Popular / Top airing / Upcoming as tabs with a ‹ n › pagination control in a grid. Browse keyword waits for Apply. Details page: full v2.4.0 data, combined fetch, episode grid removed in favor of validated Seasons / Prequel / Sequel / Specials / Related, watchlist status dropdown, Movie “Watch” CTA, not-aired states.",
  },
  {
    icon: Gamepad2,
    title: "Two switchable engines, zero dead settings",
    body: "Vidk (Vidstack, direct HLS with captions) and Embed — one tap to switch below the player; position, volume and rate survive the hop. Settings rebuilt: Default Provider (riyo/kaito/hana/sora/… with auto fallback), Anime Titles and Characters language split, and the new Default Language (sub/dub) that drives stream selection.",
  },
  {
    icon: MonitorSmartphone,
    title: "Keyboard shortcuts & header search",
    body: "Shortcut audit: every binding verified, Space no longer double-fires on focused buttons, ctrl/alt/meta chords ignored, the removed server-panel key documented. Header search is bigger and thumb-friendly (44px, wider focus width) and still opens poster-preview suggestions.",
  },
  {
    icon: Palette,
    title: "Restrained product design",
    body: "AI-generated tells removed: gradient buttons/chips/blobs replaced with the solid accent system, glow shadows dropped, card hover calmed, landing hero cleaned. Routing fixed to /anime/:slug|:key (never titles), HTML entities decoded at the API layer, logo links to /home, title language honored on every surface.",
  },
  {
    icon: Boxes,
    title: "Faster site",
    body: "hls.js and Plyr no longer shipped to the client (Vidstack loads its own engine lazily), idle-route prefetch for Home/Browse/Search/History/Settings, catalog TTL caching kept, lighter first paint on mobile and older devices.",
  },
  {
    icon: ShieldCheck,
    title: "Sync, avatar & progress fixes",
    body: "pagehide flush no longer writes to a stale episode (exact episode + timestamp persist); Continue EP n surfaces on details/history/home; avatar upload accepts any image file with encoder fallback and upload state.",
  },
  {
    icon: CheckCircle2,
    title: "Nothing regressed",
    body: "Auth, progress sync, theme engine, PWA/fragments, EJS + htmx, MongoDB/Prisma dual driver — all kept in place. Only real APIKuoshi v2.4.0 endpoints and fields; nothing invented.",
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
            AniKuoshi <span className="brand-text">v1.3.0</span>
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            UI/UX fixes, watch page simplification, settings overhaul and performance — built on APIKuoshi v2.4.0. Stack unchanged: Next.js 16 App Router · shadcn/ui · EJS + htmx fragments · MongoDB / Prisma SQLite.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2">
          <Button asChild size="lg" className="h-12 border-0 bg-primary px-7 text-base text-primary-foreground" data-testid="download-zip">
            <a href="/anikuoshi-v1.3.0-source.zip" download>
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
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">cp .env.example .env</code> — set{" "}
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
