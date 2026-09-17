"use client";

/**
 * /history — "Continue Watching" (v1.2.0 — §7).
 *
 * A dedicated nav page for watch history with progress bars. The exact
 * episode + timestamp saved by the player resume from here:
 *   - signed-in: GET /api/user/progress (server profile, every device)
 *   - guests:    the anikuoshi.guestProgress localStorage map the player
 *                writes on the same 15s/flush cadence (title/poster/duration
 *                ride along since v1.2.0)
 * Progress % = positionSeconds / durationSeconds — the same math the home
 * Continue Watching row uses, so every surface agrees (§7 consistency).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { History, Play, Trash2, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-provider";
import { usePreferences } from "@/components/preferences-provider";
import { displayTitle, type TitleLang } from "@/lib/api";

type ServerEntry = {
  animeKey: string;
  animeTitle: string;
  poster: string | null;
  episode: number;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: string;
};

type GuestEntry = {
  key: string;
  title: string;
  poster: string | null;
  episode: number;
  t: number;
  dur: number;
  at: number;
};

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m ${s % 60}s`;
}

function pct(pos: number, dur: number) {
  return dur > 0 ? Math.min(100, Math.round((pos / dur) * 100)) : 0;
}

/** Guest entries from localStorage (newest first). */
function readGuestEntries(): GuestEntry[] {
  try {
    const raw = localStorage.getItem("anikuoshi.guestProgress");
    if (!raw) return [];
    const map = JSON.parse(raw) as Record<string, { ep: number; t: number; title?: string; poster?: string | null; dur?: number; at?: number }>;
    return Object.entries(map)
      .map(([key, v]) => ({
        key,
        title: v.title || key,
        poster: v.poster ?? null,
        episode: v.ep ?? 1,
        t: v.t ?? 0,
        dur: v.dur ?? 0,
        at: v.at ?? 0,
      }))
      .filter((e) => e.t > 5)
      .sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const { titleLang } = usePreferences();
  const [serverItems, setServerItems] = useState<ServerEntry[] | null>(null);
  const [guestItems, setGuestItems] = useState<GuestEntry[] | null>(null);

  useEffect(() => {
    if (user) {
      setGuestItems([]);
      let alive = true;
      fetch("/api/user/progress?limit=50")
        .then((r) => r.json())
        .then((d) => alive && setServerItems(d.items ?? []))
        .catch(() => alive && setServerItems([]));
      return () => {
        alive = false;
      };
    }
    setServerItems([]);
    setGuestItems(readGuestEntries());
  }, [user]);

  const removeServerEntry = async (animeKey: string) => {
    setServerItems((prev) => prev?.filter((x) => x.animeKey !== animeKey) ?? null);
    await fetch(`/api/user/progress?key=${encodeURIComponent(animeKey)}`, { method: "DELETE" }).catch(() => {});
  };

  const removeGuestEntry = (key: string) => {
    try {
      const raw = localStorage.getItem("anikuoshi.guestProgress") || "{}";
      const map = JSON.parse(raw) as Record<string, unknown>;
      delete map[key];
      localStorage.setItem("anikuoshi.guestProgress", JSON.stringify(map));
    } catch {}
    setGuestItems((prev) => prev?.filter((x) => x.key !== key) ?? null);
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-10 sm:px-6">
        <Skeleton className="h-9 w-56" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-10 sm:px-6">
        <Header />
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <UserRound className="h-4 w-4" /> You&apos;re browsing as a guest — history below is kept on
          this device only. <Link href="/login" className="text-primary underline">Sign in</Link> to sync
          it everywhere.
        </p>
        <GuestList items={guestItems} onRemove={removeGuestEntry} titleLang={titleLang} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-10 sm:px-6">
      <Header />
      <Card className="mt-6 border-border/70 bg-card/70 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Watch history</CardTitle>
        </CardHeader>
        <CardContent>
          {!serverItems ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : serverItems.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              Nothing yet — start any episode and it shows up here with a progress bar.
            </p>
          ) : (
            <div className="space-y-2" data-testid="history-list">
              {serverItems.map((h) => {
                const percent = pct(h.positionSeconds, h.durationSeconds);
                return (
                  <div
                    key={h.animeKey}
                    className="group relative flex items-center gap-3 rounded-xl border border-border/60 p-2 pr-11 transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <Link
                      href={`/watch?key=${encodeURIComponent(h.animeKey)}&ep=${h.episode}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                      aria-label={`Resume ${h.animeTitle} episode ${h.episode}`}
                    >
                      {h.poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={h.poster} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded object-cover" />
                      ) : (
                        <Skeleton className="h-14 w-10 shrink-0 rounded" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{h.animeTitle}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          EP {h.episode} · {fmt(h.positionSeconds)}
                          {h.durationSeconds > 0 ? ` of ${fmt(h.durationSeconds)}` : ""}
                          {percent >= 90 ? " · almost done" : ""}
                        </span>
                        <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-muted">
                          <span className="brand-gradient block h-full" style={{ width: `${percent}%` }} />
                        </span>
                      </span>
                      <Play className="h-4 w-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                    <button
                      onClick={() => removeServerEntry(h.animeKey)}
                      aria-label={`Remove ${h.animeTitle} from history`}
                      title="Remove from history"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <History className="h-6 w-6 text-primary" /> History
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Continue watching — every entry remembers the exact episode and timestamp.
      </p>
    </div>
  );
}

function GuestList({
  items,
  onRemove,
  titleLang,
}: {
  items: GuestEntry[] | null;
  onRemove: (key: string) => void;
  titleLang: TitleLang;
}) {
  if (!items) {
    return (
      <div className="mt-4 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="mt-6 rounded-2xl border border-dashed border-border/70 py-12 text-center text-sm text-muted-foreground">
        Watch something and it will show up here.
      </p>
    );
  }
  return (
    <div className="mt-4 space-y-2" data-testid="history-list-guest">
      {items.map((g) => {
        const percent = pct(g.t, g.dur);
        return (
          <div
            key={g.key}
            className="group relative flex items-center gap-3 rounded-xl border border-border/60 p-2 pr-11 transition-colors hover:border-primary/40 hover:bg-accent/40"
          >
            <Link
              href={`/watch?key=${encodeURIComponent(g.key)}&ep=${g.episode}`}
              className="flex min-w-0 flex-1 items-center gap-3"
              aria-label={`Resume ${g.title} episode ${g.episode}`}
            >
              {g.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.poster} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded object-cover" />
              ) : (
                <Skeleton className="h-14 w-10 shrink-0 rounded" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {displayTitle({ title: g.title }, titleLang)}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  EP {g.episode} · {fmt(g.t)}
                  {g.dur > 0 ? ` of ${fmt(g.dur)}` : ""}
                  {percent >= 90 ? " · almost done" : ""}
                </span>
                <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-muted">
                  <span className="brand-gradient block h-full" style={{ width: `${percent}%` }} />
                </span>
              </span>
              <Play className="h-4 w-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
            <button
              onClick={() => onRemove(g.key)}
              aria-label={`Remove ${g.title} from history`}
              title="Remove from history"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
