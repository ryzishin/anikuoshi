"use client";

/**
 * Top ten — ranked strip with Today / Week / Month tabs.
 * FIX (v1.1.2): the row showed only NINE cards — not a CSS problem: the
 * upstream "Top 10" widget itself exposes 9 entries per period. topTen()
 * now backfills slot 10 from /api/top-rankings (see api.ts), so this row
 * genuinely renders 10. Rank numerals come from `rank` (API + backfill).
 */
import { useEffect, useState } from "react";
import { ListOrdered } from "lucide-react";
import Link from "next/link";
import { PosterImage } from "@/components/anime/poster-image";
import { CardRowSkeleton } from "@/components/anime/poster-image";
import { itemKey, topTen } from "@/lib/api";
import type { KazeItem } from "@/lib/api";

type Period = "today" | "week" | "month";

export function TopTenRow() {
  const [data, setData] = useState<Record<Period, KazeItem[]> | null>(null);
  const [period, setPeriod] = useState<Period>("today");

  useEffect(() => {
    let alive = true;
    topTen()
      .then((d) => alive && setData({ today: d.today ?? [], week: d.week ?? [], month: d.month ?? [] }))
      .catch(() => alive && setData({ today: [], week: [], month: [] }));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="py-3" aria-label="Top ten anime">
      <div className="mb-3 flex items-center justify-between px-4 sm:px-6">
        <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
          <ListOrdered className="h-4.5 w-4.5 text-yellow-400" /> Top 10
        </h2>
        <div className="flex gap-1 rounded-full border border-border/70 p-0.5" role="tablist" aria-label="Top ten period">
          {(["today", "week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                period === p ? "brand-gradient text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <CardRowSkeleton count={5} />
      ) : data[period].length === 0 ? (
        <p className="px-4 text-sm text-muted-foreground sm:px-6">No rankings for this period yet.</p>
      ) : (
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2 sm:px-6">
          {data[period].map((item, i) => {
            /**
             * FIX (v1.1.1): links used the kaze slug ("one-piece-odmau") which
             * the API cannot resolve — Top 10 cards were the only cards in the
             * app still navigating by slug, so they (alone) could land on
             * "Couldn't load this title". Use itemKey() like every other row:
             * title-first, slug as last resort. Rank chip comes from the API
             * `rank` field when present, falling back to row order.
             */
            const rank = typeof item.rank === "number" ? item.rank : i + 1;
            return (
              <Link
                key={`${item.slug}-${i}`}
                href={`/anime/${encodeURIComponent(itemKey(item))}`}
                className="group flex w-[190px] shrink-0 snap-start gap-2"
              >
                <span
                  className="self-end pb-6 text-5xl font-black leading-none tracking-tighter text-foreground/10 transition-colors group-hover:text-primary/30"
                  aria-hidden
                >
                  {rank}
                </span>
                <div className="w-[110px] shrink-0">
                  <div className="card-hover">
                    <PosterImage src={item.poster} alt={item.title} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-[12px] font-medium leading-snug">{item.title}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
