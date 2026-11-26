// Retention rules shared by every write path: coins, tiers, referrals and back-in-stock alerts.
// Pure functions over the DB object (no I/O) so they can run inside mutate().
import { randomBytes } from "node:crypto";
import { DEFAULT_BRAND } from "./brand.ts";
import { mergeIntegrationDefaults, queueAutomation, storeUrl } from "./automation-core.ts";
import type { DB, DeliverySettings, MembershipPlan, Order, RetentionSettings, Tier, User } from "./types";

export const DEFAULT_DELIVERY: DeliverySettings = {
  restrictToCities: false, freeAbove: 999, standardFee: 49, expressFee: 149,
  cities: [
    { id: "ahmedabad", name: "Ahmedabad", active: true, standardFee: 29, expressFee: 79, standardDays: [1, 2], expressDays: [0, 1], express: true, cod: true },
    { id: "mumbai", name: "Mumbai", active: true, standardFee: 49, expressFee: 99, standardDays: [2, 4], expressDays: [1, 1], express: true, cod: true },
    { id: "bengaluru", name: "Bengaluru", active: true, standardFee: 49, expressFee: 129, standardDays: [3, 5], expressDays: [1, 2], express: true, cod: true },
    { id: "delhi", name: "Delhi", active: true, standardFee: 49, expressFee: 129, standardDays: [3, 5], expressDays: [1, 2], express: true, cod: false },
  ],
};

export const DEFAULT_RETENTION: RetentionSettings = {
  loyalty: { enabled: true, earnPer100: 5, maxRedeemPct: 20, welcomeCoins: 50 },
  tiers: [
    { name: "Bronze", minSpend: 0, multiplier: 1, color: "#b4793f" },
    { name: "Silver", minSpend: 10000, multiplier: 1.25, color: "#8e9aa6" },
    { name: "Gold", minSpend: 25000, multiplier: 1.5, color: "#d4a032" },
    { name: "Platinum", minSpend: 50000, multiplier: 2, color: "#5b6b8c" },
  ],
  referral: { enabled: true, referrerCoins: 100, refereeCoins: 100, rewardType: "coupon" },
  membership: {
    enabled: true,
    plans: [
      { id: "plus-m", name: "Plus Monthly", price: 99, days: 30, discountPct: 5, freeDelivery: true, coinMultiplier: 1.5, color: "#7c3aed", active: true, tagline: "Try the perks for a month" },
      { id: "plus-y", name: "Plus Yearly", price: 799, days: 365, discountPct: 10, freeDelivery: true, coinMultiplier: 2, color: "#d4a032", active: true, tagline: "Best value, save 33%" },
    ],
  },
  birthday: { enabled: true, type: "percent", value: 20, validDays: 30 },
  social: {
    enabled: true, coins: 25,
    links: [
      { id: "instagram", label: "Instagram", url: "https://instagram.com/" },
      { id: "facebook", label: "Facebook", url: "https://facebook.com/" },
      { id: "youtube", label: "YouTube", url: "https://youtube.com/" },
    ],
  },
  backInStock: { enabled: true },
  abandonedCart: { enabled: true, afterHours: 2 },
  segments: { atRiskDays: 30, churnDays: 60, vipOrders: 3 },
};

const id = () => randomBytes(9).toString("base64url");
export const newReferralCode = (name: string) => `${(name.replace(/[^a-z]/gi, "").slice(0, 5) || "TH").toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`;

