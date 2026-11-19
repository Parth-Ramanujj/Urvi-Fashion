import { cookies } from "next/headers";
import { startSession } from "@/lib/auth";
import { newId } from "@/lib/crypto";
import { mutate } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = process.env.APP_URL || url.origin;
  const jar = await cookies();
  const saved = JSON.parse(jar.get("g_state")?.value ?? "{}") as { state?: string; next?: string };
  jar.delete("g_state");
  const code = url.searchParams.get("code");
  if (!code || !saved.state || saved.state !== url.searchParams.get("state")) return Response.redirect(`${base}/login?error=google_failed`);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${base}/api/auth/google/callback`, grant_type: "authorization_code" }),
  });
  const token = await tokenRes.json().catch(() => ({}));
  if (!token.access_token) return Response.redirect(`${base}/login?error=google_failed`);
  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } }).then((r) => r.json());
  if (!info.sub || !info.email || !info.email_verified) return Response.redirect(`${base}/login?error=google_failed`);

  const result = await mutate((d) => {
    let u = d.users.find((x) => x.googleId === info.sub) ?? d.users.find((x) => x.email === String(info.email).toLowerCase());
    if (u?.blocked) return null;
    if (!u) {
      u = { id: newId(), name: info.name || info.email, email: String(info.email).toLowerCase(), role: "customer", blocked: false, addresses: [], measurements: {}, createdAt: Date.now(), lastActiveAt: Date.now() };
      d.users.push(u);
    }
    u.googleId = info.sub;
    return u.id;
  });
  if (!result) return Response.redirect(`${base}/login?error=blocked`);
  await startSession(result);
  return Response.redirect(`${base}${saved.next || "/"}`);
}
