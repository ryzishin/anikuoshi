"use client";

/**
 * Mounts a server-rendered (EJS) HTML fragment via htmx, processing the
 * node on mount so hx-* attributes work on dynamically mounted elements.
 */
import { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function HtmxFragment({
  url,
  fallback,
  className,
  height = 220,
}: {
  url: string;
  fallback?: React.ReactNode;
  className?: string;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;

    (async () => {
      try {
        // Prefer a manual fetch (deterministic); swap the fragment in.
        const res = await fetch(url);
        const html = await res.text();
        if (cancelled) return;
        el.innerHTML = html;
        el.dataset.fetched = "1";
        // Let htmx process any hx-* attributes inside the swapped content.
        const htmx = (window as unknown as { htmx?: { process: (el: Element) => void } }).htmx;
        htmx?.process(el);
      } catch {
        /* offline — fallback skeleton remains */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div ref={ref} className={className} data-fragment-height={height}>
      <div className="space-y-2.5" style={{ minHeight: height }} aria-busy="true">
        {fallback ?? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-12 rounded-md" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-6 w-10 rounded-full" />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
