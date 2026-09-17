"use client";

 

/**
 * Landing — cinematic spotlight hero, value proposition, CTA.
 * Spotlights come from /api/home; a branded gradient takes over on slow
 * or failing networks so the first paint is always premium.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Bell, Gauge, ListVideo, MonitorSmartphone, Play, Server, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { homePage, type SpotlightItem } from "@/lib/api";
import { InstallButton } from "@/components/pwa/install-button";

const FEATURES = [
  {
    icon: Gauge,
    title: "Fast & feather-light",
    body: "Skeleton-loaded routes, aggressively cached images and prewarmed data keep browsing instant — even on flaky connections.",
  },
  {
    icon: Server,
    title: "Sub & dub, multi-server",
    body: "Direct HLS and embed servers with automatic failover. Stream keeps rolling — the player heals itself on 403s and stalls.",
  },
  {
    icon: ListVideo,
    title: "Your library, synced",
    body: "Continue watching, history and lists travel with your account — progress is saved every few seconds as you watch.",
  },
  {
    icon: MonitorSmartphone,
    title: "Installable PWA",
    body: "Add AniKuoshi to your home screen. Offline shell, smooth 60fps transitions, and full keyboard control.",
  },
  {
    icon: Bell,
    title: "Release schedule",
    body: "Today's airing timetable lives beside the player and home rows, so the next episode is never a surprise.",
  },
  {
    icon: Sparkles,
    title: "Make it yours",
    body: "Four dark variants, eight accent palettes, Romaji/English titles, sub/dub defaults and reduced-motion support.",
  },
];

export default function LandingPage() {
  const [spotlights, setSpotlights] = useState<SpotlightItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => setReady(true), 9000); // fail gracefully
    homePage()
      .then((h) => {
        if (!cancelled) setSpotlights(h.spotlights ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          clearTimeout(timer);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const slides = spotlights.filter((s) => s.poster || s.cover).slice(0, 5);

  return (
    <div className="relative">
      {/* ---------------------------------------------------------- hero */}
      <section className="relative flex min-h-[92svh] items-end overflow-hidden">
        <div className="absolute inset-0" aria-hidden>
          {slides.length > 0 ? (
            <HeroSlideshow slides={slides} />
          ) : (
            <div className="h-full w-full bg-muted" />
          )}
          <div className="hero-vignette absolute inset-0" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl"
          >
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/50 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Powered by the APIKuoshi API · installable PWA
            </p>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Every episode.
              <br />
              <span className="brand-text">Beautifully streamed.</span>
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              AniKuoshi is a premium anime discovery and streaming experience — trending rows,
              seasonal schedules, sub &amp; dub servers with automatic failover, and a player that
              feels native. No clutter. No account required to watch.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 border-0 bg-primary px-7 text-base text-primary-foreground">
                <Link href="/home">
                  <Play className="mr-2 h-5 w-5 fill-white" />
                  Start watching
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 bg-background/40 px-6 backdrop-blur">
                <Link href="/browse">
                  Browse catalog <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <InstallButton />
            </div>
          </motion.div>
        </div>

        {!ready && (
          <div className="absolute bottom-6 right-6 z-10 hidden animate-pulse text-xs text-muted-foreground sm:block">
            warming up the projector…
          </div>
        )}
      </section>

      {/* ------------------------------------------------------ features */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6" data-testid="features">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground" data-aos="fade-up">
          Why AniKuoshi
        </p>
        <h2 className="mt-2 max-w-xl text-balance text-2xl font-bold tracking-tight sm:text-3xl" data-aos="fade-up">
          A streaming app engineered like a product, not a scrape.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                data-aos="fade-up"
                data-aos-delay={(i % 3) * 80}
                className="group rounded-2xl border border-border/70 bg-card/60 p-6 transition-all hover:border-primary/40 hover:bg-card"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-[15px] font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ----------------------------------------------------------- CTA */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6" data-aos="fade-up">
        <div className="relative overflow-hidden rounded-3xl border border-border/70 p-10 text-center sm:p-16">
          <div className="absolute inset-0 bg-muted" aria-hidden />
          
          <h2 className="relative text-balance text-2xl font-bold tracking-tight sm:text-4xl">
            Ready when you are.
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
            Open the app, pick something trending, press play. Install it for a fullscreen,
            chrome-less experience with keyboard shortcuts.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="h-12 border-0 bg-primary px-8 text-primary-foreground">
              <Link href="/home">Enter AniKuoshi</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12">
              <Link href="/search">Find a title</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------- hero slideshow */

function HeroSlideshow({ slides }: { slides: SpotlightItem[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setActive((a) => (a + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, [slides.length]);

  return (
    <>
      {/* FIX (v1.2.1): v2.3.0 spotlights also carry landscape `cover` art —
          fall back to it when `poster` is missing so the BG hero always
          has an image once /api/home responds. */}
      {slides.map((s, i) => (
        <img
          key={s.slug || i}
          src={s.poster || s.cover}
          alt=""
          loading={i === 0 ? "eager" : "lazy"}
          className={`absolute inset-0 h-full w-full object-cover transition-all duration-[1600ms] ease-out ${
            i === active ? "scale-100 opacity-100" : "scale-105 opacity-0"
          }`}
        />
      ))}
      <div className="absolute bottom-6 right-4 z-10 hidden flex-col items-end gap-1.5 sm:flex" aria-hidden>
        {slides.map((s, i) => (
          <button
            key={s.slug || i}
            onClick={() => setActive(i)}
            className={`h-1 rounded-full transition-all ${i === active ? "w-8 bg-foreground" : "w-4 bg-foreground/30"}`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </>
  );
}
