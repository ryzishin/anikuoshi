"use client";

/**
 * Vidk player — AniKuoshi's primary engine (v1.3.0).
 *
 * Built on the Vidstack media library (`@vidstack/react`) — "Vidk" is the
 * in-app name for this engine. Ships its own accessible control bar, HLS
 * provider, captions support and mobile gestures.
 *
 * FIX (v1.3.0 — §4):
 *  - POSTER STRETCH FIXED: the poster now renders letterboxed
 *    (object-fit: contain, see `.vds-poster` in globals.css) instead of
 *    being stretched to the 16:9 shell. The watch page passes the EPISODE
 *    thumbnail (v2.4.0 enrichment chain: upstream → Kitsu → TMDB → series
 *    poster) so the art matches what's playing.
 *  - exposes a PlayerControls bridge (play/pause/seek/volume/mute) so the
 *    engine's keyboard shortcuts work without touching the DOM directly
 *  - subtitle tracks arrive with exactly one `default` flag already
 *    computed by the engine (API default → English → first)
 *  - reports play/pause to the engine for the stall watchdog + milestone sync
 */
import { useEffect, useRef } from "react";
import {
  MediaPlayer,
  MediaProvider,
  Poster as VdkPoster,
  Track,
  type MediaPlayerInstance,
} from "@vidstack/react";
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import type { SubtitleTrack } from "@/lib/api";
import type { PlayerControls } from "./player-engine";

export type VidkPlayerProps = {
  src: string;
  poster?: string | null;
  title: string;
  startAt: number;
  startRate: number;
  startVolume: number;
  startMuted: boolean;
  autoPlay: boolean;
  subtitles: SubtitleTrack[];
  onTime: (seconds: number, duration: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  onError: () => void;
  onSeekBridge: (fn: ((t: number) => void) | null) => void;
  onControls: (controls: PlayerControls | null) => void;
};

export default function VidkPlayer({
  src,
  poster,
  title,
  startAt,
  startRate,
  startVolume,
  startMuted,
  autoPlay,
  subtitles,
  onTime,
  onPlay,
  onPause,
  onEnded,
  onError,
  onSeekBridge,
  onControls,
}: VidkPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  /**
   * FIX (v1.3.0 — §4): resume semantics. For HLS the duration is often NOT
   * known at the first `canPlay` — v1.3.0's first draft marked the start-up
   * as done there and skipped the resume seek entirely, so a server switch
   * (or an auto-skip-triggered fallback remount) restarted at 0:00. The
   * start block now waits for metadata: whichever of `loadedmetadata` /
   * `canPlay` fires with a finite duration applies the seek + rate + volume
   * exactly once.
   */
  const startedRef = useRef(false);
  const startRef = useRef({ startAt, startRate, startVolume, startMuted, autoPlay });
  useEffect(() => {
    startRef.current = { startAt, startRate, startVolume, startMuted, autoPlay };
  });
  // keep latest callbacks without re-creating the player
  const cbRef = useRef({ onTime, onEnded, onError });
  useEffect(() => {
    cbRef.current = { onTime, onEnded, onError };
  });

  const applyStartPosition = () => {
    const p = playerRef.current;
    if (!p || startedRef.current) return;
    if (!isFinite(p.duration) || p.duration <= 0) return; // metadata not ready yet
    startedRef.current = true;
    const { startAt, startRate, startVolume, startMuted, autoPlay } = startRef.current;
    if (startAt > 0) {
      p.currentTime = Math.min(startAt, Math.max(0, p.duration - 5));
    }
    p.playbackRate = startRate || 1;
    p.volume = Math.max(0, Math.min(1, startVolume || 1));
    p.muted = startMuted;
    if (autoPlay) p.play().catch(() => {});
  };

  // seek bridge (skip intro/outro + keyboard percent jumps)
  useEffect(() => {
    onSeekBridge((t: number) => {
      const p = playerRef.current;
      if (p && isFinite(t)) p.currentTime = Math.max(0, t);
    });
    return () => onSeekBridge(null);
  }, [onSeekBridge]);

  // controls bridge — the engine's keyboard layer routes through here
  useEffect(() => {
    const controls: PlayerControls = {
      togglePlay: () => {
        const p = playerRef.current;
        if (!p) return;
        if (p.paused) p.play().catch(() => {});
        else p.pause();
      },
      seek: (t: number) => {
        const p = playerRef.current;
        if (p && isFinite(t)) p.currentTime = Math.max(0, t);
      },
      seekBy: (delta: number) => {
        const p = playerRef.current;
        if (p) p.currentTime = Math.max(0, p.currentTime + delta);
      },
      setVolume: (v: number) => {
        const p = playerRef.current;
        if (!p) return;
        p.muted = v <= 0;
        p.volume = Math.max(0, Math.min(1, v));
      },
      setMuted: (m: boolean) => {
        const p = playerRef.current;
        if (p) p.muted = m;
      },
      getVolume: () => playerRef.current?.volume ?? 1,
      isMuted: () => playerRef.current?.muted ?? false,
      getDuration: () => playerRef.current?.duration ?? 0,
      getCurrentTime: () => playerRef.current?.currentTime ?? 0,
    };
    onControls(controls);
    return () => onControls(null);
  }, [onControls]);

  return (
    <MediaPlayer
      ref={playerRef}
      className="h-full w-full ring-0 outline-none"
      src={{ src, type: "application/x-mpegurl" }}
      title={title}
      viewType="video"
      streamType="on-demand"
      playsInline
      load="visible"
      posterLoad="eager"
      autoPlay={autoPlay}
      storage="anikuoshi-vidk"
      onCanPlay={applyStartPosition}
      onLoadedMetadata={applyStartPosition}
      onTimeUpdate={(e) => {
        const d = (e as unknown as { detail?: { currentTime?: number } }).detail;
        if (typeof d?.currentTime === "number") cbRef.current.onTime(d.currentTime, playerRef.current?.duration ?? 0);
      }}
      onPlay={() => onPlay()}
      onPause={() => onPause()}
      onEnded={() => cbRef.current.onEnded()}
      onError={() => cbRef.current.onError()}
    >
      <MediaProvider>
        {poster ? (
          <VdkPoster className="vds-poster" src={poster} alt={title} />
        ) : null}
        {subtitles.map((sub, i) => (
          <Track
            key={`${sub.language}-${i}`}
            kind="subtitles"
            src={sub.url}
            label={sub.label}
            lang={sub.language}
            default={Boolean(sub.default)}
          />
        ))}
      </MediaProvider>
      <DefaultVideoLayout icons={defaultLayoutIcons} noScrubGesture={false} />
    </MediaPlayer>
  );
}
