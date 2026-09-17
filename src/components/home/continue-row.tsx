"use client";

/** Continue watching — synced from /api/user/progress with resume links. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { PosterImage } from "@/components/anime/poster-image";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-provider";
import type { ProgressRecord } from "@/lib/store/types";

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m ${s % 60}s`;
}

export function ContinueRow() {
  const { user } = useAuth();
  const [items, setItems] = useState<ProgressRecord[] | null>(null);

  useEffect(() => {
    if (!user) {
      Promise.resolve().then(() => setItems([]));
      return;
    }
    let alive = true;
    fetch("/api/user/progress?limit=12")
      .then((r) => r.json())
      .then((d) => alive && setItems(d.items ?? []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [user]);

  if (!items) {
    return (
      <section className="py-3" aria-label="Continue watching">
        <h2 className="mb-3 flex items-center gap-2 px-4 text-base font-semibold sm:px-6">
          <History className="h-4.5 w-4.5 text-primary" /> Continue watching
        </h2>
        <div className="flex gap-3 overflow-hidden px-4 sm:px-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[190px] w-[280px] shrink-0 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className="py-3" aria-label="Continue watching">
      <h2 className="mb-3 flex items-center gap-2 px-4 text-base font-semibold sm:px-6">
        <History className="h-4.5 w-4.5 text-primary" /> Continue watching
      </h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2 sm:px-6">
        {items.map((p) => {
          const pct = p.durationSeconds > 0 ? Math.min(100, (p.positionSeconds / p.durationSeconds) * 100) : 0;
          return (
            <Link
              key={p.animeKey}
              href={`/watch?key=${encodeURIComponent(p.animeKey)}&ep=${p.episode}`}
              className="group relative w-[280px] shrink-0 overflow-hidden rounded-xl border border-border/60 bg-card"
            >
              <div className="relative aspect-video">
                <PosterImage src={p.poster} alt={p.animeTitle} aspect="banner" className="rounded-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3 text-white">
                  <p className="line-clamp-1 text-[13px] font-semibold">{p.animeTitle}</p>
                  <p className="text-[11px] text-white/70">
                    EP {p.episode} · {fmt(p.positionSeconds)}
                    {pct > 90 ? " · almost done" : ""}
                  </p>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
                  <div className="brand-gradient h-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
