"use client";

 

/**
 * Remote anime imagery is served from many CDNs (anipix, anilist, tmdb, …)
 * so we bypass next/image optimization and handle loading/error states
 * ourselves — skeleton while loading, gradient placeholder on error.
 */
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PosterImage({
  src,
  alt,
  className,
  aspect = "poster",
  eager = false,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  aspect?: "poster" | "banner" | "square";
  eager?: boolean;
}) {
  const [state, setState] = useState<"loading" | "ok" | "error">(src ? "loading" : "error");
  const [lastSrc, setLastSrc] = useState<string | null | undefined>(src);

  // Adjust state during render when the source changes (React-recommended).
  if (src !== lastSrc) {
    setLastSrc(src);
    setState(src ? "loading" : "error");
  }

  const aspectClass =
    aspect === "poster" ? "aspect-[2/3]" : aspect === "banner" ? "aspect-[16/7]" : "aspect-square";

  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-muted", aspectClass, className)}>
      {state === "loading" && <div className="skeleton-shimmer absolute inset-0" aria-hidden />}
      {state === "error" && (
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center bg-muted"
        >
          <span className="px-2 text-center text-sm font-bold text-white/90 drop-shadow">
            {alt.slice(0, 24)}
          </span>
        </div>
      )}
      {src && (
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-500",
            state === "ok" ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </div>
  );
}

export function PosterSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton className="aspect-[2/3] w-full rounded-lg" />
      <Skeleton className="h-3.5 w-4/5" />
      <Skeleton className="h-3 w-2/5" />
    </div>
  );
}

export function CardRowSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden px-4 sm:px-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[130px] shrink-0 sm:w-[150px]">
          <PosterSkeleton />
        </div>
      ))}
    </div>
  );
}