/** Backfill fields for data created before retention existed. Returns true if anything changed. */
export function migrate(d: DB) {
  let changed = false;
  if (!d.retention) { d.retention = structuredClone(DEFAULT_RETENTION); changed = true; }
  if (!d.coinLedger) { d.coinLedger = []; changed = true; }
  if (!d.waitlist) { d.waitlist = []; changed = true; }
  if (!d.delivery) { d.delivery = structuredClone(DEFAULT_DELIVERY); changed = true; }
  if (!d.memberships) { d.memberships = []; changed = true; }
  if (!d.integrationMessages) { d.integrationMessages = []; changed = true; }
  if (!d.integrations) { d.integrations = mergeIntegrationDefaults(undefined); changed = true; }
  else {
    const merged = mergeIntegrationDefaults(d.integrations);
    if (JSON.stringify(merged) !== JSON.stringify(d.integrations)) { d.integrations = merged; changed = true; }
  }
  if (!d.brand) { d.brand = structuredClone(DEFAULT_BRAND); changed = true; }
  else for (const k of Object.keys(DEFAULT_BRAND) as (keyof typeof DEFAULT_BRAND)[]) if (d.brand[k] === undefined) { (d.brand as unknown as Record<string, unknown>)[k] = structuredClone(DEFAULT_BRAND[k]); changed = true; }
  for (const k of ["membership", "birthday", "social"] as const) if (!d.retention[k]) { (d.retention as unknown as Record<string, unknown>)[k] = structuredClone(DEFAULT_RETENTION[k]); changed = true; }
  if (!d.retention.referral.rewardType) { d.retention.referral.rewardType = "coins"; changed = true; }
  for (const u of d.users) {
    if (u.coins === undefined) { u.coins = 0; changed = true; }
    if (!u.referralCode) { u.referralCode = newReferralCode(u.name); changed = true; }
    if (!u.crm) { u.crm = { whatsappOptIn: true }; changed = true; }
  }
  return changed;
}

const COUNTED = new Set(["delivered", "return_requested", "exchange_requested", "exchanged", "return_rejected"]);
export const lifetimeSpend = (d: DB, userId: string) => d.orders.filter((o) => o.userId === userId && COUNTED.has(o.status)).reduce((s, o) => s + o.totals.total, 0);

export function tierOf(spend: number, tiers: Tier[]) {
  const sorted = [...tiers].sort((a, b) => a.minSpend - b.minSpend);
  const i = sorted.reduce((k, t, j) => (spend >= t.minSpend ? j : k), 0);
  return { tier: sorted[i], next: sorted[i + 1] as Tier | undefined };
}

export function creditCoins(d: DB, u: User, amount: number, reason: string, orderId?: string) {
  const amt = Math.round(amount);
  if (!amt) return 0;
  const applied = Math.max(-(u.coins ?? 0), amt); // balance never goes negative
  u.coins = (u.coins ?? 0) + applied;
  d.coinLedger.push({ id: id(), userId: u.id, amount: applied, reason, orderId, at: Date.now() });
  return applied;
}

/** Coins a user may spend on a basket worth `amount` (after coupon). 1 coin = ₹1. */
export const maxRedeemable = (r: RetentionSettings, balance: number, amount: number) =>
  r.loyalty.enabled ? Math.max(0, Math.min(balance, Math.floor((amount * r.loyalty.maxRedeemPct) / 100))) : 0;

const note = (d: DB, userId: string, title: string, body: string, href: string) =>
  d.notifications.push({ id: id(), userId, title, body, href, createdAt: Date.now(), readBy: [] });

/** Earn coins on delivery (tier multiplier) and pay out the referrer on the referee's first delivered order. */
export function onDelivered(d: DB, o: Order) {
  const u = d.users.find((x) => x.id === o.userId);
  if (!u) return;
  const r = d.retention;
  if (r.loyalty.enabled && !o.coinsEarned) {
    const { tier } = tierOf(lifetimeSpend(d, u.id) - o.totals.total, r.tiers);
    const base = o.totals.total - o.totals.delivery - o.totals.tax;
    const plan = activePlan(d, u);
    const earned = Math.floor((base / 100) * r.loyalty.earnPer100 * tier.multiplier * (plan?.coinMultiplier ?? 1));
    if (earned > 0) {
      o.coinsEarned = creditCoins(d, u, earned, `Earned on order ${o.ref}${tier.multiplier > 1 ? ` (${tier.name} ${tier.multiplier}×)` : ""}`, o.id);
      note(d, u.id, `+${earned} coins earned 🪙`, `Thanks for shopping! Use them on your next order.`, "/account/rewards");
    }
  }
  if (r.referral.enabled && u.referredBy && !u.referralRewarded) {
    const ref = d.users.find((x) => x.id === u.referredBy);
    u.referralRewarded = true;
    if (ref && !ref.blocked) {
      const first = u.name.split(" ")[0];
      if (r.referral.rewardType === "coupon") {
        const code = personalCoupon(d, [ref.id], { type: "flat", value: r.referral.referrerCoins, days: 60, description: `Referral reward: ₹${r.referral.referrerCoins} off for inviting ${first}`, prefix: "REF" });
        note(d, ref.id, `You earned a ₹${r.referral.referrerCoins} coupon 🎉`, `${first} just received their first order. Use code ${code} on your next order.`, "/account/rewards");
      } else {
        creditCoins(d, ref, r.referral.referrerCoins, `Referral reward — ${u.name} placed their first order`);
        note(d, ref.id, `You earned ${r.referral.referrerCoins} referral coins 🎉`, `${first} just received their first order.`, "/account/rewards");
      }
    }
  }
}

