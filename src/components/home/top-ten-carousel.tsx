"use client";

/**
 * FIX (v1.3.0 — §2): Top 10 as a LOOPING HERO CAROUSEL — the new first
 * section of /home, styled after the landing hero. Each slide shows the
 * ranked entry's art (landscape `cover` when the spotlight/Enrichment lane
 * provides it, poster otherwise — never a stretched poster: object-cover on
 * a full-bleed backdrop), the big rank numeral, title + meta from the API,
 * and links to the details page.
 *
 * Looping: auto-advances every 6.5 s and wraps; arrows + dots; pauses while
 * hovered/focused; touch-friendly 44px controls; honors reduced motion.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ListOrdered, Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CardRowSkeleton } from "@/components/anime/poster-image";
import { displayTitle, itemKey, topTen } from "@/lib/api";
import type { KazeItem, TitleLang } from "@/lib/api";

type Period = "today" | "week" | "month";

export type SpotlightArt = Map<string, { cover?: string | null; backdrop?: string | null; description?: string | null }>;

const AUTO_ADVANCE_MS = 6500;

export function TopTenCarousel({
  artByKey,
  titleLang,
}: {
  /** landscape art keyed by item key/slug/title (from /api/spotlight + /api/home) */
  artByKey: SpotlightArt;
  titleLang: TitleLang;
}) {
  const [data, setData] = useState<Record<Period, KazeItem[]> | null>(null);
  const [period, setPeriod] = useState<Period>("today");
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    topTen()
      .then((d) => alive && setData({ today: d.today ?? [], week: d.week ?? [], month: d.month ?? [] }))
      .catch(() => alive && setData({ today: [], week: [], month: [] }));
    return () => {
      alive = false;
    };
  }, []);

  const slides = data?.[period] ?? [];
  const count = slides.length;

  const go = useCallback(
    (dir: 1 | -1) => {
      if (!count) return;
      setActive((a) => (a + dir + count) % count); // wraps → looping
    },
    [count]
  );

  // reset the index when the period changes so it always starts at #1
  useEffect(() => {
    setActive(0);
  }, [period]);

  // auto-advance loop — paused on hover/focus, disabled for reduced motion
  useEffect(() => {
    if (paused || count <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timerRef.current = setInterval(() => go(1), AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, count, go]);

  const lookupKey = (item: KazeItem) =>
    String(item.key || item.slug || item.title || "").toLowerCase();

  const slide = slides[active];
  const art = slide ? artByKey.get(lookupKey(slide)) : undefined;
  const backdrop = slide ? art?.cover || art?.backdrop || slide.poster : null;

  return (
    <section className="py-3" aria-label="Top 10 anime — featured carousel" data-testid="top-ten-carousel">
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
                period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="px-4 sm:px-6">
          <Skeleton className="aspect-[16/8] w-full rounded-2xl sm:aspect-[16/7]" />
        </div>
      ) : count === 0 ? (
        <p className="px-4 text-sm text-muted-foreground sm:px-6">No rankings for this period yet.</p>
      ) : (
        <div
          className="group/carousel relative mx-4 overflow-hidden rounded-2xl border border-border/60 bg-card sm:mx-6"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          data-testid="carousel-slide-active"
        >
          {/* backdrop art — swaps with a crossfade, object-cover full bleed */}
          <div className="relative aspect-[16/10] w-full sm:aspect-[16/7]">
            {slides.map((s, i) => {
              const a = artByKey.get(lookupKey(s));
              const bg = a?.cover || a?.backdrop || s.poster;
              return bg ? (
                 
                <img
                  key={`${period}-${i}`}
                  src={bg}
                  alt=""
                  loading={i === 0 ? "eager" : "lazy"}
                  aria-hidden={i !== active}
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                    i === active ? "opacity-100" : "opacity-0"
                  }`}
                />
              ) : null;
            })}
            <div className="hero-vignette absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

            {/* slide content — rank numeral + title + meta + CTA */}
            {slide && (
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
                <div className="flex items-end gap-3 sm:gap-5">
                  <span
                    className="text-6xl font-black leading-none tracking-tighter text-white/25 sm:text-8xl"
                    aria-hidden
                  >
                    {typeof slide.rank === "number" ? slide.rank : active + 1}
                  </span>
                  <div className="min-w-0 flex-1 pb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
                      #{typeof slide.rank === "number" ? slide.rank : active + 1} · Top 10 {period}
                    </p>
                    <Link
                      href={`/anime/${encodeURIComponent(itemKey(slide))}`}
                      className="mt-0.5 line-clamp-2 block text-lg font-bold text-white transition-colors hover:text-primary sm:text-2xl"
                    >
                      {displayTitle(slide, titleLang)}
                    </Link>
                    <p className="mt-1 text-[11px] text-white/70 sm:text-xs">
                      {[slide.type, slide.sub ? `${slide.sub} EP` : null, art?.description ? undefined : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <Link
                      href={`/anime/${encodeURIComponent(itemKey(slide))}`}
                      className="mt-2.5 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-white"
                    >
                      <Play className="h-3.5 w-3.5 fill-black" /> View details
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* arrows */}
          <button
            aria-label="Previous Top 10 entry"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition-opacity focus-visible:opacity-100 group-hover/carousel:opacity-100 sm:left-3"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            aria-label="Next Top 10 entry"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition-opacity focus-visible:opacity-100 group-hover/carousel:opacity-100 sm:right-3"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* dots */}
          <div className="absolute bottom-2.5 right-3 flex gap-1.5" aria-hidden>
            {slides.map((_, i) => (
              <button
                key={i}
                tabIndex={-1}
                onClick={() => setActive(i)}
                className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-white" : "w-1.5 bg-white/40"}`}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// re-export so the home page can reuse the same skeleton style
export { CardRowSkeleton };
