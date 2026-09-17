"use client";

/**
 * /profile — identity hub: avatar upload (client-resized data URL), display
 * name, password change (old+new+confirm, no reset flow) + my list &
 * continue-watching preview.
 *
 * FIX (v1.2.0 — §6): the theme variant / accent palette controls moved to
 * the dedicated /settings page (linked below and in the sidebar).
 * FIX (v1.2.1): the remaining Preferences panel (title language, default
 * server, playback toggles) moved to /settings as well — one home for all
 * settings; /profile now links there and stays identity + lists only.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Camera,
  History,
  KeyRound,
  Link2,
  LogOut,
  Palette,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-provider";
import { KuoshiLoader } from "@/components/layout/logo";

/**
 * Downscale any image file to a 256×256 data URL — small enough for the DB.
 * FIX (v1.3.0 — §7): encoder fallback — older Safari/Firefox cannot encode
 * WebP from a canvas (they silently return PNG or throw), so try WebP →
 * JPEG → PNG and keep the first output that the profile API accepts.
 */
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas unavailable"));
        const min = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, 256, 256);
        URL.revokeObjectURL(url);
        for (const [mime, q] of [
          ["image/webp", 0.85],
          ["image/jpeg", 0.85],
          ["image/png", 1],
        ] as const) {
          try {
            const dataUrl = canvas.toDataURL(mime, q);
            if (/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)) return resolve(dataUrl);
          } catch {
            /* try the next encoder */
          }
        }
        reject(new Error("Couldn't encode the image"));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e instanceof Error ? e : new Error("Image processing failed"));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't a readable image"));
    };
    img.src = url;
  });
}

