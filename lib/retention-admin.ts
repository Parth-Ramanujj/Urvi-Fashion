"use server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { segmentCustomers, SEGMENTS, type Segment } from "@/app/admin/retention/segments";
import { queueAutomation, storeUrl } from "./automation-core";
import { requireUser } from "./auth";
import { newId } from "./crypto";
import { mutate } from "./db";
import { deliverInBackground } from "./integrations";
import { creditCoins } from "./retention-core";
import { fail, run, str } from "./server-utils";
import type { RetentionSettings } from "./types";

const HEX = /^#[0-9a-f]{6}$/i;
/** Integer in [min, max] or a failed validation with a readable label. */
const int = (v: unknown, min: number, max: number, label: string) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) fail(`${label} must be between ${min} and ${max}`);
  return Math.round(n);
};
const dec = (v: unknown, min: number, max: number, label: string) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) fail(`${label} must be between ${min} and ${max}`);
  return Math.round(n * 100) / 100;
};
const done = () => { revalidatePath("/admin/retention"); revalidatePath("/admin/customers"); };

export async function saveRetentionSettings(s: RetentionSettings) {
  return run(async () => {
    await requireUser("admin");
    if (!Array.isArray(s?.tiers) || s.tiers.length < 1 || s.tiers.length > 6) fail("Add between 1 and 6 tiers");
    const tiers = s.tiers.map((t, i) => {
      const name = str(t.name, 24);
      if (!name) fail("Every tier needs a name");
      if (!HEX.test(t.color)) fail(`Tier "${name}" needs a valid colour`);
      return { name, color: t.color, multiplier: dec(t.multiplier, 1, 5, `${name} multiplier`), minSpend: i === 0 ? 0 : int(t.minSpend, 1, 10_000_000, `${name} minimum spend`) };
    });
    tiers.forEach((t, i) => { if (i && t.minSpend <= tiers[i - 1].minSpend) fail("Tier minimum spends must go up from one tier to the next"); });
    const atRiskDays = int(s.segments.atRiskDays, 1, 365, "At-risk days"), churnDays = int(s.segments.churnDays, 2, 730, "Churn days");
    if (atRiskDays >= churnDays) fail("Churn days must be more than at-risk days");
    const b = s.birthday, so = s.social;
    const bPercent = b?.type !== "flat";
    const links = (Array.isArray(so?.links) ? so!.links : []).slice(0, 8).map((l) => {
      const id = str(l.id, 24).toLowerCase(), label = str(l.label, 24), url = str(l.url, 300);
      if (!/^[a-z0-9-]{2,24}$/.test(id)) fail("Social link ids must be 2–24 lowercase letters, numbers or dashes");
      if (!label) fail("Every social link needs a label");
      try { if (new URL(url).protocol !== "https:") throw 0; } catch { fail(`${label}: enter a full https:// link`); }
      return { id, label, url };
    });
    if (new Set(links.map((l) => l.id)).size !== links.length) fail("Social link ids must be unique");
    const clean: RetentionSettings = {
      loyalty: { enabled: !!s.loyalty.enabled, earnPer100: dec(s.loyalty.earnPer100, 0, 50, "Coins per ₹100"), maxRedeemPct: int(s.loyalty.maxRedeemPct, 0, 100, "Max redeem %"), welcomeCoins: int(s.loyalty.welcomeCoins, 0, 5000, "Welcome coins") },
      tiers,
      referral: { enabled: !!s.referral.enabled, referrerCoins: int(s.referral.referrerCoins, 0, 5000, "Referrer reward"), refereeCoins: int(s.referral.refereeCoins, 0, 5000, "New-member reward"), rewardType: s.referral.rewardType === "coupon" ? "coupon" : "coins" },
      birthday: { enabled: !!b?.enabled, type: bPercent ? "percent" : "flat", value: int(b?.value, 1, bPercent ? 90 : 100000, bPercent ? "Birthday discount %" : "Birthday discount ₹"), validDays: int(b?.validDays, 1, 90, "Birthday coupon days") },
      social: { enabled: !!so?.enabled, coins: int(so?.coins, 0, 1000, "Follow reward coins"), links },
      backInStock: { enabled: !!s.backInStock.enabled },
      abandonedCart: { enabled: !!s.abandonedCart.enabled, afterHours: int(s.abandonedCart.afterHours, 1, 168, "Abandoned-bag hours") },
      segments: { atRiskDays, churnDays, vipOrders: int(s.segments.vipOrders, 2, 50, "VIP orders") },
    };
    await mutate((d) => { d.retention = { ...clean, membership: d.retention.membership }; }); // plans are edited on the Membership page
    revalidatePath("/", "layout");
  });
}

