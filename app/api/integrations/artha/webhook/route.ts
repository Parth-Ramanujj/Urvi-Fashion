import { after, NextResponse } from "next/server";
import { deliverQueuedMessages, processArthaWebhook, verifyWebhook } from "@/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 256 * 1024;

export async function POST(req: Request) {
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BODY) return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
  if (!verifyWebhook(raw, req.headers, new URL(req.url))) {
    return NextResponse.json({ ok: false, error: "Invalid webhook signature" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const result = await processArthaWebhook(body);
    if (result.replyQueued) after(() => deliverQueuedMessages(5).catch((e) => console.error("[artha webhook] reply delivery failed", e)));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[artha webhook]", e);
    return NextResponse.json({ ok: false, error: "Webhook processing failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "artha-webhook" });
}
