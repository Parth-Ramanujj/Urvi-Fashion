import { currentUser } from "@/lib/auth";
import { mutate } from "@/lib/db";
import { recordActivity, str } from "@/lib/server-utils";
import type { AnalyticsKind } from "@/lib/types";

const KINDS = new Set<AnalyticsKind>([
  "page_view",
  "product_view",
  "add_to_cart",
  "remove_from_cart",
  "wishlist_add",
  "wishlist_remove",
  "search",
  "checkout_start",
  "coupon_apply",
]);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || !KINDS.has(body.kind as AnalyticsKind)) return new Response(null, { status: 204 });
    const u = await currentUser();
    const kind = body.kind as AnalyticsKind;
    // Skip admin page views so store owner navigation doesn't skew shopper analytics.
    if (kind === "page_view" && u?.role === "admin" && str(body.meta, 120).startsWith("/admin")) {
      return new Response(null, { status: 204 });
    }
    await mutate((d) => {
      recordActivity(d, {
        kind,
        userId: u?.id,
        userName: u?.name ?? "Guest",
        productId: str(body.productId, 30) || undefined,
        productName: str(body.productName, 120) || undefined,
        slug: str(body.slug, 120) || undefined,
        meta: str(body.meta, 120) || undefined,
      });
    });
  } catch {
    // Analytics must never break the user's shopping flow
  }
  return new Response(null, { status: 204 });
}
