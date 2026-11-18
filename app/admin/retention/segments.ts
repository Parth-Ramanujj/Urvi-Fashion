import { lifetimeSpend, tierOf } from "@/lib/retention-core";
import type { DB, Tier, User } from "@/lib/types";

export const SEGMENTS = {
  new: { label: "New buyers", hint: "1 order, recent" },
  active: { label: "Repeat buyers", hint: "2+ orders, recent" },
  vip: { label: "VIPs", hint: "Most loyal, recent" },
  at_risk: { label: "At risk", hint: "Haven't ordered in a while" },
  churned: { label: "Churned", hint: "Gone quiet" },
  never: { label: "Never purchased", hint: "Signed up, no order" },
} as const;
export type Segment = keyof typeof SEGMENTS;

export type CustomerRow = { user: User; orders: number; spend: number; lastOrderAt: number | null; tier: Tier; segment: Segment };

/** Every non-blocked customer lands in exactly one segment. */
export function segmentCustomers(d: DB, now = Date.now()): CustomerRow[] {
  const { atRiskDays, churnDays, vipOrders } = d.retention.segments;
  const DAY = 86_400_000;
  return d.users.filter((u) => u.role === "customer" && !u.blocked).map((user) => {
    const mine = d.orders.filter((o) => o.userId === user.id && o.status !== "cancelled");
    const lastOrderAt = mine.length ? Math.max(...mine.map((o) => o.createdAt)) : null;
    const spend = lifetimeSpend(d, user.id);
    const age = lastOrderAt === null ? Infinity : (now - lastOrderAt) / DAY;
    const segment: Segment =
      lastOrderAt === null ? "never"
      : age > churnDays ? "churned"
      : age > atRiskDays ? "at_risk"
      : mine.length >= vipOrders ? "vip"
      : mine.length >= 2 ? "active"
      : "new";
    return { user, orders: mine.length, spend, lastOrderAt, tier: tierOf(spend, d.retention.tiers).tier, segment };
  });
}
