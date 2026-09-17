"use client";

/**
 * AniKuoshi player engine.
 *
 * - Direct HLS via hls.js (native HLS on Safari/iOS), src = API proxiedUrl
 *   (same-origin to the API, re-tokenized per hop by the API's CORS proxy)
 * - Fallback chain implemented in useStreamLoader + local handlers
 * - Preserves position/volume/rate/subtitle language across server switches
 * - Custom control bar, skip intro/outro, auto-next countdown, PiP, keyboard
 * - Progress sync (15s throttle) for signed-in users + guest localStorage
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import Hls from "hls.js";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Loader2,
  Maximize,
  Minimize,
  MonitorPlay,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCcw,
  RotateCcw,
  Settings2,
  Subtitles,
  Volume2,
  VolumeX,
  WifiOff,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KuoshiLoader } from "@/components/layout/logo";
import { EmbedPlayer } from "./embed-player";
import { ServerPanel } from "./server-panel";
import { useStreamLoader, type AudioPref, type PlayerPhase } from "./use-stream-loader";
import { usePreferences } from "@/components/preferences-provider";
import { subtitleProxyUrl, API_BASE, type Stream } from "@/lib/api";

/** Lazy-mounted alternative players (no SSR — they need real media elements). */
const PlyrPlayer = dynamic(() => import("./plyr-player"), { ssr: false, loading: () => <AltPlayerSkeleton /> });
const VidkPlayer = dynamic(() => import("./vidk-player"), { ssr: false, loading: () => <AltPlayerSkeleton /> });

export type PlayerTypeId = "senshi" | "plyr" | "vidk" | "iframe";

/**
 * FIX (v1.2.0 — §2): player order is now Plyr → Vidk → Senshi → Embed (both
 * the on-screen switcher cycle and the Settings page ordering). The FACTORY
 * default stays Senshi; the user can pick a different "loads first" engine
 * in Settings (prefs.defaultPlayer) — see default-player resolution below.
 */
export const PLAYER_TYPES: { id: PlayerTypeId; label: string; hint: string }[] = [
  { id: "plyr", label: "Plyr", hint: "Plyr player — familiar pill controls over HLS" },
  { id: "vidk", label: "Vidk", hint: "Vidk player (Vidstack) — gestures, chapters-style scrubbing" },
  { id: "senshi", label: "Senshi", hint: "Custom Senshi player — hls.js, auto-skip, auto-next" },
  { id: "iframe", label: "Embed", hint: "Sandboxed embed — for streams that only expose embedUrl" },
];

function AltPlayerSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
      <KuoshiLoader size={56} label="Loading player…" />
    </div>
  );
}

export type EngineProps = {
  animeKey: string;
  animeTitle: string;
  /** current episode's title for the under-player strip (marquee when long) */
  episodeTitle?: string | null;
  poster?: string | null;
  episode: number;
  audioPref: AudioPref;
  ambient?: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onEpisodeChange: (ep: number) => void;
  /** externally-controlled server panel (watch page section reorder) */
  serverPanelOpen?: boolean;
  onServerPanelToggle?: (open: boolean) => void;
  /**
   * FIX (v1.2.0 — §7): server-side resume timestamp for THIS episode
   * (signed-in users; the watch page only passes it when the saved record's
   * episode matches). Guests resume via localStorage inside the engine.
   */
  resumeAt?: number;
};

type SavedPlayback = { time: number; rate: number; subtitleLang: string | null; volume: number; muted: boolean };