export async function adjustCoins(userId: string, amount: number, reason: string) {
  return run(async () => {
    await requireUser("admin");
    const amt = int(amount, -100000, 100000, "Coins");
    if (!amt) fail("Enter a non-zero amount");
    const why = str(reason, 120);
    if (!why) fail("Add a reason (customers see it in their history)");
    const applied = await mutate((d) => {
      const u = d.users.find((x) => x.id === str(userId, 40));
      if (!u) fail("Customer not found");
      const a = creditCoins(d, u!, amt, why);
      d.notifications.push({ id: newId(), userId: u!.id, title: a > 0 ? `+${a} coins added 🪙` : `${a} coins adjusted`, body: why, href: "/account/rewards", createdAt: Date.now(), readBy: [] });
      return a;
    });
    done();
    return { applied };
  });
}

export async function sendSegmentOffer(input: { segment: Segment; title: string; body: string; discountType: "percent" | "flat"; value: number; minOrder: number; validDays: number; maxDiscount?: number }) {
  return run(async () => {
    await requireUser("admin");
    if (!(input.segment in SEGMENTS)) fail("Choose a segment");
    const title = str(input.title, 80), body = str(input.body, 240);
    if (title.length < 3 || body.length < 3) fail("Add a title and message");
    const percent = input.discountType === "percent";
    const value = int(input.value, 1, percent ? 90 : 100000, percent ? "Discount %" : "Discount amount");
    const minOrder = int(input.minOrder || 0, 0, 1000000, "Minimum order");
    const validDays = int(input.validDays, 1, 90, "Valid days");
    const maxDiscount = percent && input.maxDiscount ? int(input.maxDiscount, 1, 100000, "Max discount") : undefined;
    const r = await mutate((d) => {
      const users = segmentCustomers(d).filter((c) => c.segment === input.segment).map((c) => c.user.id);
      if (!users.length) fail("No customers in this segment right now");
      let code: string;
      do code = `WB-${randomBytes(3).toString("hex").toUpperCase()}`; while (d.coupons.some((c) => c.code === code));
      const now = Date.now();
      d.coupons.unshift({ code, description: `${SEGMENTS[input.segment].label} offer: ${percent ? `${value}% off` : `₹${value} off`}${minOrder ? ` over ₹${minOrder}` : ""}`, type: percent ? "percent" : "flat", value, minOrder, maxDiscount, expiresAt: now + validDays * 86_400_000, active: true, used: 0, userIds: users, onePerUser: true });
      for (const userId of users) d.notifications.push({ id: newId(), userId, title, body: `${body} Use code ${code}.`, href: "/shop", createdAt: now, readBy: [] });
      d.campaigns.unshift({ id: newId(), title, body, href: "/shop", audience: SEGMENTS[input.segment].label, sentAt: now, reach: users.length });
      return { code, reach: users.length };
    });
    revalidatePath("/admin/retention"); revalidatePath("/admin/marketing");
    return r;
  });
}

export async function remindAbandonedCarts(userIds: string[], couponCode?: string) {
  return run(async () => {
    await requireUser("admin");
    const ids = new Set((Array.isArray(userIds) ? userIds : []).slice(0, 500).map((x) => str(x, 40)));
    const code = str(couponCode, 30).toUpperCase();
    const count = await mutate((d) => {
      if (code && !d.coupons.some((c) => c.code === code && c.active && !c.userIds?.length)) fail("Pick an active public coupon");
      const cutoff = Date.now() - d.retention.abandonedCart.afterHours * 3_600_000;
      let n = 0;
      for (const u of d.users) {
        const c = u.cart;
        if (!ids.has(u.id) || u.blocked || !c?.items.length || c.updatedAt > cutoff || (c.remindedAt && c.remindedAt >= c.updatedAt)) continue;
        const names = c.items.map((i) => i.name);
        const product = `${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2} more` : ""}`;
        d.notifications.push({ id: newId(), userId: u.id, title: "You left something in your bag 👜", body: `${product} — still waiting for you.${code ? ` Use code ${code} at checkout.` : ""}`, href: "/cart", createdAt: Date.now(), readBy: [] });
        queueAutomation(d, "abandoned_cart", u, { product, link: storeUrl("/cart") });
        c.remindedAt = Date.now();
        n++;
      }
      return n;
    });
    if (!count) fail("No eligible bags — they may be too recent or already reminded");
    deliverInBackground();
    revalidatePath("/admin/retention");
    return { count };
  });
}
