"use client";

/**
 * AniKuoshi player engine — v1.3.0.
 *
 * FIX (v1.3.0 — §4): Senshi and Plyr are REMOVED. Two engines remain:
 *   - Vidk  (Vidstack)  — direct HLS playback, captions, gestures
 *   - Embed (iframe)    — for streams that only expose embedUrl
 * hls.js is no longer imported at all (Vidstack ships its own HLS engine),
 * which cuts a large chunk off the watch-page bundle.
 *
 * Preserved contracts:
 * - Fresh CDN tokens: EVERY switch re-calls /api/watch (useStreamLoader)
 * - Position/volume/rate/subtitle survive server + episode switches where
 *   technically possible (cross-player bridge + per-mount startAt)
 * - Toggling Auto-play / Auto-next / Auto-skip NEVER restarts playback —
 *   the toggles only flip prefs; the player instance is untouched
 * - Fallback chain: direct → silent token refresh → next server → embed →
 *   clean empty/error states
 * - Progress sync (15s throttle + milestone flush + pagehide/pagehide flush)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  MonitorPlay,
  Play,
  RefreshCcw,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EllipsisLoader } from "@/components/layout/logo";
import { EmbedPlayer } from "./embed-player";
import { ServerPanel } from "./server-panel";
import { useStreamLoader, type AudioPref, type PlayerPhase } from "./use-stream-loader";
import { usePreferences } from "@/components/preferences-provider";
import { subtitleProxyUrl, type SubtitleTrack } from "@/lib/api";

/** FIX (v1.3.0 — §4): only the two wanted engines remain. */
export type PlayerTypeId = "vidk" | "iframe";

export const PLAYER_TYPES: { id: PlayerTypeId; label: string; hint: string }[] = [
  { id: "vidk", label: "Vidk", hint: "Vidk player (Vidstack) — direct HLS with captions and gestures" },
  { id: "iframe", label: "Embed", hint: "Provider embed — for streams that only expose a player page" },
];

function AltPlayerSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
      <EllipsisLoader label="Loading player…" />
    </div>
  );
}

/** Lazy-mounted Vidk engine (Vidstack needs a real DOM element). */
const VidkEngine = dynamic(() => import("./vidk-player"), { ssr: false, loading: () => <AltPlayerSkeleton /> });

export type PlayerControls = {
  togglePlay: () => void;
  seek: (t: number) => void;
  seekBy: (delta: number) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  getVolume: () => number;
  isMuted: () => boolean;
  getDuration: () => number;
  getCurrentTime: () => number;
};

export type EngineProps = {
  animeKey: string;
  animeTitle: string;
  /** current episode's title for the under-player strip (marquee when long) */
  episodeTitle?: string | null;
  /** episode thumbnail (v2.4.0 enrichment chain) falling back to series poster */
  poster?: string | null;
  episode: number;
  audioPref: AudioPref;
  ambient?: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onEpisodeChange: (ep: number) => void;
  /** §7: signed-in users resume the exact saved timestamp for THIS episode */
  resumeAt?: number;
  /** §4/§9: episode or series not aired yet — render the clean unaired state */
  notAired?: boolean;
};

type SavedPlayback = { time: number; rate: number; volume: number; muted: boolean };

