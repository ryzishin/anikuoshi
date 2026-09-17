"use client";

/**
 * Preferences context — local (guest) + server-synced (signed in).
 * Mirrors the store Preferences type. Applies instantly across cards/rows.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Preferences } from "@/lib/store/types";
import { useAuth } from "./auth-provider";
import { useThemeEngine } from "./theme-engine";

const KEY = "anikuoshi.prefs";
const DEFAULTS: Preferences = {
  titleLang: "romaji",
  defaultServer: "system",
  autoplayNext: true,
  autoplay: true,
  autoSkip: false,
  defaultPlayer: undefined,
  reducedMotion: false,
  ambientMode: false,
};

type PrefsContext = {
  prefs: Preferences;
  titleLang: "romaji" | "english";
  setPref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
};

const Ctx = createContext<PrefsContext | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { setAccent, setVariant, setReducedMotion, variant, accent, reducedMotion } = useThemeEngine();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);

  // hydrate from local storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  // on sign-in: merge functional prefs from the profile, keep LOCAL
  // appearance choices (theme/accent/motion) as source of truth, and push
  // them to the server so devices converge.
  useEffect(() => {
    if (!user) return;
    setPrefs((prev) => ({
      ...prev,
      titleLang: user.preferences.titleLang ?? prev.titleLang,
      defaultServer: user.preferences.defaultServer ?? prev.defaultServer,
      autoplayNext: user.preferences.autoplayNext ?? prev.autoplayNext,
      autoplay: user.preferences.autoplay ?? prev.autoplay,
      autoSkip: user.preferences.autoSkip ?? prev.autoSkip,
      defaultPlayer: user.preferences.defaultPlayer ?? prev.defaultPlayer,
    }));
    const appearance = {
      theme: variant,
      accent,
      reducedMotion,
    };
    fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(appearance),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setPref = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {}
        if (user) {
          fetch("/api/user/preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(next),
          }).catch(() => {});
        }
        // explicit user change → mirror into the theme engine immediately
        if (key === "accent" && value) setAccent(value as never);
        if (key === "theme" && value) setVariant(value as never);
        if (key === "reducedMotion" && typeof value === "boolean") setReducedMotion(value);
        return next;
      });
    },
    [user, setAccent, setVariant, setReducedMotion]
  );

  const value = useMemo(
    () => ({ prefs, titleLang: (prefs.titleLang as "romaji" | "english") || "romaji", setPref }),
    [prefs, setPref]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePreferences() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