export function PlayerEngine(props: EngineProps) {
  const {
    animeKey, animeTitle, episodeTitle, poster, episode, audioPref,
    ambient, hasPrev, hasNext, onEpisodeChange,
  } = props;

  /**
   * FIX (v1.1.2): playback behaviour toggles live in the preferences store
   * (local + server-synced) and are rendered as compact checkmark chips under
   * the player: Autoplay · Auto next · Auto skip.
   * FIX (v1.2.0 — §3): semantics locked in —
   *   autoplay  → start playback automatically after auto-next fired, a
   *               server switch, or an episode switch (gates play() on attach)
   *   auto-next → switch to the next episode ONLY at true end-of-playback
   *               (the `ended` event; the old countdown UI is gone — §1)
   *   auto-skip → seek past intro/outro windows via skipIntro data
   * All three persist to the user profile via the preferences store.
   */
  const { prefs, setPref } = usePreferences();
  const autoplayNext = prefs.autoplayNext !== false;
  const autoplay = prefs.autoplay !== false;
  const autoSkip = prefs.autoSkip === true;

  const [refreshNonce, setRefreshNonce] = useState(0);
  const loader = useStreamLoader({ animeKey, episode, audioPref, refreshNonce });
  const { streams, activeStream, activeIdx, phase, failure } = loader;
  /**
   * FIX (v1.2.0 — §7): flips true once THIS episode has actually started
   * playing past the first seconds — after that, a late-arriving resume
   * timestamp must never seed seekRestoreRef (it would yank a server switch
   * back to the mount-time position).
   */
  const playbackStartedRef = useRef(false);

  /* -------------------------------------------------- player type state */

  // FIX (v1.1): switchable player engines.
  // FIX (v1.2.0 — §2): default-player resolution —
  //   1. prefs.defaultPlayer  (Settings page, syncs across devices)
  //   2. localStorage         (per-device last manual choice)
  //   3. "senshi"             (factory default)
  // The under-player switcher changes the engine for the session and updates
  // the per-device memory — the Settings preference stays the cross-device
  // "loads first" answer.
  const [playerType, setPlayerTypeRaw] = useState<PlayerTypeId>("senshi");
  const [embedForced, setEmbedForced] = useState(false);
  const [embedFailed, setEmbedFailed] = useState(false);
  /**
   * Cross-player playback state — written continuously by every engine
   * (video events for Senshi, onTime/onState for the others) so switching
   * player type resumes at the same second with the same volume/rate/subs.
   */
  const crossRef = useRef({ time: 0, rate: 1, volume: 1, muted: false, subLang: null as string | null });
  const seekBridgeRef = useRef<((t: number) => void) | null>(null);
  /** autoplay pref mirror — read inside attachStream without re-creating it */
  const autoplayRef = useRef(autoplay);
  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("anikuoshi.playerType");
      if (saved && PLAYER_TYPES.some((t) => t.id === saved)) {
        setPlayerTypeRaw(saved as PlayerTypeId);
      }
    } catch {}
    // §2: the Settings default wins over the per-device last choice once
    // preferences hydrate (undefined until then → localStorage applies first)
    const prefDefault = prefs.defaultPlayer;
    if (prefDefault && PLAYER_TYPES.some((t) => t.id === prefDefault)) {
      setPlayerTypeRaw(prefDefault);
    }
    // re-runs when the Settings default changes (sign-in merge / settings page)
  }, [prefs.defaultPlayer]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const savedRef = useRef<SavedPlayback>({ time: 0, rate: 1, subtitleLang: null, volume: 1, muted: false });
  const seekRestoreRef = useRef<number | null>(null);
  const stallCountRef = useRef(0);
  const lastSyncRef = useRef(0);
  const attachedKeyRef = useRef("");
  /**
   * FIX (v1.1.2): scope of the stream currently attached to the <video>
   * (`animeKey:episode`). Lets the attach effect detect the stale commit that
   * follows an episode change — phase is still "direct" with the PREVIOUS
   * episode's stream while the loader is already refetching — and skip it,
   * instead of re-attaching the old stream and carrying the old position into
   * the new episode (the "invisible delay" after prev/next).
   */
  const attachScopeRef = useRef<string | null>(null);

  /**
   * FIX (v1.1.2): render-scope tracking for the cross-engine position bridge.
   * `crossRef.current.time` is the last reported position of the CURRENT
   * episode. Without this reset, Plyr/Vidk received the PREVIOUS episode's
   * position as `startAt` (their mount keys change with the episode, but the
   * bridge value survived) — the alt-engine flavor of the "invisible delay".
   * Reset during render so the very first mount of the new episode sees 0.
   */
  const scopeNow = `${animeKey}:${episode}`;
  const scopeNowRef = useRef(scopeNow);
  scopeNowRef.current = scopeNow;
  const crossScopeRef = useRef(scopeNow);
  if (crossScopeRef.current !== scopeNow) {
    crossScopeRef.current = scopeNow;
    crossRef.current.time = 0;
  }

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [subLang, setSubLang] = useState<string | null>(null);
  const [quality, setQuality] = useState<string>("auto");
  // FIX (v1.2.0 — §1): the auto-next COUNTDOWN was removed entirely. It fired
  // on the wrong trigger (entering an episode could start a countdown toward
  // the NEXT one) and fought the prev/next buttons. Auto-next is now handled
  // exclusively by the Auto-next toggle firing at true end-of-playback (§3).
  const [internalPanelOpen, setInternalPanelOpen] = useState(false);
  const serverPanelOpen = props.serverPanelOpen ?? internalPanelOpen;
  const setServerPanelOpen = useCallback(
    (v: boolean | ((p: boolean) => boolean)) => {
      const current = props.serverPanelOpen ?? internalPanelOpen;
      const next = typeof v === "function" ? v(current) : v;
      if (props.serverPanelOpen === undefined) setInternalPanelOpen(next);
      props.onServerPanelToggle?.(next);
    },
    [props.serverPanelOpen, props.onServerPanelToggle, internalPanelOpen]
  );

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* --------------------------------------------- switch + embed fallback */

  /** User-initiated switch: persist choice + snapshot playback state. */
  const changePlayerType = useCallback((t: PlayerTypeId) => {
    if (t === playerType) return;
    // snapshot current position before the media element changes
    const v = videoRef.current;
    if (v && v.currentTime > 0) crossRef.current.time = v.currentTime;
    crossRef.current.rate = rate;
    crossRef.current.volume = volume;
    crossRef.current.muted = muted;
    crossRef.current.subLang = subLang;
    setEmbedForced(false);
    if (t === "senshi") {
      attachedKeyRef.current = ""; // force re-attach on return
      /**
       * FIX (v1.1.2): the Senshi <video> remounts fresh (currentTime = 0), so
       * re-attach had no restore point. Seed seekRestoreRef from the
       * cross-engine bridge so returning to Senshi resumes where the other
       * engine left off instead of restarting at 0:00.
       */
      if (crossRef.current.time > 0) seekRestoreRef.current = crossRef.current.time;
    }
    setPlayerTypeRaw(t);
    try { localStorage.setItem("anikuoshi.playerType", t); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerType, rate, volume, muted, subLang]);

  /** Engine-managed switch (fallback chain) — choice is NOT persisted. */
  const setPlayerTypeUnpersisted = useCallback((t: PlayerTypeId) => {
    setPlayerTypeRaw(t);
  }, []);

  /**
   * FIX (v1.1.2): compact engine switcher — one button, click cycles
   * Senshi → Plyr → Vidk → Embed → Senshi. Same engines as the old 4-button
   * group, a quarter of the strip space.
   */
  const currentType = PLAYER_TYPES.find((t) => t.id === playerType) ?? PLAYER_TYPES[0];
  const nextType = PLAYER_TYPES[(PLAYER_TYPES.findIndex((t) => t.id === playerType) + 1) % PLAYER_TYPES.length] ?? PLAYER_TYPES[0];
  const cyclePlayerType = useCallback(() => {
    changePlayerType(nextType.id);
  }, [changePlayerType, nextType]);

  /** Best embed URL for the current (or any) stream — embed is the last
   *  link in the fallback chain and also a user-selectable player type. */
  const embedCandidate = useMemo(() => streams.find((s) => s.embedUrl) ?? null, [streams]);
  const embedSrc = activeStream?.embedUrl || embedCandidate?.embedUrl || null;

  // Fallback chain tail: every direct stream failed (or the episode only has
  // embed servers) → try the embed player before showing the error card.
  // (Auto-switch is not persisted.)
  // FIX (v1.1.2): also cover phase === "embed" — an episode whose servers are
  // ALL embed-kind used to leave the Senshi player area completely blank
  // (nothing rendered: not "direct", not "exhausted", overlay didn't match).
  useEffect(() => {
    if ((phase === "exhausted" || phase === "embed") && embedSrc && playerType !== "iframe") {
      setEmbedFailed(false);
      setEmbedForced(true);
      setPlayerTypeUnpersisted("iframe");
      toast.message("Switching to embed player…", {
        description: "Direct streams are unavailable right now.",
      });
    }
  }, [phase, embedSrc, playerType, setPlayerTypeUnpersisted]);

  // A silent refresh recovered direct streams while the embed fallback was
  // active → hand control back to the Senshi engine automatically.
  useEffect(() => {
    if (embedForced && phase === "direct" && playerType === "iframe") {
      setEmbedForced(false);
      attachedKeyRef.current = "";
      setPlayerTypeUnpersisted("senshi");
    }
  }, [phase, embedForced, playerType, setPlayerTypeUnpersisted]);

  // reset the embed-failure flag whenever the embed source changes
  useEffect(() => {
    setEmbedFailed(false);
  }, [embedSrc, playerType]);

  /** Seek bridge: skip intro/outro works across every engine. */
  const performSeek = useCallback((t: number) => {
    if (playerType === "senshi") {
      const v = videoRef.current;
      if (v && isFinite(t)) v.currentTime = Math.max(0, t);
    } else {
      seekBridgeRef.current?.(t);
    }
  }, [playerType]);

  /* ------------------------------------------------ resume + guest save */

  useEffect(() => {
    // seek target: server progress (signed-in, passed per-episode by the watch
    // page) takes priority; guest/localStorage resume for this key+ep is the
    // fallback.
    /**
     * FIX (v1.1.2): clear FIRST — a restore point left over from the previous
     * episode used to leak into the next one via restorePosition()'s
     * `seekRestoreRef.current ?? restore?.time` preference.
     */
    seekRestoreRef.current = null;
    // §7 guard: never seed a resume point once this episode is already playing
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

  // reset the playback-started flag whenever the episode scope changes
  useEffect(() => {
    playbackStartedRef.current = false;
  }, [animeKey, episode]);

  const syncProgress = useCallback(
    (seconds: number, dur: number, force = false) => {
      const now = Date.now();
      if (!force && now - lastSyncRef.current < 15_000) return;
      lastSyncRef.current = now;
      // guest fallback always — v1.2.0 entries also carry title/poster/duration
      // + a timestamp so the /history page can render cards with progress bars
      // (§7); reading code tolerates the old {ep, t}-only shape.
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

  /** Alt-player time reporter → keeps progress sync + skip overlays live. */
  const handleAltTime = useCallback(
    (seconds: number, dur: number) => {
      // discard late reports from an engine that belonged to a previous episode
      if (crossScopeRef.current !== scopeNowRef.current) return;
      crossRef.current.time = seconds;
      setTime(seconds);
      syncProgress(seconds, dur);
    },
    [syncProgress]
  );

  /* ------------------------------------------------------- hls attach */

  const attachStream = useCallback(
    (stream: Stream, video: HTMLVideoElement, restore: SavedPlayback | null) => {
      const src = stream.proxiedUrl || stream.url;
      if (!src) {
        loader.reportFailure("empty");
        return;
      }

      // cleanup previous hls
      hlsRef.current?.destroy();
      hlsRef.current = null;

      const isHlsSrc = stream.isHls || /\.m3u8(\?|$)/i.test(src);
      const nativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";

      const restorePosition = () => {
        const target = seekRestoreRef.current ?? restore?.time ?? 0;
        if (target > 0 && isFinite(video.duration)) {
          video.currentTime = Math.min(target, Math.max(0, video.duration - 5));
        }
        video.playbackRate = restore?.rate ?? rate;
        video.volume = restore?.volume ?? volume;
        video.muted = restore?.muted ?? muted;
        seekRestoreRef.current = null;
      };

      if (isHlsSrc && !nativeHls && Hls.isSupported()) {
        const hls = new Hls({
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          fragLoadingMaxRetry: 2,
          manifestLoadingMaxRetry: 1,
          levelLoadingMaxRetry: 2,
          fragLoadingTimeOut: 20_000,
        });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          restorePosition();
          // FIX (v1.1.2): respect the Autoplay toggle — load + poster only
          if (autoplayRef.current) video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && [403, 401].includes(data.response?.code ?? 0)) {
            loader.reportFailure("403");
          } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            loader.reportFailure("network");
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            // one in-place recovery attempt before declaring failure
            try {
              hls.recoverMediaError();
            } catch {
              loader.reportFailure("decode");
            }
          } else {
            loader.reportFailure("decode");
          }
        });
      } else if (isHlsSrc && nativeHls) {
        video.src = src;
        video.addEventListener("loadedmetadata", () => {
          restorePosition();
          if (autoplayRef.current) video.play().catch(() => {});
        }, { once: true });
      } else {
        video.src = src;
        video.addEventListener("loadedmetadata", () => {
          restorePosition();
          if (autoplayRef.current) video.play().catch(() => {});
        }, { once: true });
      }

      // subtitle selection restore
      if (restore?.subtitleLang) setSubLang(restore.subtitleLang);
    },
     
    [rate, volume, muted]
  );

  // attach on active stream change
  useEffect(() => {
    const video = videoRef.current;
    if (!video || phase !== "direct" || !activeStream) return;
    const scope = `${animeKey}:${episode}`;
    if (attachScopeRef.current !== null && attachScopeRef.current !== scope) {
      /**
       * FIX (v1.1.2) — STALE ATTACH GUARD: the first commit after an
       * episode/anime change still has phase="direct" with the PREVIOUS
       * episode's stream (the loader refetches async). Attaching here would
       * restart the old manifest AND snapshot the old episode's currentTime,
       * which restorePosition() then replayed inside the NEW episode — the
       * reported "it works but there's an invisible delay, maybe because it
       * played in previous episode". Consume the transition instead: the
       * loader flips to "loading" momentarily and drives a clean attach for
       * the new episode's own stream.
       */
      attachScopeRef.current = scope;
      attachedKeyRef.current = "";
      crossRef.current.time = 0; // never carry a position across episodes
      return;
    }
    attachScopeRef.current = scope;
    const attachKey = `${scope}:${activeIdx}:${refreshNonce}:${streams.length}`;
    if (attachedKeyRef.current === attachKey) return;
    attachedKeyRef.current = attachKey;

    // preserve the current experience across switches (SAME episode only —
    // the scope guard above keeps episode transitions from reaching here
    // with a stale position)
    const preserve: SavedPlayback = {
      time: video.currentTime || 0,
      rate,
      subtitleLang: subLang,
      volume,
      muted,
    };
    if (preserve.time > 0) savedRef.current = preserve;
    attachStream(activeStream, video, preserve);

    /**
     * FIX (v1.1.1): `playerType` MUST be a dependency. The Senshi <video>
     * element remounts whenever the user switches engines (Plyr → Senshi …),
     * but without this dep the attach effect never re-ran for the NEW video
     * element — switching back to Senshi left a source-less, dead player.
     * changePlayerType() already clears attachedKeyRef to force the re-attach.
     */
  }, [activeStream, activeIdx, phase, refreshNonce, streams.length, animeKey, episode, playerType, attachStream]);

  /* ------------------------------------------------------ stall watchdog */

  useEffect(() => {
    if (phase !== "direct") return;
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) {
        stallCountRef.current = 0;
        return;
      }
      if (video.readyState < 3 && video.currentTime === (video.dataset.lastTime ? Number(video.dataset.lastTime) : -1)) {
        stallCountRef.current += 1;
        if (stallCountRef.current >= 4) {
          stallCountRef.current = 0;
          toast.message("Stream stalled — refreshing…", { description: "Re-tokenizing playback." });
          setRefreshNonce((n) => n + 1);
        }
      } else {
        stallCountRef.current = 0;
      }
      video.dataset.lastTime = String(video.currentTime);
    }, 4000);
    return () => clearInterval(timer);
  }, [phase]);

  // refreshed-stream reattach listener
  useEffect(() => {
    const onRefreshed = () => {
      const video = videoRef.current;
      if (video && phase === "direct" && activeStream) {
        const preserve: SavedPlayback = { time: video.currentTime || 0, rate, subtitleLang: subLang, volume, muted };
        attachStream(activeStream, video, preserve);
      }
    };
    window.addEventListener("anikuoshi:stream-refreshed", onRefreshed);
    return () => window.removeEventListener("anikuoshi:stream-refreshed", onRefreshed);
     
  }, [activeStream, phase, rate, volume, muted, subLang]);

  /* --------------------------------------------------- video event glue */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      if (video.currentTime > 2) playbackStartedRef.current = true;
      setTime(video.currentTime);
      if (video.buffered.length) setBuffered(video.buffered.end(video.buffered.length - 1));
      syncProgress(video.currentTime, video.duration || 0);
    };
    const onDur = () => setDuration(video.duration || 0);
    const onPlay = () => {
      setPlaying(true);
    };
    const onPause = () => { setPlaying(false); syncProgress(video.currentTime, video.duration || 0, true); };
    const onErr = () => {
      if (video.error) loader.reportFailure(video.error.code === MediaError.prototype.MEDIA_ERR_SRC_NOT_SUPPORTED ? "decode" : "network");
    };
    /**
     * FIX (v1.2.0 — §1/§3): auto-next fires ONLY on true end-of-playback.
     * The `ended` event is that exact signal — no countdown, no entry-time
     * trigger. The Auto-play toggle decides whether the next episode starts
     * playing immediately (autoplayRef gates play() inside attachStream).
     */
    const onEnded = () => {
      syncProgress(0, 0, true);
      if (autoplayNext && hasNext) onEpisodeChange(episode + 1);
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("progress", onTime);
    video.addEventListener("durationchange", onDur);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onErr);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("progress", onTime);
      video.removeEventListener("durationchange", onDur);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onErr);
      video.removeEventListener("ended", onEnded);
    };
     
  }, [phase, syncProgress, autoplayNext, hasNext]);

  // flush progress on unmount / tab hide / page hide
  useEffect(() => {
    const flush = () => {
      const video = videoRef.current;
      if (video && video.currentTime > 0) syncProgress(video.currentTime, video.duration || 0, true);
    };
    const onHide = () => document.visibilityState === "hidden" && flush();
    /**
     * FIX (v1.2.0 — §7): `pagehide` also flushes — unlike visibilitychange it
     * fires when the document is being unloaded (close tab, navigate away,
     * mobile Safari app switch), so the exact timestamp is never lost.
     */
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const apply = () => {
      for (let i = 0; i < video.textTracks.length; i++) {
        const tt = video.textTracks[i];
        tt.mode = subLang && tt.language === subLang ? "showing" : "disabled";
      }
    };
    apply();
    video.textTracks.addEventListener?.("addtrack", apply);
    return () => video.textTracks.removeEventListener?.("addtrack", apply);
  }, [subLang, activeStream]);

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

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min((video.duration || 0) - 1, video.currentTime + delta));
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
      const video = videoRef.current;
      if (!video) return;
      switch (e.key) {
        case " ":
        case "k": e.preventDefault(); togglePlay(); break;
        case "ArrowRight": e.preventDefault(); seekBy(5); break;
        case "ArrowLeft": e.preventDefault(); seekBy(-5); break;
        case "l": seekBy(10); break;
        case "j": seekBy(-10); break;
        case "ArrowUp": e.preventDefault(); video.volume = Math.min(1, video.volume + 0.05); break;
        case "ArrowDown": e.preventDefault(); video.volume = Math.max(0, video.volume - 0.05); break;
        case "m": video.muted = !video.muted; break;
        case "f": toggleFullscreen(); break;
        case "n": if (hasNext) onEpisodeChange(episode + 1); break;
        case "p": if (hasPrev) onEpisodeChange(episode - 1); break;
        case "s": setServerPanelOpen((v) => !v); break;
        default:
          if (/^[0-9]$/.test(e.key) && video.duration) {
            video.currentTime = (Number(e.key) / 10) * video.duration;
          }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, toggleFullscreen, hasNext, hasPrev, episode, onEpisodeChange]);

  // auto-next countdown — REMOVED (v1.2.0 §1): auto-next now fires directly
  // from the `ended` handlers; no timer to arm, cancel or leak. (The old
  // "cancel countdown on episode change" effect existed only for that timer;
  // the stale-attach guard above is untouched and keeps guarding.)

  /**
   * FIX (v1.1.2): Auto-skip — when enabled, seek past the intro/outro window
   * automatically. Fires once per window (guard key), works across all
   * engines via performSeek (direct video or seek bridge).
   * (Effect body lives after the skip window declarations below — see
   * `AUTO-SKIP EFFECT` — because it reads inIntro/inOutro.)
   */
  const autoSkipKeyRef = useRef("");

  // controls autohide
  const bumpControls = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!videoRef.current?.paused) setShowControls(false);
    }, 2800);
  }, []);

  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}:${String(m % 60).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
  };

  /* ------------------------------------------------------------ render */

  const skip = activeStream?.skipIntro;
  const inIntro = skip?.intro && time >= skip.intro.start && time <= skip.intro.end;
  const inOutro = skip?.outro && time >= skip.outro.start && time <= skip.outro.end;

  // AUTO-SKIP EFFECT (FIX v1.1.2) — see note above the autoSkipKeyRef decl.
  useEffect(() => {
    if (!autoSkip) return;
    const windowKind = inIntro ? "intro" : inOutro ? "outro" : null;
    if (!windowKind) return;
    const key = `${animeKey}:${episode}:${windowKind}`;
    if (autoSkipKeyRef.current === key) return;
    autoSkipKeyRef.current = key;
    const target = inIntro ? skip?.intro?.end : skip?.outro?.end;
    if (typeof target === "number") performSeek(target + 0.5);
  }, [inIntro, inOutro, autoSkip, animeKey, episode, skip?.intro?.end, skip?.outro?.end, performSeek]);

  /** resume point for alternative engines (cross-player state bridge) */
  const altStart = crossRef.current.time > 0 ? crossRef.current.time : seekRestoreRef.current ?? 0;
  /** alternative engines get proxied subtitle tracks (CORS-safe) */
  const altSubtitles = useMemo(
    () =>
      subtitleTracks
        .map((s) => ({ ...s, url: subtitleProxyUrl(s) || s.url }))
        .filter((s) => Boolean(s.url)),
    [subtitleTracks]
  );

  const qualityOptions = useMemo(() => {
    const q = activeStream?.qualities ?? [];
    return q.map((x) => x.label);
  }, [activeStream]);

  const setQualityUrl = (label: string) => {
    const video = videoRef.current;
    const target = activeStream?.qualities?.find((x) => x.label === label);
    if (!video || !target || !activeStream) return;
    const url = `${API_BASE}/api/proxy/hls?url=${encodeURIComponent(target.url)}&ref=${encodeURIComponent("https://megaplay.buzz/")}`;
    savedRef.current = { time: video.currentTime, rate, subtitleLang: subLang, volume, muted };
    seekRestoreRef.current = video.currentTime;
    video.src = url;
    video.play().catch(() => {});
    setQuality(label);
  };

  return (
    <div className="w-full">
      <div
        ref={wrapRef}
        className={`relative aspect-video w-full select-none overflow-hidden rounded-xl bg-black ${
          ambient ? "shadow-[0_0_80px_-12px_var(--surface-glow)]" : ""
        }`}
        onMouseMove={bumpControls}
        onMouseLeave={() => setShowControls(false)}
        onTouchStart={bumpControls}
      >
        {/* ambient backdrop */}
        {ambient && poster && (
          <div
            aria-hidden
            className="absolute inset-0 scale-125 bg-cover bg-center opacity-25 blur-3xl"
            style={{ backgroundImage: `url(${poster})` }}
          />
        )}

        {/* ---------------- direct video (Senshi engine) ---------------- */}
        {phase === "direct" && playerType === "senshi" && (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full"
            playsInline
            crossOrigin="anonymous"
            poster={poster ?? undefined}
            onClick={togglePlay}
            onDoubleClick={toggleFullscreen}
          >
            {subtitleTracks.map((sub, i) => {
              const proxied = subtitleProxyUrl(sub);
              return proxied ? (
                <track
                  key={`${sub.language}-${i}`}
                  kind="subtitles"
                  src={proxied}
                  srcLang={sub.language}
                  label={sub.label}
                  default={Boolean(sub.default) && !subLang}
                />
              ) : null;
            })}
          </video>
        )}

        {/* ---------------- embed (user-selected or fallback tail) ---------------- */}
        {playerType === "iframe" && embedSrc && (
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

        {/* ---------------- Plyr engine ---------------- */}
        {playerType === "plyr" && phase === "direct" && (activeStream?.proxiedUrl || activeStream?.url) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <PlyrPlayer
              key={`plyr:${animeKey}:${episode}:${activeStream?.proxiedUrl || activeStream?.url}`}
              src={activeStream!.proxiedUrl || activeStream!.url!}
              isHls={Boolean(activeStream!.isHls)}
              poster={poster ?? null}
              title={animeTitle}
              startAt={altStart}
              startRate={crossRef.current.rate || rate}
              startVolume={crossRef.current.volume || volume}
              startMuted={crossRef.current.muted || muted}
              subtitles={altSubtitles}
              onTime={handleAltTime}
              onEnded={() => autoplayNext && hasNext && onEpisodeChange(episode + 1)}
              onError={() => loader.reportFailure("decode")}
              onSeekBridge={(fn) => (seekBridgeRef.current = fn)}
            />
          </div>
        )}

        {/* ---------------- Vidk engine (Vidstack) ---------------- */}
        {playerType === "vidk" && phase === "direct" && (activeStream?.proxiedUrl || activeStream?.url) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <VidkPlayer
              key={`vidk:${animeKey}:${episode}:${activeStream?.proxiedUrl || activeStream?.url}`}
              src={activeStream!.proxiedUrl || activeStream!.url!}
              poster={poster ?? null}
              title={animeTitle}
              startAt={altStart}
              startRate={crossRef.current.rate || rate}
              startVolume={crossRef.current.volume || volume}
              startMuted={crossRef.current.muted || muted}
              subtitles={altSubtitles}
              onTime={handleAltTime}
              onEnded={() => autoplayNext && hasNext && onEpisodeChange(episode + 1)}
              onError={() => loader.reportFailure("decode")}
              onSeekBridge={(fn) => (seekBridgeRef.current = fn)}
            />
          </div>
        )}

        {/* ---------------- loading / refreshing ---------------- */}
        {(phase === "loading" || phase === "refreshing" || phase === "idle") && playerType !== "iframe" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <KuoshiLoader size={72} label={phase === "refreshing" ? "Refreshing stream…" : "Resolving streams…"} />
          </div>
        )}

        {/* ---------------- exhausted: error card ---------------- */}
        {phase === "exhausted" && !(playerType === "iframe" && embedSrc && !embedFailed) && (
          <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/85 p-6">
            <div className="max-w-md text-center">
              <WifiOff className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
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
                  className="brand-gradient border-0 text-white"
                  onClick={() => {
                    attachedKeyRef.current = "";
                    setRefreshNonce((n) => n + 1);
                    loader.load({ silent: false });
                  }}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" /> Retry
                </Button>
                {streams.length > 0 && (
                  <Button variant="outline" className="border-white/20 text-white" onClick={() => setServerPanelOpen(true)}>
                    Pick a server
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="border-white/20 text-white"
                  onClick={() => {
                    const diag = { animeKey, episode, failure, tried: streams.map((s) => `${s.provider}/${s.type}/${s.kind}`) };
                    navigator.clipboard?.writeText(JSON.stringify(diag)).then(
                      () => toast.success("Diagnostics copied — paste them when reporting."),
                      () => toast.error("Couldn't copy diagnostics")
                    );
                  }}
                >
                  Report &amp; copy diagnostics
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* REMOVED (v1.2.0 — §1): the auto-next countdown overlay and its
            timer. Auto-next now fires directly from the `ended` handlers
            when the Auto-next toggle is on (§3). */}

        {/* REMOVED (v1.2.0 — §1): the "Skip intro/outro" prompt button. It
            appeared at the start of every playback and didn't help. The
            skipIntro DATA stays wired to the Auto-skip toggle (§3), which
            seeks past intro/outro automatically when enabled. */}

        {/* ---------------- custom controls (Senshi only) ---------------- */}
        {phase === "direct" && playerType === "senshi" && (
          <div
            className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2.5 pt-8 transition-opacity duration-300 ${
              showControls || !playing ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            {/* seek bar */}
            <div className="group relative mb-2 h-4 cursor-pointer" onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              const video = videoRef.current;
              if (video && video.duration) video.currentTime = pct * video.duration;
            }}>
              <div className="absolute inset-x-0 top-1.5 h-1 overflow-hidden rounded-full bg-white/20">
                <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: duration ? `${(buffered / duration) * 100}%` : "0%" }} />
                <div className="brand-gradient absolute inset-y-0 left-0" style={{ width: duration ? `${(time / duration) * 100}%` : "0%" }} />
              </div>
              <div
                className="absolute top-0.5 h-3 w-3 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                style={{ left: duration ? `calc(${(time / duration) * 100}% - 6px)` : "0%" }}
              />
            </div>

            <div className="flex items-center gap-0.5 text-white">
              <ControlBtn label={playing ? "Pause" : "Play"} onClick={togglePlay}>
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </ControlBtn>
              {/* v1.1 mobile-first: 44px targets; secondary controls hide on phones to fit.
                  FIX (v1.2.0 — §8): the in-player prev/next episode buttons moved to the
                  under-player strip (beside the toggles); the control bar keeps playback
                  controls only. Keyboard n/p shortcuts still jump episodes. */}
              <ControlBtn label="Back 10s" onClick={() => seekBy(-10)} className="hidden sm:inline-flex"><RotateCcw className="h-4 w-4" /></ControlBtn>
              <div className="group/vol ml-1 flex items-center">
                <ControlBtn label={muted ? "Unmute" : "Mute"} onClick={() => {
                  const video = videoRef.current;
                  if (video) { video.muted = !video.muted; setMuted(video.muted); }
                }}>
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </ControlBtn>
                <input
                  type="range" min={0} max={1} step={0.05} aria-label="Volume"
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const video = videoRef.current;
                    if (video) { video.volume = v; video.muted = v === 0; setVolume(v); setMuted(v === 0); }
                  }}
                  className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/30 transition-all duration-300 group-hover/vol:w-16 accent-white"
                />
              </div>

              <span className="ml-1.5 text-xs tabular-nums text-white/85">
                {fmt(time)} <span className="text-white/50">/ {fmt(duration)}</span>
              </span>

              <div className="ml-auto flex items-center gap-0.5">
                {subtitleTracks.length > 0 && (
                  <PlayerMenu
                    icon={<Subtitles className="h-4 w-4" />}
                    label="Subtitles"
                    items={[{ key: "off", label: "Off" }, ...subtitleTracks.map((s, i) => ({ key: s.language || String(i), label: s.label }))]}
                    activeKey={subLang ?? "off"}
                    onPick={(k) => {
                      setSubLang(k === "off" ? null : k);
                      const video = videoRef.current;
                      if (video) {
                        for (let i = 0; i < video.textTracks.length; i++) {
                          const tt = video.textTracks[i];
                          tt.mode = k !== "off" && tt.language === k ? "showing" : "disabled";
                        }
                      }
                    }}
                  />
                )}
                {qualityOptions.length > 0 && (
                  <PlayerMenu
                    icon={<Gauge className="h-4 w-4" />}
                    label="Quality"
                    items={[{ key: "auto", label: "Auto" }, ...qualityOptions.map((q) => ({ key: q, label: q }))]}
                    activeKey={quality}
                    onPick={(k) => (k === "auto" ? setQuality("auto") : setQualityUrl(k))}
                  />
                )}
                <PlayerMenu
                  icon={<Settings2 className="h-4 w-4" />}
                  label="Speed"
                  items={[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => ({ key: String(r), label: `${r}×` }))}
                  activeKey={String(rate)}
                  onPick={(k) => {
                    const r = Number(k);
                    setRate(r);
                    if (videoRef.current) videoRef.current.playbackRate = r;
                  }}
                />
                <ControlBtn label="Picture in picture" className="hidden sm:inline-flex" onClick={async () => {
                  const video = videoRef.current;
                  if (!video) return;
                  try {
                    if (document.pictureInPictureElement) await document.exitPictureInPicture();
                    else await video.requestPictureInPicture();
                  } catch { toast.error("PiP unavailable for this stream"); }
                }}>
                  <PictureInPicture2 className="h-4 w-4" />
                </ControlBtn>
                <ControlBtn label="Fullscreen" onClick={toggleFullscreen}>
                  {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </ControlBtn>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FIX (v1.2.0 — §8): redesigned under-player strip.

          [◀ Prev] [Next ▶]  «  Anime title — EP n · episode title (marquee)  »
                             [✓autoplay][✓auto next][✓auto skip] [Plyr ▸] [Show Servers]

        - Prev/next episode buttons live here now (moved out of the Senshi
          control bar), beside the toggles as specified.
        - The middle shows the full anime name + episode title/number; when
          the text overflows it scrolls as a marquee.
        - The toggles shrank (text-[10px], tighter padding) to make room.
      */}
      <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
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

          {/* playback toggles — made smaller (§8) to make room for prev/next */}
          <div className="flex shrink-0 items-center gap-1" data-testid="player-toggles">
            <ToggleChip compact label="Auto play" active={autoplay} onToggle={() => setPref("autoplay", !autoplay)} />
            <ToggleChip compact label="Auto next" active={autoplayNext} onToggle={() => setPref("autoplayNext", !autoplayNext)} />
            <ToggleChip compact label="Auto skip" active={autoSkip} onToggle={() => setPref("autoSkip", !autoSkip)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {phase === "direct" && playerType === "senshi" && activeStream && (
            <>
              <span className="rounded-md bg-muted px-2 py-1 font-medium">
                {activeStream.provider}
                {activeStream.originalName ? ` · ${activeStream.originalName}` : ""}
              </span>
              <span className="rounded-md bg-muted px-2 py-1 uppercase">{activeStream.type || "sub"}</span>
              {activeStream.latencyMs ? <span>{activeStream.latencyMs}ms probe</span> : null}
            </>
          )}
          {playerType === "iframe" && embedSrc && (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Embed mode — some providers block progress sync.
            </span>
          )}

          {/* FIX (v1.1.2): single-button player switcher — click cycles engines
              (FIX v1.2.0 §2 order: Plyr → Vidk → Senshi → Embed). */}
          <button
            data-testid="player-switcher"
            onClick={cyclePlayerType}
            aria-label={`Player engine: ${currentType.label}. Click to switch to ${nextType.label}`}
            title={`Player: ${currentType.label} — click for ${nextType.label} (${PLAYER_TYPES.map((t) => t.label).join(" → ")})`}
            className="ml-auto flex min-touch items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
          >
            {playerType === "iframe" ? <Youtube className="h-3.5 w-3.5 text-primary" /> : <MonitorPlay className="h-3.5 w-3.5 text-primary" />}
            {currentType.label}
          </button>

          {/* FIX (v1.2.0 — §8): "Show Servers" (was "Change server (s)") — opens
              the panel; the panel's own upper-right Hide link closes it. */}
          <button
            className="flex items-center gap-1 rounded-md bg-muted px-2.5 py-1.5 font-medium text-foreground hover:bg-accent"
            aria-expanded={serverPanelOpen}
            aria-controls="servers"
            data-testid="show-servers"
            onClick={() => setServerPanelOpen((v) => !v)}
          >
            <RefreshCcw className="h-3 w-3" /> {serverPanelOpen ? "Hide servers" : "Show Servers"}
          </button>
        </div>
      </div>

      {/* servers panel — sits directly below the player (watch page order:
         Player → Servers → Episodes → Seasons/Specials → Recommendations) */}
      {serverPanelOpen && (
        <div className="mt-3 scroll-mt-24 rounded-xl border border-border/70 bg-card/70 p-4 backdrop-blur" id="servers" data-testid="server-panel">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Servers for EP {episode}</p>
            <button
              onClick={() => setServerPanelOpen(false)}
              aria-label="Hide servers panel"
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Hide
            </button>
          </div>
          <ServerPanel streams={streams} activeIdx={activeIdx} onSelect={(i) => { attachedKeyRef.current = ""; loader.switchTo(i); }} />
        </div>
      )}
    </div>
  );
}