export function PlayerEngine(props: EngineProps) {
  const {
    animeKey, animeTitle, episodeTitle, poster, episode, audioPref,
    ambient, hasPrev, hasNext, onEpisodeChange, notAired,
  } = props;

  /**
   * FIX (v1.1.2/v1.3.0): playback behaviour toggles live in the preferences
   * store. Semantics locked:
   *   autoplay  → start playback automatically after a server/episode switch
   *   auto-next → switch to the next episode at true end-of-playback
   *   auto-skip → seek past intro/outro windows via skipIntro data
   * Toggling any of these NEVER resets playback — they only flip prefs.
   */
  const { prefs, setPref } = usePreferences();
  const autoplayNext = prefs.autoplayNext !== false;
  const autoplay = prefs.autoplay !== false;
  const autoSkip = prefs.autoSkip === true;
  const providerPref = prefs.defaultProvider || "system";

  const [refreshNonce, setRefreshNonce] = useState(0);
  const loader = useStreamLoader({ animeKey, episode, audioPref, providerPref, refreshNonce });
  const { streams, activeStream, activeIdx, phase, failure } = loader;

  /** flips true once THIS episode started playing — late resume data must not yank position */
  const playbackStartedRef = useRef(false);

  /* -------------------------------------------------- player type state */

  const [playerType, setPlayerTypeRaw] = useState<PlayerTypeId>("vidk");
  const [embedForced, setEmbedForced] = useState(false);
  const [embedFailed, setEmbedFailed] = useState(false);

  /**
   * Cross-engine playback state — written continuously by the active engine
   * so switching Vidk ↔ Embed (and back) resumes at the same second with the
   * same volume/rate.
   */
  const crossRef = useRef({ time: 0, rate: 1, volume: 1, muted: false });
  const seekBridgeRef = useRef<((t: number) => void) | null>(null);
  const controlsRef = useRef<PlayerControls | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("anikuoshi.playerType");
      if (saved === "vidk" || saved === "iframe") setPlayerTypeRaw(saved);
    } catch {}
    // the Settings default wins over the per-device last choice
    const prefDefault = prefs.defaultPlayer;
    if (prefDefault === "vidk" || prefDefault === "iframe") setPlayerTypeRaw(prefDefault);
  }, [prefs.defaultPlayer]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const seekRestoreRef = useRef<number | null>(null);
  const lastSyncRef = useRef(0);
  /** progress-stall watchdog state (playing but zero progress for ~12s) */
  const lastProgressAtRef = useRef(Date.now());
  const playingRef = useRef(false);
  /** FIX (v1.2.0 §7/v1.3.0): render-scope reset for the cross-engine bridge. */
  const scopeNow = `${animeKey}:${episode}`;
  const scopeNowRef = useRef(scopeNow);
  scopeNowRef.current = scopeNow;
  const crossScopeRef = useRef(scopeNow);
  if (crossScopeRef.current !== scopeNow) {
    crossScopeRef.current = scopeNow;
    crossRef.current.time = 0;
  }

  /**
   * Current time — drives the auto-skip windows and provider chips.
   * Updates arrive from the active engine's time reporter (~4 Hz).
   */
  const [time, setTime] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  /* --------------------------------------------- switch + embed fallback */

  /** User-initiated switch: persist choice + snapshot playback state. */
  const changePlayerType = useCallback((t: PlayerTypeId) => {
    if (t === playerType) return;
    // snapshot the live engine state before the media element changes
    const c = controlsRef.current;
    if (c) {
      const now = c.getCurrentTime();
      if (now > 0) crossRef.current.time = now;
      crossRef.current.volume = c.getVolume();
      crossRef.current.muted = c.isMuted();
    }
    setEmbedForced(false);
    setPlayerTypeRaw(t);
    try { localStorage.setItem("anikuoshi.playerType", t); } catch {}
  }, [playerType]);

  const currentType = PLAYER_TYPES.find((t) => t.id === playerType) ?? PLAYER_TYPES[0];
  const nextType = PLAYER_TYPES[(PLAYER_TYPES.findIndex((t) => t.id === playerType) + 1) % PLAYER_TYPES.length];
  const cyclePlayerType = useCallback(() => {
    changePlayerType(nextType.id);
  }, [changePlayerType, nextType]);

  const embedCandidate = useMemo(() => streams.find((s) => s.embedUrl) ?? null, [streams]);
  const embedSrc = activeStream?.embedUrl || embedCandidate?.embedUrl || null;

  // Fallback chain tail: every direct stream failed (or the episode only has
  // embed servers) → use the embed engine before showing the error card.
  useEffect(() => {
    if ((phase === "exhausted" || phase === "embed") && embedSrc && playerType !== "iframe") {
      setEmbedFailed(false);
      setEmbedForced(true);
      setPlayerTypeRaw("iframe");
    }
  }, [phase, embedSrc, playerType]);

  // A silent refresh recovered direct streams while the embed fallback was
  // active → hand control back to Vidk automatically.
  useEffect(() => {
    if (embedForced && phase === "direct" && playerType === "iframe") {
      setEmbedForced(false);
      setPlayerTypeRaw("vidk");
    }
  }, [phase, embedForced, playerType]);

  useEffect(() => {
    setEmbedFailed(false);
  }, [embedSrc, playerType]);

  /* ------------------------------------------------ resume + guest save */

  useEffect(() => {
    // seek target: server progress (signed-in) takes priority; guest/localStorage
    // resume for this key+ep is the fallback. FIX (v1.1.2): clear FIRST so a
    // stale restore point never leaks across episodes.
    seekRestoreRef.current = null;
    if (playbackStartedRef.current) return;
    if (props.resumeAt !== undefined && props.resumeAt > 30) {
      seekRestoreRef.current = props.resumeAt;
      return;
    }
    try {
      const raw = localStorage.getItem("anikuoshi.guestProgress");
      if (raw) {
        const map = JSON.parse(raw) as Record<string, { ep: number; t: number }>;
        const entry = map[animeKey];
        if (entry && entry.ep === episode && entry.t > 30) seekRestoreRef.current = entry.t;
      }
    } catch {}
  }, [animeKey, episode, props.resumeAt]);

  useEffect(() => {
    playbackStartedRef.current = false;
    lastProgressAtRef.current = Date.now();
    playingRef.current = false;
  }, [animeKey, episode]);

  /**
   * FIX (v1.3.0 — §6): the flush-on-hide path used to capture the FIRST
   * render's syncProgress (empty dependency array → stale closure), so a
   * pagehide after an episode switch flushed the position onto the WRONG
   * episode. latestRef keeps the flush pointed at the live key/episode.
   */
  const latestRef = useRef({ animeKey, animeTitle, poster, episode, sync: null as null | ((s: number, d: number, f?: boolean) => void) });
  latestRef.current = { animeKey, animeTitle, poster, episode, sync: null };

  const syncProgress = useCallback(
    (seconds: number, dur: number, force = false) => {
      const now = Date.now();
      if (!force && now - lastSyncRef.current < 15_000) return;
      lastSyncRef.current = now;
      // guest fallback always — entries carry title/poster/duration + a
      // timestamp so /history can render cards with progress bars
      try {
        const raw = localStorage.getItem("anikuoshi.guestProgress") || "{}";
        const map = JSON.parse(raw) as Record<string, {
          ep: number; t: number; title?: string; poster?: string | null; dur?: number; at?: number;
        }>;
        map[animeKey] = {
          ep: episode, t: seconds,
          title: animeTitle, poster: poster ?? null,
          dur: dur || map[animeKey]?.dur || 0,
          at: Date.now(),
        };
        localStorage.setItem("anikuoshi.guestProgress", JSON.stringify(map));
      } catch {}
      if (!(navigator.onLine ?? true)) return;
      fetch("/api/user/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animeKey, animeTitle, poster, episode,
          positionSeconds: seconds, durationSeconds: dur,
        }),
      }).catch(() => {});
    },
    [animeKey, animeTitle, poster, episode]
  );
  latestRef.current.sync = syncProgress;

  /** Alt-engine time reporter → keeps progress sync + skip overlays live. */
  const handleAltTime = useCallback(
    (seconds: number, dur: number) => {
      // discard late reports that belonged to a previous episode
      if (crossScopeRef.current !== scopeNowRef.current) return;
      if (seconds > 2) playbackStartedRef.current = true;
      if (playingRef.current) lastProgressAtRef.current = Date.now();
      crossRef.current.time = seconds;
      setTime(seconds);
      syncProgress(seconds, dur);
    },
    [syncProgress]
  );

  const handleAltPlay = useCallback(() => {
    playingRef.current = true;
    lastProgressAtRef.current = Date.now();
  }, []);
  const handleAltPause = useCallback(() => {
    playingRef.current = false;
    if (controlsRef.current) syncProgress(controlsRef.current.getCurrentTime(), controlsRef.current.getDuration(), true);
  }, [syncProgress]);

  /* --------------------------------------------------- stall watchdog */

  useEffect(() => {
    if (phase !== "direct") return;
    const timer = setInterval(() => {
      if (document.hidden || !playingRef.current) return;
      if (Date.now() - lastProgressAtRef.current > 12_000) {
        lastProgressAtRef.current = Date.now();
        toast.message("Stream stalled — refreshing…", { description: "Re-tokenizing playback." });
        setRefreshNonce((n) => n + 1);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [phase]);

  // flush progress on unmount / tab hide / page hide — via latestRef
  useEffect(() => {
    const flush = () => {
      const cur = latestRef.current;
      if (!cur.sync) return;
      let seconds = 0;
      let dur = 0;
      if (controlsRef.current) {
        seconds = controlsRef.current.getCurrentTime();
        dur = controlsRef.current.getDuration();
      }
      if (seconds > 0) cur.sync(seconds, dur, true);
    };
    const onHide = () => document.visibilityState === "hidden" && flush();
    // `pagehide` also flushes — it fires on close/navigate/mobile app switch
    const onPageHide = () => flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flush();
    };
  }, []);

  /* ---------------------------------------------------- subtitle tracks */

  const subtitleTracks = activeStream?.subtitles ?? [];

  /**
   * FIX (v1.3.0 — §4): deterministic default subtitle selection. Priority:
   *   1. the stream's own `default: true` track
   *   2. an English track ("eng" / label contains "english")
   *   3. the first track
   * Selection/re-selection happens in the player's captions menu.
   */
  const subtitlesWithDefault = useMemo<SubtitleTrack[]>(() => {
    if (!subtitleTracks.length) return subtitleTracks;
    const withProxy = subtitleTracks
      .map((s) => ({ ...s, url: subtitleProxyUrl(s) || s.url }))
      .filter((s) => Boolean(s.url));
    if (!withProxy.length) return withProxy;
    const apiDefault = withProxy.findIndex((s) => s.default);
    const engIdx = withProxy.findIndex(
      (s) => s.language === "eng" || s.language === "en" || /english/i.test(s.label)
    );
    const chosen = apiDefault >= 0 ? apiDefault : engIdx >= 0 ? engIdx : 0;
    return withProxy.map((s, i) => ({ ...s, default: i === chosen }));
  }, [subtitleTracks]);

  /* ------------------------------------------------------- keyboard etc. */

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /**
   * FIX (v1.3.0 — §1): SHORTCUT AUDIT.
   *  - media actions route through the controls bridge (works with Vidk,
   *    no-ops for Embed where the provider owns the controls)
   *  - the old "s" (server panel toggle) is gone — the panel is always visible
   *  - conflicts fixed: ignore shortcuts with ctrl/alt/meta held, and never
   *    hijack Space/Enter when a button/link/checkbox has focus (Space used
   *    to BOTH click the focused button and toggle playback)
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement;
      if ((["INPUT", "TEXTAREA", "SELECT"] as string[]).includes(target.tagName) || target.isContentEditable) return;
      if (e.key === " " || e.key === "Enter") {
        // let focused buttons/links behave normally
        if (target.closest("button, a, [role='button'], [role='switch'], [role='tab']")) return;
      }
      const c = controlsRef.current;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          c?.togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          c?.seekBy(5);
          break;
        case "ArrowLeft":
          e.preventDefault();
          c?.seekBy(-5);
          break;
        case "l":
          c?.seekBy(10);
          break;
        case "j":
          c?.seekBy(-10);
          break;
        case "ArrowUp":
          e.preventDefault();
          if (c) c.setVolume(Math.min(1, c.getVolume() + 0.05));
          break;
        case "ArrowDown":
          e.preventDefault();
          if (c) c.setVolume(Math.max(0, c.getVolume() - 0.05));
          break;
        case "m":
          if (c) c.setMuted(!c.isMuted());
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "n":
          if (hasNext) onEpisodeChange(episode + 1);
          break;
        case "p":
          if (hasPrev) onEpisodeChange(episode - 1);
          break;
        default:
          if (/^[0-9]$/.test(e.key) && c) {
            const dur = c.getDuration();
            if (dur) c.seek((Number(e.key) / 10) * dur);
          }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen, hasNext, hasPrev, episode, onEpisodeChange]);

  /** resume point for the mounted engine (cross-player state bridge) */
  const altStart = crossRef.current.time > 0 ? crossRef.current.time : seekRestoreRef.current ?? 0;

  // AUTO-SKIP — seeks past intro/outro once per window, via the seek bridge.
  // Driven by `time` (the engine's time reporter) so it re-evaluates as the
  // playhead crosses a window; works for both Vidk and (bridge-less) never
  // for Embed — providers own their own timelines there.
  const skip = activeStream?.skipIntro;
  const inIntro = Boolean(skip?.intro && time >= skip.intro.start && time <= skip.intro.end);
  const inOutro = Boolean(skip?.outro && time >= skip.outro.start && time <= skip.outro.end);
  const autoSkipKeyRef = useRef("");
  useEffect(() => {
    if (!autoSkip || playerType !== "vidk" || phase !== "direct") return;
    const windowKind = inIntro ? "intro" : inOutro ? "outro" : null;
    if (!windowKind) return;
    const key = `${animeKey}:${episode}:${windowKind}`;
    if (autoSkipKeyRef.current === key) return;
    autoSkipKeyRef.current = key;
    const target = inIntro ? skip?.intro?.end : skip?.outro?.end;
    if (typeof target === "number") {
      const c = controlsRef.current;
      if (c) c.seek(target + 0.5);
      else seekBridgeRef.current?.(target + 0.5);
    }
  }, [inIntro, inOutro, autoSkip, playerType, phase, animeKey, episode, skip?.intro?.end, skip?.outro?.end]);

  /* ------------------------------------------------------------ render */

  const showPlayerArea = !notAired;

  return (
    <div className="w-full">
      <div
        ref={wrapRef}
        className={`relative aspect-video w-full select-none overflow-hidden rounded-xl bg-black ${
          ambient ? "shadow-[0_0_80px_-12px_var(--surface-glow)]" : ""
        }`}
        data-testid="player-shell"
      >
        {/* ambient backdrop */}
        {ambient && poster && showPlayerArea && (
          <div
            aria-hidden
            className="absolute inset-0 scale-125 bg-cover bg-center opacity-25 blur-3xl"
            style={{ backgroundImage: `url(${poster})` }}
          />
        )}

        {/* ---------------- §9: NOT AIRED — clean state, no player, no CTA */}
        {notAired && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-6">
            <div className="max-w-sm text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-white/70" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Not aired yet</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Episode {episode} hasn&apos;t aired. Come back after the release date — it will
                appear here automatically.
              </p>
            </div>
          </div>
        )}

        {/* ---------------- Vidk engine (direct streams) ---------------- */}
        {showPlayerArea && playerType === "vidk" && phase === "direct" && (activeStream?.proxiedUrl || activeStream?.url) && (
          <div className="absolute inset-0">
            <VidkEngine
              key={`vidk:${animeKey}:${episode}:${activeIdx}:${refreshNonce}:${activeStream?.proxiedUrl || activeStream?.url}`}
              src={activeStream!.proxiedUrl || activeStream!.url!}
              poster={poster ?? null}
              title={animeTitle}
              startAt={altStart}
              startRate={crossRef.current.rate || 1}
              startVolume={crossRef.current.volume || 1}
              startMuted={crossRef.current.muted || false}
              autoPlay={autoplay}
              subtitles={subtitlesWithDefault}
              onTime={handleAltTime}
              onPlay={handleAltPlay}
              onPause={handleAltPause}
              onEnded={() => {
                syncProgress(0, 0, true);
                if (autoplayNext && hasNext) onEpisodeChange(episode + 1);
              }}
              onError={() => loader.reportFailure("decode")}
              onSeekBridge={(fn) => (seekBridgeRef.current = fn)}
              onControls={(c) => (controlsRef.current = c)}
            />
          </div>
        )}

        {/* ---------------- embed (user-selected or fallback tail) ---------------- */}
        {showPlayerArea && playerType === "iframe" && embedSrc && (
          <div className="absolute inset-0 flex items-center justify-center">
            <EmbedPlayer
              key={embedSrc}
              src={embedSrc}
              title={animeTitle}
              onError={() => {
                if (phase === "exhausted") setEmbedFailed(true);
                else loader.reportFailure("network");
              }}
              onEnded={() => autoplayNext && hasNext && onEpisodeChange(episode + 1)}
            />
          </div>
        )}

        {/* ---------------- loading / refreshing — NEW wiggle-ellipsis loader ---------------- */}
        {showPlayerArea && (phase === "loading" || phase === "refreshing" || phase === "idle") && playerType !== "iframe" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70" data-testid="stream-loader">
            <EllipsisLoader label={phase === "refreshing" ? "Refreshing stream…" : "Resolving streams…"} />
          </div>
        )}

        {/* ---------------- §4: NO STREAMS — clean empty state ---------------- */}
        {showPlayerArea && phase === "exhausted" && failure === "empty" && !(playerType === "iframe" && embedSrc && !embedFailed) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-6" data-testid="no-stream-state">
            <div className="max-w-sm text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <Play className="h-5 w-5 text-white/60" />
              </div>
              <h3 className="text-lg font-semibold text-white">No stream available</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Servers haven&apos;t published episode {episode} yet. Check back soon — the
                episode usually appears shortly after airing.
              </p>
            </div>
          </div>
        )}

        {/* ---------------- exhausted: error card ---------------- */}
        {showPlayerArea && phase === "exhausted" && failure !== "empty" && !(playerType === "iframe" && embedSrc && !embedFailed) && (
          <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/85 p-6">
            <div className="max-w-md text-center">
              <h3 className="text-lg font-semibold text-white">
                {failure === "403" ? "Stream token expired" : "Stream unavailable"}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Every server for episode {episode} failed
                {failure ? ` (${failure})` : ""}. This is usually temporary — upstream tokens live
                ~90 seconds. Try a refresh, another server, or come back shortly.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button
                  className="border-0 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setRefreshNonce((n) => n + 1)}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" /> Retry
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/*
        FIX (v1.3.0 — §4): under-player strip — prev/next beside the SMALLER
        auto-play / auto-next / auto-skip toggles, anime name + episode
        title/number between them (marquee for long titles). The Show/Hide
        Servers button and the note row are REMOVED — the server panel below
        is always visible.
      */}
      <div className="mt-2 text-xs text-muted-foreground" data-testid="player-strip">
        <div className="flex flex-wrap items-center gap-2">
          {/* prev / next episode */}
          <button
            data-testid="strip-prev"
            aria-label="Previous episode"
            title="Previous episode (P)"
            disabled={!hasPrev}
            onClick={() => hasPrev && onEpisodeChange(episode - 1)}
            className="flex min-touch shrink-0 items-center gap-1 rounded-lg border border-border/70 bg-card/60 px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4 text-primary" /> Prev
          </button>
          <button
            data-testid="strip-next"
            aria-label="Next episode"
            title="Next episode (N)"
            disabled={!hasNext}
            onClick={() => hasNext && onEpisodeChange(episode + 1)}
            className="flex min-touch shrink-0 items-center gap-1 rounded-lg border border-border/70 bg-card/60 px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-40"
          >
            Next <ChevronRight className="h-4 w-4 text-primary" />
          </button>

          {/* full anime name + episode title/number — marquee on overflow */}
          <div className="min-w-0 flex-1" data-testid="strip-title">
            <MarqueeText
              className="text-xs font-semibold text-foreground"
              text={
                `${animeTitle} — EP ${episode}` +
                (episodeTitle ? ` · ${episodeTitle}` : "")
              }
            />
          </div>

          {/* playback toggles — compact; flipping NEVER restarts playback */}
          <div className="flex shrink-0 items-center gap-1" data-testid="player-toggles">
            <ToggleChip compact label="Auto play" active={autoplay} onToggle={() => setPref("autoplay", !autoplay)} />
            <ToggleChip compact label="Auto next" active={autoplayNext} onToggle={() => setPref("autoplayNext", !autoplayNext)} />
            <ToggleChip compact label="Auto skip" active={autoSkip} onToggle={() => setPref("autoSkip", !autoSkip)} />
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {phase === "direct" && activeStream && (
            <>
              <span className="rounded-md bg-muted px-2 py-1 font-medium">
                {activeStream.provider}
                {activeStream.originalName ? ` · ${activeStream.originalName}` : ""}
              </span>
              <span className="rounded-md bg-muted px-2 py-1 uppercase">{activeStream.type || "sub"}</span>
            </>
          )}

          {/* engine switcher — Vidk ↔ Embed */}
          <button
            data-testid="player-switcher"
            onClick={cyclePlayerType}
            aria-label={`Player engine: ${currentType.label}. Click to switch to ${nextType.label}`}
            title={`Player: ${currentType.label} — click for ${nextType.label}`}
            className="ml-auto flex min-touch items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
          >
            {playerType === "iframe" ? <Youtube className="h-3.5 w-3.5 text-primary" /> : <MonitorPlay className="h-3.5 w-3.5 text-primary" />}
            {currentType.label}
          </button>
        </div>
      </div>

      {/*
        FIX (v1.3.0 — §4): servers panel ALWAYS visible below the player.
        The Show/Hide toggle, the "panel hidden" card and the explanatory
        note are removed. Every selection re-calls /api/watch for a fresh
        CDN token before the stream loads.
      */}
      <div className="mt-3 scroll-mt-24 rounded-xl border border-border/70 bg-card/70 p-4 backdrop-blur" id="servers" data-testid="server-panel">
        <p className="mb-3 text-sm font-semibold">Servers for EP {episode}</p>
        <ServerPanel streams={streams} activeIdx={activeIdx} onSelect={(i) => loader.switchTo(i)} />
      </div>
    </div>
  );
}