export default function ProfilePage() {
  const { user, loading, refresh, logout } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [listItems, setListItems] = useState<{ animeKey: string; animeTitle: string; poster: string | null; status: string }[]>([]);
  const [history, setHistory] = useState<{ animeKey: string; animeTitle: string; poster: string | null; episode: number; positionSeconds: number }[]>([]);

  useEffect(() => {
    if (user) setName(user.username);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/user/list").then((r) => r.json()).then((d) => setListItems(d.items ?? [])).catch(() => {});
    fetch("/api/user/progress?limit=12").then((r) => r.json()).then((d) => setHistory(d.items ?? [])).catch(() => {});
  }, [user]);

  if (loading) return <KuoshiLoader size={64} label="Loading profile…" />;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <UserRound className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">You&apos;re not signed in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to manage your profile, lists and synced preferences.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild className="border-0 bg-primary text-primary-foreground"><Link href="/login">Sign in</Link></Button>
          <Button asChild variant="outline"><Link href="/register">Register</Link></Button>
        </div>
      </div>
    );
  }

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file (PNG, JPEG, WebP…)");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("That image is too large — pick one under 15 MB");
      return;
    }
    setUploadingAvatar(true);
    try {
      const dataUrl = await fileToAvatar(file);
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error || "Upload failed");
      await refresh();
      toast.success("Avatar updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveName = async () => {
    setSavingName(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name.trim() }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error || "Save failed");
      await refresh();
      toast.success("Username updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update username");
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nextPw !== confirmPw) {
      toast.error("New passwords do not match");
      return;
    }
    setSavingPw(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: currentPw, next: nextPw, confirm: confirmPw }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error || "Change failed");
      toast.success("Password changed");
      setCurrentPw(""); setNextPw(""); setConfirmPw("");
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : "Couldn't change password");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6">
      {/* ------------------------------------------------------- identity */}
      <Card className="border-border/70 bg-card/70 backdrop-blur" data-aos="fade-up">
        <CardContent className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingAvatar}
            className="group relative h-20 w-20 overflow-hidden rounded-2xl border border-border/70"
            aria-label="Change avatar"
            title="Upload an image"
            data-testid="avatar-button"
          >
            {uploadingAvatar ? (
              <span className="flex h-full w-full items-center justify-center bg-muted text-[10px] font-medium text-muted-foreground">
                Uploading…
              </span>
            ) : user.avatarUrl ? (
               
              <img src={user.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-primary text-2xl font-black text-primary-foreground">
                {user.username.charAt(0).toUpperCase()}
              </span>
            )}
            {!uploadingAvatar && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-5 w-5 text-white" />
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadAvatar(f);
              e.target.value = "";
            }}
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{user.username}</h1>
            <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
              <Link2 className="h-3 w-3" /> {user.email}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Member since {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
          <Button variant="outline" onClick={async () => { await logout(); toast.success("Signed out"); }}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* -------------------------------------------------- account */}
        <div className="space-y-6">
          <Card className="border-border/70 bg-card/70 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <UserRound className="h-4 w-4 text-primary" /> Display name
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} minLength={3} maxLength={24} />
                <Button onClick={saveName} disabled={savingName || name.trim() === user.username} className="border-0 bg-primary text-primary-foreground">
                  {savingName ? "Saving…" : "Save"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">3–24 characters. Used on your avatar fallback and continue-watching greeting.</p>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="h-4 w-4 text-primary" /> Change password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={changePassword} className="space-y-3">
                <div>
                  <Label htmlFor="cpw">Current password</Label>
                  <Input id="cpw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required className="mt-1" autoComplete="current-password" />
                </div>
                <div>
                  <Label htmlFor="npw">New password</Label>
                  <Input id="npw" type="password" value={nextPw} onChange={(e) => setNextPw(e.target.value)} required minLength={8} className="mt-1" autoComplete="new-password" />
                </div>
                <div>
                  <Label htmlFor="npw2">Confirm new password</Label>
                  <Input id="npw2" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required minLength={8} className="mt-1" autoComplete="new-password" />
                </div>
                <Button type="submit" disabled={savingPw} className="w-full">
                  {savingPw ? "Updating…" : "Update password"}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  No reset flow exists by design — keep this safe. Signed-in sessions stay valid.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* ------------------------- preferences → live in /settings (v1.2.1) */}
        <div className="space-y-6">
          <Card
            className="border-border/70 bg-card/70 backdrop-blur transition-colors hover:border-primary/40"
            id="settings"
            data-testid="profile-settings-link"
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Settings className="h-4 w-4 text-primary" /> Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href="/settings"
                className="flex min-h-[44px] items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <span>
                  <span className="block font-medium">Playback, appearance &amp; preferences</span>
                  <span className="text-xs text-muted-foreground">
                    Default language, provider, title &amp; character language, playback toggles, theme
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">Settings →</span>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* --------------------------------------------------------- my list */}
      <Card className="mt-6 border-border/70 bg-card/70 backdrop-blur" id="list">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> My list
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listItems.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Nothing saved yet — hit “Add to list” on any anime page.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5">
              {listItems.map((li) => (
                <Link key={li.animeKey} href={`/anime/${encodeURIComponent(li.animeKey)}`} className="group">
                  <div className="relative">
                    {li.poster ? (
                       
                      <img src={li.poster} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover" />
                    ) : (
                      <div className="aspect-[2/3] w-full rounded-lg bg-muted" />
                    )}
                    <span className="absolute left-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold capitalize text-white">
                      {li.status}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-xs font-medium">{li.animeTitle}</p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------------------------------------------- continue watching */}
      <Card className="mt-6 border-border/70 bg-card/70 backdrop-blur" id="history">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-semibold">
            <span className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Continue watching
            </span>
            {/* FIX (v1.2.0 — §7): full history lives on /history now */}
            <Link href="/history" className="text-xs font-normal text-muted-foreground hover:text-foreground">
              View all →
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Watch something and it will show up here.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <Link
                  key={h.animeKey}
                  href={`/watch?key=${encodeURIComponent(h.animeKey)}&ep=${h.episode}`}
                  className="flex items-center gap-3 rounded-xl border border-border/60 p-2 transition-colors hover:border-primary/40 hover:bg-accent/40"
                >
                  {h.poster ? (
                     
                    <img src={h.poster} alt="" loading="lazy" className="h-14 w-10 rounded object-cover" />
                  ) : (
                    <Skeleton className="h-14 w-10 rounded" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{h.animeTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      EP {h.episode} · {Math.floor(h.positionSeconds / 60)}m watched
                    </p>
                  </div>
                  <Palette className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
