"use client";

/**
 * App bootstrap providers: AOS (Animate On Scroll) init respecting the
 * user's reduced-motion preference + PWA service worker registration.
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function AosProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const AOS = (await import("aos")).default;
        await import("aos/dist/aos.css");
        if (cancelled) return;
        const reduced =
          document.documentElement.dataset.reducedMotion === "true" ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        AOS.init({
          duration: 650,
          easing: "ease-out-cubic",
          once: true,
          offset: 48,
          disable: () => reduced,
        });
      } catch {
        /* AOS is cosmetic — never block the app */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Refresh AOS on route change so newly mounted sections animate in.
    import("aos")
      .then(({ default: AOS }) => AOS.refreshHard())
      .catch(() => {});
  }, [pathname]);

  return <>{children}</>;
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    /**
     * FIX (v1.1.1): register in production builds only. In dev, Turbopack
     * reuses chunk URLs while their contents change; the SW's cache-first
     * handling of /_next/static/ then serves stale JS/CSS and masks freshly
     * deployed code (observed as "my fix isn't running" during testing).
     */
    if (process.env.NODE_ENV !== "production") return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}

/** Global keyboard shortcuts: "/" focuses search, "?" opens help, Escape closes.
 * FIX (v1.3.0 — §1): shortcut audit — "/" and "?" now preventDefault (so "?"
 * doesn't ALSO type into a focused non-typing target and "/" doesn't open
 * quick-find in Firefox), both ignore ctrl/alt/meta chords, and the "/"
 * focus path also skips buttons/links so it can't steal focus mid-interaction.
 */
export function GlobalShortcuts() {
  const pathname = usePathname();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if (typing) return;
      if (e.key === "/") {
        const search = document.querySelector<HTMLInputElement>("[data-quick-search]");
        if (search && !search.closest('[aria-hidden="true"]')) {
          e.preventDefault();
          search.focus();
        } else if (pathname !== "/search") {
          e.preventDefault();
          window.location.href = "/search";
        }
      }
      if (e.key === "?") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("anikuoshi:shortcuts"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname]);
  return null;
}
