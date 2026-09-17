"use client";

/** Horizontal scroll row with snap + edge arrows. */
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimeCard, type CardItem } from "./anime-card";
import { CardRowSkeleton } from "./poster-image";

export function CardRow({
  title,
  items,
  icon,
  href,
  badge,
  progressFor,
  loading,
}: {
  title: string;
  items?: CardItem[];
  icon?: React.ReactNode;
  href?: string;
  badge?: string;
  progressFor?: (item: CardItem) => number | undefined;
  loading?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    scroller.current?.scrollBy({ left: dir * Math.min(scroller.current.clientWidth * 0.85, 800), behavior: "smooth" });
  };

  return (
    <section className="group/row py-3" aria-label={title}>
      <div className="mb-3 flex items-center justify-between px-4 sm:px-6">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight sm:text-lg">
          {icon}
          {title}
          {href && (
            <a href={href} className="text-xs font-normal text-muted-foreground hover:text-foreground">
              More →
            </a>
          )}
        </h2>
        <div className="hidden gap-1 sm:flex">
          <Button variant="outline" size="icon" className="h-7 w-7" aria-label={`Scroll ${title} left`} onClick={() => scrollBy(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" aria-label={`Scroll ${title} right`} onClick={() => scrollBy(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {loading || !items ? (
        <CardRowSkeleton />
      ) : items.length === 0 ? (
        <p className="px-4 text-sm text-muted-foreground sm:px-6">Nothing here right now — check back soon.</p>
      ) : (
        <div
          ref={scroller}
          className="no-scrollbar flex snap-x gap-3 overflow-x-auto scroll-smooth px-4 pb-2 sm:px-6"
        >
          {items.map((item, i) => (
            <div key={`${item.slug || item.title}-${i}`} className="snap-start">
              <AnimeCard
                item={item}
                index={i}
                badge={badge}
                progress={progressFor?.(item)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
