"use client";

/**
 * AniKuoshi theme engine:
 *   - next-themes handles light/dark class
 *   - dark *variants* (dark | midnight | dim | contrast) via <html class="theme-*">
 *   - accent palettes via <html data-accent="...">
 *   - reduced motion via <html data-reduced-motion="true">
 * Persisted in localStorage; synced to the user profile when signed in.
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export type ThemeVariant = "dark" | "midnight" | "dim" | "contrast";
export type AccentId = "violet" | "sakura" | "ocean" | "emerald" | "amber" | "crimson" | "azure" | "mint";

export const ACCENTS: { id: AccentId; label: string; swatch: string }[] = [
  { id: "violet", label: "Violet", swatch: "linear-gradient(135deg,#8b5cf6,#d946ef)" },
  { id: "sakura", label: "Sakura", swatch: "linear-gradient(135deg,#f472b6,#fb7185)" },
  { id: "ocean", label: "Ocean", swatch: "linear-gradient(135deg,#22d3ee,#34d399)" },
  { id: "emerald", label: "Emerald", swatch: "linear-gradient(135deg,#34d399,#a3e635)" },
  { id: "amber", label: "Amber", swatch: "linear-gradient(135deg,#fbbf24,#fb923c)" },
  { id: "crimson", label: "Crimson", swatch: "linear-gradient(135deg,#f87171,#fb923c)" },
  { id: "azure", label: "Azure", swatch: "linear-gradient(135deg,#60a5fa,#818cf8)" },
  { id: "mint", label: "Mint", swatch: "linear-gradient(135deg,#5eead4,#67e8f9)" },
];

export const THEME_VARIANTS: { id: ThemeVariant; label: string; hint: string }[] = [
  { id: "dark", label: "Kuoshi", hint: "Signature violet-charcoal" },
  { id: "midnight", label: "Midnight", hint: "Inky cinematic blue-black" },
  { id: "dim", label: "Dim", hint: "Warm graphite, easy on eyes" },
  { id: "contrast", label: "Contrast", hint: "True black for OLED" },
];

type ThemeSettings = {
  variant: ThemeVariant;
  accent: AccentId;
  reducedMotion: boolean;
  ambientMode: boolean;
};

type ThemeEngineContext = ThemeSettings & {
  setVariant: (v: ThemeVariant) => void;
  setAccent: (a: AccentId) => void;
  setReducedMotion: (v: boolean) => void;
  setAmbientMode: (v: boolean) => void;
};

const KEY = "anikuoshi.theme";
const Ctx = createContext<ThemeEngineContext | null>(null);

export function applyToDom(s: ThemeSettings) {
  const root = document.documentElement;
  root.classList.remove("theme-dark", "theme-midnight", "theme-dim", "theme-contrast");
  if (s.variant !== "dark") root.classList.add(`theme-${s.variant}`);
  root.dataset.accent = s.accent;
  root.dataset.reducedMotion = String(s.reducedMotion);
}

export function ThemeEngineProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>({
    variant: "dark",
    accent: "violet",
    reducedMotion: false,
    ambientMode: false,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ThemeSettings>;
        const merged = { ...settings, ...parsed };
        setSettings(merged);
        applyToDom(merged);
      }
    } catch {
      /* corrupted storage — keep defaults */
    }
     
  }, []);

  const update = useCallback((patch: Partial<ThemeSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      applyToDom(next);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      window.dispatchEvent(new CustomEvent("anikuoshi:theme", { detail: next }));
      return next;
    });
  }, []);

  return (
    <Ctx.Provider
      value={{
        ...settings,
        setVariant: (variant) => update({ variant }),
        setAccent: (accent) => update({ accent }),
        setReducedMotion: (reducedMotion) => update({ reducedMotion }),
        setAmbientMode: (ambientMode) => update({ ambientMode }),
      }}
    >
      <NextThemesProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
      >
        {children}
      </NextThemesProvider>
    </Ctx.Provider>
  );
}

export function useThemeEngine() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useThemeEngine must be used within ThemeEngineProvider");
  return ctx;
}
