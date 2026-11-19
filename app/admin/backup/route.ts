import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Full store backup as JSON (admin only). Contains password hashes and the session secret: store it privately.
// Restore: put it at DATA_DIR/db.json and start the app on an empty database; it is imported automatically.
export async function GET() {
  const u = await currentUser();
  if (u?.role !== "admin") return new Response("Forbidden", { status: 403 });
  const d = db();
  const name = `${(d.brand?.name ?? "store").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  return new Response(JSON.stringify(d), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
