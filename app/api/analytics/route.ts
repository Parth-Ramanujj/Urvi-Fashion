import { currentUser } from "@/lib/auth";
import { newId } from "@/lib/crypto";
import { mutate } from "@/lib/db";
import { str } from "@/lib/server-utils";
import type { AnalyticsKind } from "@/lib/types";

const KINDS = new Set<AnalyticsKind>(["product_view", "add_to_cart", "wishlist_add", "search", "checkout_start"]);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || !KINDS.has(body.kind as AnalyticsKind)) return new Response(null, { status: 204 });
    const u = await currentUser();
    await mutate((d) => {
      const list = (d.analytics ??= []);
      list.unshift({
        id: newId(6),
        kind: body.kind as AnalyticsKind,
        userId: u?.id,
        userName: u?.name ?? "Guest",
        productId: str(body.productId, 30) || undefined,
        productName: str(body.productName, 120) || undefined,
        slug: str(body.slug, 120) || undefined,
        meta: str(body.meta, 120) || undefined,
        at: Date.now(),
      });
      if (list.length > 1500) list.length = 1500;
    });
  } catch {
    // Analytics must never break the user's shopping flow
  }
  return new Response(null, { status: 204 });
}
