import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { runIntegrationCron } from "@/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || process.env.INTEGRATION_CRON_SECRET || "").trim();
  // Local dev may leave it open; production must always configure a secret.
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization") || "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const token = new URL(req.url).searchParams.get("token") || "";
  return safeEqual(bearer || token, secret);
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const result = await runIntegrationCron();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[integration cron]", e);
    return NextResponse.json({ ok: false, error: "Cron failed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
