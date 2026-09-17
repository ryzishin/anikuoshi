"use client";

/**
 * Stream orchestration hook — the heart of the watch page.
 *
 * Implements the required fallback chain:
 *
 *   load streams (/api/watch, type=all)          [fresh tokens every call]
 *     -> pick best direct stream (preferred audio type first)
 *     -> on failure: silent refresh (re-call API) and retry same stream once
 *     -> still failing: try next stream (same audio type preferred)
 *     -> embed-only left?  switch to embed player
 *     -> nothing left:     error card w/ retry + report
 *
 * Every caller-visible transition emits a non-blocking toast and preserves
 * playback position / volume / rate / subtitle language across switches.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { watch, type Stream } from "@/lib/api";

export type AudioPref = "sub" | "dub" | "system";

export type PlayerPhase =
  | "idle" // initial
  | "loading" // fetching streams
  | "refreshing" // silent token refresh + retry
  | "direct" // playing via HLS/direct
  | "embed" // playing via iframe
  | "exhausted"; // everything failed

export type FailureReason = "403" | "network" | "decode" | "stall" | "timeout" | "empty" | null;

export function orderStreams(streams: Stream[], pref: AudioPref): Stream[] {
  const score = (s: Stream) => {
    const type = (s.type || "sub").toLowerCase();
    let v = 0;
    if (s.kind === "direct") v -= 100; // direct first
    if (pref === "dub" && type === "dub") v -= 50;
    else if (pref === "dub" && type === "sub") v -= 10;
    else if (type === "sub") v -= 50;
    else if (type === "dub") v -= 10;
    return v;
  };
  return [...streams].sort((a, b) => score(a) - score(b));
}

export function useStreamLoader(opts: {
  animeKey: string;
  episode: number;
  audioPref: AudioPref;
  /** bump to force a silent refresh (token refresh path) */
  refreshNonce: number;
}) {
  const { animeKey, episode, audioPref, refreshNonce } = opts;

  const [streams, setStreams] = useState<Stream[]>([]);
  const [phase, setPhase] = useState<PlayerPhase>("idle");
  const [activeIdx, setActiveIdx] = useState(0);
  const [failure, setFailure] = useState<FailureReason>(null);
  const [refreshAttempts, setRefreshAttempts] = useState(0);

  const ordered = useMemo(() => orderStreams(streams, audioPref), [streams, audioPref]);
  const activeStream = ordered[activeIdx] ?? null;

  /** initial load — always a fresh API call (fresh CDN tokens) */
  const load = useCallback(
    async (opts2?: { silent?: boolean }) => {
      setPhase(opts2?.silent ? "refreshing" : "loading");
      try {
        const list = await watch(animeKey, episode, "all");
        if (!list.length) {
          setStreams([]);
          setFailure("empty");
          setPhase("exhausted");
          return;
        }
        setStreams(list);
        setRefreshAttempts(0);
        setFailure(null);
        const first = orderStreams(list, audioPref)[0];
        setActiveIdx(0);
        setPhase(first.kind === "embed" ? "embed" : "direct");
      } catch (err) {
        setStreams([]);
        setFailure(err instanceof Error && /timed out/i.test(err.message) ? "timeout" : "network");
        setPhase("exhausted");
      }
    },
    [animeKey, episode, audioPref]
  );

  // initial + episode/key change
  useEffect(() => {
    load();
     
  }, [animeKey, episode]);

  // token refresh nonce (user-triggered or watchdog)
  useEffect(() => {
    if (refreshNonce === 0) return;
    (async () => {
      // Re-call API for fresh tokens, retry the SAME stream slot silently.
      try {
        const list = await watch(animeKey, episode, "all");
        if (list.length) {
          setStreams(list);
          setPhase((p) => (p === "exhausted" ? "direct" : p));
          setFailure(null);
          setActiveIdx((i) => Math.min(i, list.length - 1));
          if (!list.some((s) => s.kind === "direct") && ordered[activeIdx]?.kind === "embed") {
            setPhase("embed");
          }
          return;
        }
      } catch {
        /* fall through to failure */
      }
      setFailure("network");
      setPhase("exhausted");
    })();
     
  }, [refreshNonce]);

  /** switch to a specific stream index (server panel) */
  const switchTo = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= ordered.length) return;
      const s = ordered[idx];
      setActiveIdx(idx);
      setPhase(s.kind === "embed" ? "embed" : "direct");
      setFailure(null);
      toast.message(s.kind === "embed" ? "Switching to embed server…" : "Switching server…", {
        description: `${s.provider}${s.originalName ? ` (${s.originalName})` : ""} · ${(s.type || "sub").toUpperCase()}`,
      });
    },
    [ordered]
  );

  /** advance to the next candidate stream; returns false when exhausted */
  const advance = useCallback(
    (reason: FailureReason): boolean => {
      setFailure(reason);
      const nextIdx = activeIdx + 1;
      if (nextIdx < ordered.length) {
        const s = ordered[nextIdx];
        setActiveIdx(nextIdx);
        setPhase(s.kind === "embed" ? "embed" : "direct");
        toast.message("Switching server…", {
          description: `${s.provider}${s.originalName ? ` (${s.originalName})` : ""} · ${(s.type || "sub").toUpperCase()}`,
        });
        return true;
      }
      setPhase("exhausted");
      return false;
    },
    [activeIdx, ordered]
  );

  /**
   * Failure entry point used by the video element / hls.js:
   * first failure -> one silent refresh (fresh tokens), then advance.
   */
  const reportFailure = useCallback(
    (reason: FailureReason) => {
      if (refreshAttempts < 1 && streams.length > 0) {
        setRefreshAttempts((n) => n + 1);
        setPhase("refreshing");
        toast.message("Refreshing stream…", { description: "Fresh token requested — one moment." });
        // The /api/watch response is cached only 60s server-side; a direct
        // re-call yields fresh proxiedUrl (the API proxy re-tokenizes every hop).
        watch(animeKey, episode, "all")
          .then((list) => {
            if (list.length) {
              setStreams(list);
              setPhase((p) => (p === "embed" ? "embed" : "direct"));
              // bump a key on the consumer side via failure reset
              setFailure(null);
              window.dispatchEvent(new CustomEvent("anikuoshi:stream-refreshed"));
            } else {
              advance(reason);
            }
          })
          .catch(() => advance(reason));
        return;
      }
      advance(reason);
    },
    [refreshAttempts, streams.length, animeKey, episode, advance]
  );

  return {
    streams: ordered,
    activeStream,
    activeIdx,
    phase,
    failure,
    load,
    switchTo,
    advance,
    reportFailure,
  };
}
