"use client";

/**
 * /settings — v1.3.0 — one home for ALL user settings. Every control on this
 * page is functional: appearance via the theme engine, the rest via the
 * preferences store (localStorage for guests, PATCH /api/user/preferences
 * when signed in).
 *
 * FIX (v1.3.0 — §8):
 *  - "Default Server" is RENAMED → "Default Provider" and lists the API's
 *    server codenames (riyo, kaito, hana, sora, akira, yuki, miso, kenji,
 *    arashi, taiki). If the chosen provider isn't available for the current
 *    anime/episode, the player falls back to auto ordering.
 *  - Title language is SPLIT into "Anime Titles" (English | Romaji) and
 *    "Characters" (English | Romaji — Western vs family-name-first order).
 *  - NEW "Default Language" (Sub | Dub | System) drives the watch page's
 *    default stream selection.
 *  - "Default player" now lists the two v1.3.0 engines (Vidk, Embed).
 *  - legacy defaultServer ("sub"/"dub") migrates to Default Language
 *    automatically (see migratePreferences in store/types).
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

/**
 * FIX (v1.3.0 — §8): provider codenames actually served by APIKuoshi v2.4.0
 * (src/sources/kaze/helper/cdn.helper.js SERVER_CODENAMES) — no invented ones.
 */
const PROVIDERS: { id: string; label: string; originalName: string }[] = [
  { id: "system", label: "System (auto)", originalName: "best available" },
  { id: "riyo", label: "riyo", originalName: "Vidstream-2" },
  { id: "kaito", label: "kaito", originalName: "Vidstream-1 (beta)" },
  { id: "hana", label: "hana", originalName: "HD-1" },
  { id: "sora", label: "sora", originalName: "HD-2" },
  { id: "akira", label: "akira", originalName: "VidCloud-1" },
  { id: "yuki", label: "yuki", originalName: "VidCloud-2" },
  { id: "miso", label: "miso", originalName: "VidPlay-1" },
  { id: "kenji", label: "kenji", originalName: "VidPlay-2" },
  { id: "arashi", label: "arashi", originalName: "StreamTape-1" },
  { id: "taiki", label: "taiki", originalName: "StreamTape-2" },
];

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
            Language, playback defaults and appearance. Signed-in changes sync to your profile.
          </p>
        </div>
      </div>

      {/* ------------------------------------- language & display (§8 split) */}
      <Card className="mt-6 border-border/70 bg-card/70 backdrop-blur" data-testid="settings-language">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="h-4 w-4 text-primary" /> Language &amp; display
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">Default language</Label>
              <Select value={prefs.defaultLanguage || "system"} onValueChange={(v) => setPref("defaultLanguage", v as "sub" | "dub" | "system")}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System (auto)</SelectItem>
                  <SelectItem value="sub">Sub</SelectItem>
                  <SelectItem value="dub">Dub</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                Sub or dub first when both exist for an episode.
              </p>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Anime titles</Label>
              <Select value={prefs.titleLang || "romaji"} onValueChange={(v) => setPref("titleLang", v as "romaji" | "english")}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="romaji">Romaji</SelectItem>
                  <SelectItem value="english">English</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                Applied on every card, row, list and detail page.
              </p>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Characters</Label>
              <Select value={prefs.charLang || "romaji"} onValueChange={(v) => setPref("charLang", v as "romaji" | "english")}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="romaji">Romaji</SelectItem>
                  <SelectItem value="english">English</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                Romaji = family name first (“Zoro Roronoa”); English = Western order (“Roronoa Zoro”).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --------------------------------------- default provider (§8 rename) */}
      <Card className="mt-6 border-border/70 bg-card/70 backdrop-blur" data-testid="settings-default-provider">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <MonitorPlay className="h-4 w-4 text-primary" /> Default provider
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Which server codename gets picked first on the watch page. If it isn&apos;t available for the
            current anime or episode, the system (auto) order is used instead.
          </p>
          <div className="mt-3">
            <Label className="text-[11px] text-muted-foreground">Preferred provider</Label>
            <Select value={prefs.defaultProvider || "system"} onValueChange={(v) => setPref("defaultProvider", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.id === "system" ? p.label : `${p.label} · ${p.originalName}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPref("defaultProvider", p.id)}
                aria-pressed={(prefs.defaultProvider || "system") === p.id}
                title={p.originalName}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  (prefs.defaultProvider || "system") === p.id
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* --------------------------------------------- default player (§4) */}
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
            {PLAYER_TYPES.map((t) => (
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
                  {!defaultPlayer && t.id === "vidk" ? (
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
        </CardContent>
      </Card>

      {/* ---------------------------------------------- playback toggles */}
      <Card className="mt-6 border-border/70 bg-card/70 backdrop-blur" data-testid="settings-playback">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="h-4 w-4 text-primary" /> Playback
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            auto skip) also live under the player on the watch page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
