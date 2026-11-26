import { cookies } from "next/headers";
import { safeNext } from "@/lib/auth";
import { newId } from "@/lib/crypto";

export async function GET(req: Request) {
  const id = process.env.GOOGLE_CLIENT_ID;
  const base = process.env.APP_URL || new URL(req.url).origin;
  if (!id || !process.env.GOOGLE_CLIENT_SECRET) return Response.redirect(`${base}/login?error=google_not_configured`);
  const sp = new URL(req.url).searchParams;
  const state = newId(16);
  const next = safeNext(sp.get("next"));
  const ref = (sp.get("ref") ?? "").trim().toUpperCase().slice(0, 20);
  (await cookies()).set("g_state", JSON.stringify({ state, next, ref }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/",
  });
  const q = new URLSearchParams({ client_id: id, redirect_uri: `${base}/api/auth/google/callback`, response_type: "code", scope: "openid email profile", state, prompt: "select_account" });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
}
