"use client";

/** /register — unique username + email + password. */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw !== confirm) {
      setErr("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await register(username.trim(), email.trim(), pw);
      router.push("/home");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-20">
      <div className="rounded-3xl border border-border/70 bg-card/70 p-8 shadow-xl backdrop-blur" data-aos="fade-up">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <UserRoundPlus className="h-5 w-5 text-primary" /> Create your account
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          One account unlocks continue watching, lists and synced preferences.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={24} className="mt-1.5" placeholder="senpai_01" />
            <p className="mt-1 text-[11px] text-muted-foreground">3–24 characters · letters, numbers, dots, dashes, underscores.</p>
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" placeholder="you@example.com" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} autoComplete="new-password" className="mt-1.5" placeholder="At least 8 characters" />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" className="mt-1.5" placeholder="Repeat it" />
          </div>

          {err && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
              {err}
            </p>
          )}

          <Button type="submit" disabled={busy} className="brand-gradient h-11 w-full border-0 text-white">
            {busy ? "Creating…" : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
