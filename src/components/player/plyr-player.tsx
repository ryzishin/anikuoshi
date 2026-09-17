"use client";

/**
 * Plyr player — AniKuoshi player option #2.
 *
 * Plyr UI over hls.js for HLS sources (native HLS untouched on Safari).
 * Receives cross-player playback state (time / rate / volume / muted) so a
 * mid-episode switch from the Senshi player continues exactly where the
 * viewer left off. Reports time/ended/errors back to the engine so the
 * fallback chain and auto-next countdown keep working.
 */
import { useEffect, useRef } from "react";
import Hls from "hls.js";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import type { SubtitleTrack } from "@/lib/api";

export type PlyrPlayerProps = {
  src: string;
  isHls: boolean;
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
  /** register an imperative seek bridge so skip-intro/outro keeps working */
  onSeekBridge: (fn: ((t: number) => void) | null) => void;
};

export default function PlyrPlayer({
  src,
  isHls,
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
}: PlyrPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const plyrRef = useRef<Plyr | null>(null);
  /**
   * FIX (v1.2.0): keep the latest engine callbacks in a ref (the exact pattern
   * v1.1.1 applied to VidkPlayer). Plyr's listeners are bound once per `src`
   * — a plain closure captured the mount-time `onTime`, so after the anime
   * title resolved (or any other prop changed) the engine kept reporting time
   * through the STALE callback: watch-progress records stored the pre-resolution
   * title/poster and the 15 s throttle fought the fresh one. cbRef keeps the
   * listeners pointed at the live callbacks for the whole engine lifetime.
   */
  const cbRef = useRef({ onTime, onEnded, onError, onSeekBridge });
  useEffect(() => {
    cbRef.current = { onTime, onEnded, onError, onSeekBridge };
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let disposed = false;
    let plyr: Plyr | null = null;

    const boot = () => {
      if (disposed || plyrRef.current) return;
      plyr = new Plyr(video, {
        controls: [
          "play",
          "progress",
          "current-time",
          "duration",
          "mute",
          "volume",
          "settings",
          "pip",
          "airplay",
          "fullscreen",
        ],
        settings: ["speed", "captions"],
        speed: { selected: startRate, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        volume: startVolume,
        muted: startMuted,
        seekTime: 10,
        keyboard: { focused: true, global: true },
        tooltips: { controls: true, seek: true },
        i18n: { restart: "Restart", seek: "Seek", played: "Played", buffered: "Buffered" },
      });
      plyrRef.current = plyr;

      video.addEventListener("loadedmetadata", () => {
        if (startAt > 0 && isFinite(video.duration)) {
          video.currentTime = Math.min(startAt, Math.max(0, video.duration - 5));
        }
        video.playbackRate = startRate;
        video.play().catch(() => {});
      }, { once: true });

      video.addEventListener("timeupdate", () => cbRef.current.onTime(video.currentTime, video.duration || 0));
      video.addEventListener("ended", () => cbRef.current.onEnded());
      video.addEventListener("error", () => cbRef.current.onError());
      cbRef.current.onSeekBridge((t: number) => {
        if (isFinite(t)) video.currentTime = Math.max(0, t);
      });
    };

    const isHlsSrc = isHls || /\.m3u8(\?|$)/i.test(src);
    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";

    if (isHlsSrc && !nativeHls && Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 30, fragLoadingMaxRetry: 2 });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, boot);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) onError();
      });
    } else {
      video.src = src;
      boot();
    }

    return () => {
      disposed = true;
      cbRef.current.onSeekBridge(null);
      plyrRef.current?.destroy();
      plyrRef.current = null;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    // remount entirely when the source changes (fresh token per switch);
    // callbacks stay fresh via cbRef — do NOT add them here, the engine
    // passes inline arrows and they would remount the player every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <div className="plyr-host h-full w-full">
      <video ref={videoRef} className="h-full w-full" playsInline crossOrigin="anonymous" poster={poster ?? undefined} title={title}>
        {subtitles.map((sub, i) => (
          <track
            key={`${sub.language}-${i}`}
            kind="subtitles"
            src={sub.url}
            srcLang={sub.language}
            label={sub.label}
            default={Boolean(sub.default)}
          />
        ))}
      </video>
    </div>
  );
}
