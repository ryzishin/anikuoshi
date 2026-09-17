"use client";

/**
 * /settings — v1.2.0 (§6 + §2) · v1.2.1 — one home for ALL user settings.
 *
 * The Appearance section that used to live inline in the sidebar moved here
 * in v1.2.0, this page hosts the "Default player" preference, and in v1.2.1
 * the Preferences panel that used to live on /profile (title language,
 * default server, playback toggles) moved here too — so /profile is identity
 * + lists only and /settings is the single place to tune the app.
 * Everything persists: appearance via the theme engine, the rest via the
 * preferences store (localStorage for guests, PATCH /api/user/preferences
 * when signed in).
 */
import Link from "next/link";
import { ChevronLeft, MonitorPlay, Palette, Settings as SettingsIcon, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ACCENTS, THEME_VARIANTS, useThemeEngine } from "@/components/theme-engine";
import { usePreferences } from "@/components/preferences-provider";
import { PLAYER_TYPES } from "@/components/player/player-engine";

export default function SettingsPage() {
  const { variant, accent, setVariant, setAccent } = useThemeEngine();
  const { prefs, setPref } = usePreferences();

  const defaultPlayer = prefs.defaultPlayer ?? "";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild aria-label="Go back" className="min-touch shrink-0">
          <Link href="/home">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <SettingsIcon className="h-6 w-6 text-primary" /> Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Appearance and playback defaults. Signed-in changes sync to your profile.
          </p>
        </div>
      </div>

      {/* --------------------------------------------- default player (§2) */}
      <Card className="mt-6 border-border/70 bg-card/70 backdrop-blur" data-testid="settings-default-player">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <MonitorPlay className="h-4 w-4 text-primary" /> Default player
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Which engine loads first on the watch page. The in-player switcher still lets you change
            engines any time — this only decides who starts.
          </p>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {PLAYER_TYPES.map((t, i) => (
              <button
                key={t.id}
                onClick={() => {
                  setPref("defaultPlayer", t.id);
                  try { localStorage.setItem("anikuoshi.playerType", t.id); } catch {}
                }}
                aria-pressed={defaultPlayer === t.id}
                className={`rounded-lg border px-3 py-2.5 text-left text-xs transition-all ${
                  defaultPlayer === t.id
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                <span className="block text-sm font-semibold">
                  {t.label}
                  {i === 0 && !defaultPlayer ? (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide">
                      loads first today
                    </span>
                  ) : null}
                  {defaultPlayer === t.id ? (
                    <span className="ml-2 rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                      selected
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block leading-snug">{t.hint}</span>
              </button>
            ))}
          </div>
          {!defaultPlayer && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Nothing picked yet — the Senshi engine (order position 3) loads first until you choose.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ------------------------- playback & preferences (moved from /profile) */}
      <Card className="mt-6 border-border/70 bg-card/70 backdrop-blur" data-testid="settings-playback">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="h-4 w-4 text-primary" /> Playback &amp; preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">Title language</Label>
              <Select value={prefs.titleLang || "romaji"} onValueChange={(v) => setPref("titleLang", v as never)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="romaji">Romaji</SelectItem>
                  <SelectItem value="english">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Default server</Label>
              <Select value={prefs.defaultServer || "system"} onValueChange={(v) => setPref("defaultServer", v as never)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sub">Sub</SelectItem>
                  <SelectItem value="dub">Dub</SelectItem>
                  <SelectItem value="system">System (auto)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {([
            ["autoplayNext", "Auto-play next episode", "Starts the next episode when the current one truly ends"],
            ["autoplay", "Autoplay", "Start playing automatically after a server or episode switch"],
            ["autoSkip", "Auto-skip intro / outro", "Seek past recaps and credits automatically (where the API provides skip ranges)"],
            ["ambientMode", "Ambient mode", "Glowing backdrop behind the player"],
            ["reducedMotion", "Reduced motion", "Disable entrance animations (accessibility)"],
          ] as const).map(([key, label, hint]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-[11px] text-muted-foreground">{hint}</p>
              </div>
              <Switch
                checked={prefs[key] !== false}
                onCheckedChange={(v) => setPref(key, key === "reducedMotion" ? v || false : v)}
                aria-label={label}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* --------------------------------- appearance (moved from sidebar §6) */}
      <Card className="mt-6 border-border/70 bg-card/70 backdrop-blur" data-testid="settings-appearance">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Palette className="h-4 w-4 text-primary" /> Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-[11px] text-muted-foreground">Theme variant</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {THEME_VARIANTS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setVariant(t.id)}
                  title={t.hint}
                  aria-pressed={variant === t.id}
                  className={`rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-all ${
                    variant === t.id
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-[11px] text-muted-foreground">Accent palette</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  aria-label={`Accent ${a.label}`}
                  title={a.label}
                  onClick={() => setAccent(a.id)}
                  className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                    accent === a.id ? "ring-2 ring-foreground/70 ring-offset-2 ring-offset-background" : ""
                  }`}
                  style={{ backgroundImage: a.swatch }}
                />
              ))}
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Appearance choices apply instantly and stay on this device; when you sign in they are also
            pushed to your profile so other devices converge. Playback toggles (auto play, auto next,
            auto skip) live in the Playback card above and under the player on the watch page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
