"use client";

/** /login — email/username + password. No reset flow (by design). */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(id, pw);
      router.push("/home");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-20">
      <div className="rounded-3xl border border-border/70 bg-card/70 p-8 shadow-xl backdrop-blur" data-aos="fade-up">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <LogIn className="h-5 w-5 text-primary" /> Welcome back
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign in to sync watch progress, history and your list.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="login">Email or username</Label>
            <Input id="login" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" required className="mt-1.5" placeholder="you@example.com" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required className="mt-1.5" placeholder="••••••••" />
          </div>

          {err && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
              {err}
            </p>
          )}

          <Button type="submit" disabled={busy} className="h-11 w-full border-0 bg-primary text-primary-foreground">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          New here?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
          <span className="mx-1.5 opacity-40">·</span>
          Password changes happen in profile settings — there is intentionally no reset flow.
        </p>
      </div>
    </div>
  );
}
