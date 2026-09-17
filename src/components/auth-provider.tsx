"use client";

/** Client auth context — mirrors /api/auth/me, exposes mutations. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Preferences, SafeUser } from "@/lib/store/types";

type AuthContext = {
  user: SafeUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (login: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  savePreferences: (prefs: Partial<Preferences>) => Promise<void>;
};

const Ctx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const body = await res.json();
      setUser(body.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const mutate = useCallback(
    async (url: string, body: unknown) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Request failed");
      return data;
    },
    []
  );

  const login = useCallback(
    async (login: string, password: string) => {
      await mutate("/api/auth/login", { login, password });
      await refresh();
    },
    [mutate, refresh]
  );

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      await mutate("/api/auth/register", { username, email, password });
      await refresh();
    },
    [mutate, refresh]
  );

  const logout = useCallback(async () => {
    await mutate("/api/auth/logout", {});
    setUser(null);
  }, [mutate]);

  const savePreferences = useCallback(
    async (prefs: Partial<Preferences>) => {
      if (!user) throw new Error("Not signed in");
      const merged = { ...user.preferences, ...prefs };
      setUser({ ...user, preferences: merged });
      await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
    },
    [user]
  );

  const value = useMemo(
    () => ({ user, loading, refresh, login, register, logout, savePreferences }),
    [user, loading, refresh, login, register, logout, savePreferences]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
