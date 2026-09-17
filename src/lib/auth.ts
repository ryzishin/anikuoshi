/**
 * AniKuoshi auth — JWT (jose, HS256) in an httpOnly cookie.
 *
 * Flows:
 *   register  -> unique username + email + password (bcrypt hash)
 *   login     -> email OR username + password
 *   me        -> current safe user (from cookie)
 *   password  -> change with old + new + confirm (no reset/recovery flow by design)
 */
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getStore } from "./store";
import { SafeUser } from "./store/types";

const COOKIE = "anikuoshi_session";
const TTL_DAYS = 30;

function secret() {
  const raw = process.env.AUTH_SECRET || "anikuoshi-dev-secret-change-me-in-production";
  return new TextEncoder().encode(raw);
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function issueSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("anikuoshi")
    .setExpirationTime(`${TTL_DAYS}d`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: "anikuoshi" });
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export async function currentUser(): Promise<SafeUser | null> {
  const id = await currentUserId();
  if (!id) return null;
  const store = await getStore();
  return store.findById(id);
}

/** thrown-by-handler helpers ------------------------------------------------ */

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(): Promise<SafeUser> {
  const user = await currentUser();
  if (!user) throw new AuthError("Not signed in", 401);
  return user;
}

export function jsonError(err: unknown) {
  if (err instanceof AuthError) {
    return Response.json({ success: false, error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  return Response.json({ success: false, error: message }, { status: 500 });
}

/** Validation shared by register / profile update. */
export function validateUsername(username: string): string | null {
  if (!username || username.length < 3 || username.length > 24) {
    return "Username must be 3-24 characters";
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return "Username may only contain letters, numbers, dots, dashes and underscores";
  }
  return null;
}

export function validateEmail(email: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password || password.length < 8) return "Password must be at least 8 characters";
  return null;
}
