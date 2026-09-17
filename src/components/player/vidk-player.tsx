"use client";

/**
 * Vidk player — AniKuoshi player option #3.
 *
 * Built on the Vidstack media library (`@vidstack/react`) — "Vidk" is the
 * in-app name for this engine. Ships its own accessible control bar, HLS
 * provider, captions support and mobile gestures. Receives cross-player
 * playback state so switches from Senshi/Plyr continue seamlessly, and
 * reports time/ended/errors back to the engine so the fallback chain and
 * auto-next countdown keep working.
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

export type VidkPlayerProps = {
  src: string;
  poster?: string | null;
  title: string;
  startAt: number;
  startRate: number;
  startVolume: number;
  startMuted: boolean;
  subtitles: SubtitleTrack[];
  onTime: (seconds: number, duration: number) => void;
  onEnded: () => void;
  onError: () => void;
  onSeekBridge: (fn: ((t: number) => void) | null) => void;
};

export default function VidkPlayer({
  src,
  poster,
  title,
  startAt,
  startRate,
  startVolume,
  startMuted,
  subtitles,
  onTime,
  onEnded,
  onError,
  onSeekBridge,
}: VidkPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  // keep latest cross-state handlers without re-creating the player
  // FIX (v1.1.1): ref writes must happen in an effect, not during render
  // (React compiler rule; also avoids torn state under concurrent rendering).
  const cbRef = useRef({ onTime, onEnded, onError });
  useEffect(() => {
    cbRef.current = { onTime, onEnded, onError };
  });

  useEffect(() => {
    onSeekBridge((t: number) => {
      const p = playerRef.current;
      if (p && isFinite(t)) p.currentTime = Math.max(0, t);
    });
    return () => onSeekBridge(null);
  }, [onSeekBridge]);

  return (
    <MediaPlayer
      ref={playerRef}
      className="h-full w-full"
      src={{ src, type: "application/x-mpegurl" }}
      title={title}
      viewType="video"
      streamType="on-demand"
      playsInline
      load="visible"
      posterLoad="eager"
      storage="anikuoshi-vidk"
      onCanPlay={() => {
        const p = playerRef.current;
        if (!p) return;
        if (startAt > 0 && isFinite(p.duration)) {
          p.currentTime = Math.min(startAt, Math.max(0, p.duration - 5));
        }
        p.playbackRate = startRate;
        if (!startMuted) p.volume = startVolume;
        p.muted = startMuted;
        p.play().catch(() => {});
      }}
      onTimeUpdate={(e) => {
        const d = (e as unknown as { detail?: { currentTime?: number } }).detail;
        if (typeof d?.currentTime === "number") cbRef.current.onTime(d.currentTime, playerRef.current?.duration ?? 0);
      }}
      onEnded={() => cbRef.current.onEnded()}
      onError={() => cbRef.current.onError()}
    >
      <MediaProvider>
        {poster ? <VdkPoster className="vds-poster" src={poster} alt={title} /> : null}
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
