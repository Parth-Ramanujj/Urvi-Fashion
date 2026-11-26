import { dbStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const s = await dbStatus();
    return Response.json({ ok: true, mode: s.mode }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[health]", e);
    return Response.json({ ok: false, error: "Database unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
