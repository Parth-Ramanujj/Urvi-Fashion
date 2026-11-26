import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hmac, safeEqual } from "./crypto";
import { db, mutate } from "./db";
import type { Role, User } from "./types";

const COOKIE = "th_session";
const MAX_AGE = 60 * 60 * 24 * 30;
const PLACEHOLDER_SECRETS = new Set(["change-me-to-a-long-random-string", "secret", "changeme"]);

export function hasStrongSessionSecret() {
  const s = process.env.SESSION_SECRET?.trim() ?? "";
  return s.length >= 16 && !PLACEHOLDER_SECRETS.has(s);
}

const secret = () => {
  const env = process.env.SESSION_SECRET?.trim();
  if (env && !PLACEHOLDER_SECRETS.has(env) && env.length >= 16) return env;
  return db().secret;
};

/** Rejects protocol-relative (//evil.com) and backslash (/\\evil.com) open redirects. */
export function safeNext(v: string | null | undefined, fallback = "/") {
  if (!v || typeof v !== "string") return fallback;
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : fallback;
}

export async function startSession(userId: string) {
  const tv = db().users.find((x) => x.id === userId)?.tokenVersion ?? 0;
  const payload = Buffer.from(JSON.stringify({ uid: userId, tv, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${hmac(secret(), payload)}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE,
  });
  await mutate((d) => { const u = d.users.find((x) => x.id === userId); if (u) u.lastActiveAt = Date.now(); });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !safeEqual(sig, hmac(secret(), payload))) return null;
  try {
    const { uid, tv = 0, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (exp < Date.now()) return null;
    const u = db().users.find((x) => x.id === uid);
    if (!u || u.blocked || (u.tokenVersion ?? 0) !== tv) return null;
    return u;
  } catch {
    return null;
  }
}

export class HttpError extends Error {}

/** For server actions: throws if not signed in / wrong role. */
export async function requireUser(...roles: Role[]) {
  const u = await currentUser();
  if (!u) throw new HttpError("Please log in to continue");
  if (roles.length && !roles.includes(u.role)) throw new HttpError("You don't have access to this");
  return u;
}

/** For pages/layouts: redirects instead of throwing. */
export async function pageUser(next: string, ...roles: Role[]) {
  const u = await currentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (roles.length && !roles.includes(u.role)) redirect("/");
  return u;
}

/** Strip secrets before sending a user to the client. */
export const publicUser = (u: User) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });
export type PublicUser = ReturnType<typeof publicUser>;
