import { cookies } from "next/headers";
import { safeNext, startSession } from "@/lib/auth";
import { newId } from "@/lib/crypto";
import { mutate } from "@/lib/db";
import { creditCoins, newReferralCode } from "@/lib/retention-core";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = process.env.APP_URL || url.origin;
  const jar = await cookies();
  let saved: { state?: string; next?: string; ref?: string } = {};
  try { saved = JSON.parse(jar.get("g_state")?.value ?? "{}") as typeof saved; } catch { saved = {}; }
  jar.delete("g_state");
  const code = url.searchParams.get("code");
  if (!code || !saved.state || saved.state !== url.searchParams.get("state")) return Response.redirect(`${base}/login?error=google_failed`);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${base}/api/auth/google/callback`, grant_type: "authorization_code" }),
  }).catch(() => null);
  const token = tokenRes?.ok ? await tokenRes.json().catch(() => ({})) : {};
  if (!token.access_token) return Response.redirect(`${base}/login?error=google_failed`);
  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } }).catch(() => null);
  const info = infoRes?.ok ? await infoRes.json().catch(() => ({})) : {};
  if (!info.sub || !info.email || !info.email_verified) return Response.redirect(`${base}/login?error=google_failed`);

  const result = await mutate((d) => {
    let u = d.users.find((x) => x.googleId === info.sub) ?? d.users.find((x) => x.email === String(info.email).toLowerCase());
    if (u?.blocked) return null;
    if (!u) {
      u = { id: newId(), name: info.name || info.email, email: String(info.email).toLowerCase(), role: "customer", blocked: false, addresses: [], measurements: {}, createdAt: Date.now(), lastActiveAt: Date.now(), coins: 0, referralCode: newReferralCode(info.name || info.email) };
      d.users.push(u);
      const r = d.retention;
      if (r.loyalty.enabled && r.loyalty.welcomeCoins) creditCoins(d, u, r.loyalty.welcomeCoins, "Welcome bonus");
      const refCode = (saved.ref ?? "").trim().toUpperCase();
      const inviter = refCode && r.referral.enabled ? d.users.find((x) => x.referralCode === refCode && x.id !== u!.id && !x.blocked) : undefined;
      if (inviter) {
        u.referredBy = inviter.id;
        creditCoins(d, u, r.referral.refereeCoins, `Joined with ${inviter.name.split(" ")[0]}'s referral code`);
      }
    }
    u.googleId = info.sub;
    return u.id;
  });
  if (!result) return Response.redirect(`${base}/login?error=blocked`);
  await startSession(result);
  return Response.redirect(`${base}${safeNext(saved.next)}`);
}