/**
 * FIX (v1.1.2/v1.3.0): compact checkmark toggle chip for the under-player
 * strip (Auto play · Auto next · Auto skip). role="switch" + aria-checked.
 */
function ToggleChip({
  label, active, onToggle, compact,
}: { label: string; active: boolean; onToggle: () => void; compact?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={active}
      aria-label={`${label} ${active ? "on" : "off"}`}
      title={`${label}: ${active ? "on" : "off"}`}
      onClick={onToggle}
      className={`flex items-center gap-1 rounded-full border font-medium transition-colors ${
        compact ? "min-h-[28px] px-2 py-0.5 text-[10px]" : "min-touch gap-1.5 px-2.5 py-1 text-xs"
      } ${
        active
          ? "border-primary/40 bg-primary/15 text-foreground"
          : "border-border/70 bg-card/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      <span
        aria-hidden
        className={`flex items-center justify-center rounded-full border transition-colors ${
          compact ? "h-3 w-3" : "h-4 w-4"
        } ${
          active ? "border-transparent bg-primary text-primary-foreground" : "border-muted-foreground/40 text-transparent"
        }`}
      >
        <Check className={compact ? "h-2 w-2" : "h-3 w-3"} strokeWidth={3} />
      </span>
      {label}
    </button>
  );
}

/**
 * One-line marquee text. Renders the string verbatim; when it overflows its
 * box, the content duplicates and scrolls (CSS `animate-marquee`), so long
 * anime + episode titles stay fully readable without wrapping or clipping.
 */
function MarqueeText({ text, className }: { text: string; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  return (
    <div ref={boxRef} className={`min-w-0 overflow-hidden whitespace-nowrap ${className ?? ""}`} title={text}>
      {overflows ? (
        <span className="inline-block animate-marquee">
          <span className="pr-10">{text}</span>
          <span aria-hidden className="pr-10">{text}</span>
        </span>
      ) : (
        <span className="block truncate">{text}</span>
      )}
    </div>
  );
}