/** Cancel refunds spent coins; a completed return also takes back the coins that order earned. */
export function onReversed(d: DB, o: Order, status: "cancelled" | "returned") {
  const u = d.users.find((x) => x.id === o.userId);
  if (!u) return;
  if (o.coinsUsed) { creditCoins(d, u, o.coinsUsed, `Refund of coins used on ${o.ref}`, o.id); o.coinsUsed = 0; }
  if (status === "returned" && o.coinsEarned) { creditCoins(d, u, -o.coinsEarned, `Reversed — order ${o.ref} returned`, o.id); o.coinsEarned = 0; }
}

/** Notify everyone waiting on a variant that is back in stock. Runs after every write, so any restock path triggers it. */
export function processWaitlist(d: DB) {
  if (!d.retention?.backInStock.enabled || !d.waitlist?.length) return;
  for (const w of d.waitlist) {
    if (w.notifiedAt) continue;
    const p = d.products.find((x) => x.id === w.productId);
    const v = p?.variants.find((x) => x.color === w.color && x.size === w.size);
    if (!p || !p.active || !v || v.stock <= 0) continue;
    w.notifiedAt = Date.now();
    const href = `/product/${p.slug}?color=${encodeURIComponent(w.color)}`;
    note(d, w.userId, "Back in stock! 🔔", `${p.name} (${w.color}, ${w.size}) is available again — grab it before it sells out.`, href);
    const u = d.users.find((x) => x.id === w.userId);
    queueAutomation(d, "back_in_stock", u, { product: p.name, color: w.color, size: w.size, link: storeUrl(href) });
  }
}

/** Personal one-time coupon locked to the given customers. Returns the code. */
export function personalCoupon(d: DB, userIds: string[], o: { type: "percent" | "flat"; value: number; days: number; description: string; prefix: string; minOrder?: number; maxDiscount?: number }) {
  let code: string;
  do code = `${o.prefix}-${randomBytes(3).toString("hex").toUpperCase()}`; while (d.coupons.some((c) => c.code === code));
  d.coupons.unshift({ code, description: o.description, type: o.type, value: o.value, minOrder: o.minOrder ?? 0, maxDiscount: o.maxDiscount, expiresAt: Date.now() + o.days * 86_400_000, active: true, used: 0, userIds, onePerUser: true });
  return code;
}

/** The member plan a user currently enjoys (membership enabled and unexpired). */
export function activePlan(d: DB, u: Pick<User, "membership"> | null | undefined): MembershipPlan | undefined {
  const m = u?.membership;
  if (!m || m.expiresAt < Date.now() || !d.retention.membership?.enabled) return undefined;
  return d.retention.membership.plans.find((p) => p.id === m.planId);
}

/** Yearly birthday reward, granted when the shopper is active in their birthday month. Returns true if granted. */
export function grantBirthday(d: DB, u: User) {
  const b = d.retention.birthday;
  if (!b?.enabled || !u.dob || u.role !== "customer") return false;
  const now = new Date();
  if (Number(u.dob.slice(5, 7)) !== now.getMonth() + 1 || u.birthdayRewardYear === now.getFullYear()) return false;
  u.birthdayRewardYear = now.getFullYear();
  const first = u.name.split(" ")[0];
  const off = b.type === "percent" ? `${b.value}% off` : `₹${b.value} off`;
  const code = personalCoupon(d, [u.id], { type: b.type, value: b.value, days: b.validDays, description: `Happy birthday, ${first}! ${off}`, prefix: "BDAY", maxDiscount: b.type === "percent" ? 2000 : undefined });
  note(d, u.id, `Happy birthday, ${first}! 🎂`, `Here is ${off} as our gift. Use code ${code} within ${b.validDays} days.`, "/shop");
  return true;
}
