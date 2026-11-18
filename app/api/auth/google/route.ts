import { cookies } from "next/headers";
import { newId } from "@/lib/crypto";

export async function GET(req: Request) {
  const id = process.env.GOOGLE_CLIENT_ID;
  const base = process.env.APP_URL || new URL(req.url).origin;
  if (!id || !process.env.GOOGLE_CLIENT_SECRET) return Response.redirect(`${base}/login?error=google_not_configured`);
  const state = newId(16);
  const next = new URL(req.url).searchParams.get("next") || "/";
  (await cookies()).set("g_state", JSON.stringify({ state, next: next.startsWith("/") ? next : "/" }), { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  const q = new URLSearchParams({ client_id: id, redirect_uri: `${base}/api/auth/google/callback`, response_type: "code", scope: "openid email profile", state, prompt: "select_account" });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
}