function ControlBtn({
  label, onClick, disabled, children, className,
}: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-[44px] min-w-[44px] rounded-md p-2 transition-colors hover:bg-white/15 disabled:opacity-30 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

/**
 * FIX (v1.1.2): compact checkmark toggle chip for the under-player strip
 * (Auto play · Auto next · Auto skip). role="switch" + aria-checked for AT.
 * FIX (v1.2.0 — §8): `compact` variant — smaller text/padding so the strip
 * has room for the prev/next episode buttons beside the toggles.
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
          active ? "brand-gradient border-transparent text-white" : "border-muted-foreground/40 text-transparent"
        }`}
      >
        <Check className={compact ? "h-2 w-2" : "h-3 w-3"} strokeWidth={3} />
      </span>
      {label}
    </button>
  );
}

/**
 * FIX (v1.2.0 — §8): one-line marquee text. Renders the string verbatim;
 * when it overflows its box, the content duplicates and scrolls (CSS
 * `animate-marquee`, defined in globals.css) so long anime + episode titles
 * stay fully readable without wrapping or clipping.
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

function PlayerMenu({
  icon, label, items, activeKey, onPick,
}: {
  icon: React.ReactNode; label: string; items: { key: string; label: string }[]; activeKey: string; onPick: (k: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
        className={`min-h-[44px] min-w-[44px] rounded-md p-2 transition-colors hover:bg-white/15 ${open ? "bg-white/15" : ""}`}
      >
        {icon}
      </button>
      {open && (
        <div className="absolute bottom-10 right-0 z-40 min-w-[140px] rounded-xl border border-white/10 bg-black/95 p-1.5 shadow-2xl backdrop-blur">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
          {items.map((it) => (
            <button
              key={it.key}
              onClick={() => { onPick(it.key); setOpen(false); }}
              className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/10 ${
                activeKey === it.key ? "font-semibold text-white" : "text-white/70"
              }`}
            >
              {it.label}
              {activeKey === it.key && <span className="brand-gradient h-1.5 w-1.5 rounded-full" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
