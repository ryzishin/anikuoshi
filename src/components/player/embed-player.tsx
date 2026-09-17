"use client";

 

/**
 * Embed player — iframe with proper referrer policy.
 *
 * FIX (v1.3.0 — §4): the `sandbox` attribute is REMOVED entirely — several
 * providers (megaplay /videojs/ pages included) refuse to boot under the
 * old allow-list, which surfaced as an endless black frame; without it the
 * provider player runs normally while our referrer policy still applies.
 * The loading state uses the new wiggle-ellipsis loader (no circle spinner).
 */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Maximize, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EllipsisLoader } from "@/components/layout/logo";

export function EmbedPlayer({
  src,
  title,
  onError,
  onProgress,
  onEnded,
}: {
  src: string;
  title: string;
  onError: (reason: "blocked" | "timeout") => void;
  onProgress?: (seconds: number) => void;
  onEnded?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let slowTimer: ReturnType<typeof setTimeout>;
    // async microtask so we don't setState synchronously in the effect body
    const raf = requestAnimationFrame(() => {
      setLoaded(false);
      setSlow(false);
      slowTimer = setTimeout(() => setSlow(true), 12_000);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(slowTimer);
    };
  }, [src]);

  // Providers rarely postMessage, but if they do: accept progress + end.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!src.includes(new URL(e.origin).host)) return;
      const d = e.data as { event?: string; time?: number } | string;
      if (typeof d === "string") return;
      if (d.event === "timeupdate" && typeof d.time === "number") onProgress?.(d.time);
      if (d.event === "ended") onEnded?.();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [src, onProgress, onEnded]);

  return (
    <div ref={wrapRef} className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
          {slow ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertTriangle className="h-7 w-7 text-amber-400" />
              <p className="max-w-xs text-sm text-muted-foreground">
                This embed is slow to respond. You can wait a little longer or switch to another
                server.
              </p>
              <Button size="sm" variant="outline" onClick={() => onError("timeout")}>
                <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Try another server
              </Button>
            </div>
          ) : (
            <EllipsisLoader size={1.2} label="Loading embed…" />
          )}
        </div>
      )}
      <iframe
        key={src}
        src={src}
        title={`Embed player — ${title}`}
        className="absolute inset-0 h-full w-full border-0"
        allowFullScreen
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        referrerPolicy="origin"
        onLoad={() => setLoaded(true)}
        onError={() => onError("blocked")}
      />
      {loaded && (
        <Button
          variant="secondary"
          size="icon"
          aria-label="Fullscreen embed"
          className="absolute right-2 top-2 z-10 opacity-70 hover:opacity-100"
          onClick={() => {
            const el = wrapRef.current;
            if (!el) return;
            if (document.fullscreenElement) document.exitFullscreen();
            else el.requestFullscreen?.().catch(() => {});
          }}
        >
          <Maximize className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
