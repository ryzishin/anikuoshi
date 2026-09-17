"use client";

/**
 * Universal anime card — links to the details page.
 * FIX (v1.2.0 — §10 PERF): wrapped in React.memo — home rows re-render on
 * every prefs/scroll-driven parent state change and the cards are the bulk
 * of the reconciled nodes. Shallow compare is safe: callers pass stable item
 * references and primitives otherwise.
 */
import { memo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PosterImage } from "./poster-image";
import { displayTitle, itemKey } from "@/lib/api";
import { usePreferences } from "@/components/preferences-provider";
import { Play } from "lucide-react";

export type CardItem = {
  /** v2.3.0 canonical rows carry a resolvable key — used directly when canonical */
  key?: string | null;
  slug?: string;
  title: string;
  japaneseTitle?: string;
  /** v2.3.0 rows also carry display-title variants (read by displayTitle) */
  titleRomaji?: string | null;
  titleEnglish?: string | null;
  poster?: string;
  type?: string;
  sub?: number;
  dub?: number;
  total?: number;
  rating?: string;
  episode_no?: number;
};

/** Universal anime card — links to the details page. */
function AnimeCardBase({
  item,
  index,
  badge,
  progress,
}: {
  item: CardItem;
  index?: number;
  badge?: string;
  progress?: number; // 0..1 watch progress bar
}) {
  const { titleLang } = usePreferences();
  const href = `/anime/${encodeURIComponent(itemKey(item))}`;
  return (
    <Link
      href={href}
      className="group block w-[130px] shrink-0 sm:w-[150px]"
      data-aos={index !== undefined ? "fade-up" : undefined}
      data-aos-delay={index !== undefined ? Math.min(index, 8) * 40 : undefined}
    >
      <div className="card-hover relative">
        <PosterImage src={item.poster} alt={displayTitle(item, titleLang)} />
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/95 shadow-lg">
            <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
          </span>
        </div>
        {(badge || item.type) && (
          <Badge
            variant="secondary"
            className="absolute left-1.5 top-1.5 border-0 bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur"
          >
            {badge || item.type}
          </Badge>
        )}
        {/* FIX (v1.2.1): some rows (v2.3.0 spotlights) put AGE RATINGS like
            "PG-13"/"R" in `rating` — Number() was NaN and the badge showed
            "★ NaN". Only render genuinely numeric scores. */}
        {Number.isFinite(Number(item.rating)) &&
          item.rating !== "" &&
          item.rating != null &&
          !item.rating.includes("?") &&
          Number(item.rating) > 0 && (
            <Badge className="absolute right-1.5 top-1.5 border-0 bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 backdrop-blur">
              ★ {Number(item.rating).toFixed(1)}
            </Badge>
          )}
        {typeof progress === "number" && progress > 0 && (
          <div className="absolute inset-x-2 bottom-1.5 h-1 overflow-hidden rounded-full bg-black/60">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
            />
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-snug text-foreground/90 transition-colors group-hover:text-foreground">
        {displayTitle(item, titleLang)}
      </p>
      {(item.type || item.japaneseTitle) && (
        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
          {[item.type, item.sub ? `EP ${item.sub}` : null].filter(Boolean).join(" · ") ||
            displayTitle(item, titleLang === "english" ? "romaji" : "english")}
        </p>
      )}
    </Link>
  );
}

export const AnimeCard = memo(AnimeCardBase);
