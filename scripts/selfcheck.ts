// Quick assert-based checks for money & sizing logic: `npm run check`
import assert from "node:assert/strict";
import { computeTotals, couponDiscount, unitPrice } from "../lib/pricing.ts";
import { recommendSize } from "../lib/sizes.ts";
import { DEFAULT_DELIVERY, DEFAULT_RETENTION as R, maxRedeemable, tierOf } from "../lib/retention-core.ts";
import { deliveryFor } from "../lib/delivery.ts";
import { brandCss, palette } from "../lib/brand.ts";
import { buildBlankSeed, buildSeed } from "../lib/seed.ts";
import { diff, fromSnapshot, snapshotOf, toRows, writePlan } from "../lib/store-diff.ts";

const lines = [{ price: 500, mrp: 1000, qty: 2 }];
let t = computeTotals(lines, "standard");
assert.deepEqual(t, { mrp: 2000, discount: 1000, coupon: 0, member: 0, coins: 0, delivery: 0, tax: 50, total: 1050 }); // ≥ ₹999 → free standard
t = computeTotals([{ price: 400, mrp: 800, qty: 1 }], "standard");
assert.equal(t.delivery, 49); assert.equal(t.total, 400 + 49 + 20);
assert.equal(computeTotals(lines, "express").delivery, 149);
assert.equal(computeTotals([], "express").total, 0);

const c = { code: "X", description: "", type: "percent" as const, value: 20, minOrder: 1000, maxDiscount: 150, active: true, used: 0 };
assert.equal(couponDiscount(c, 999).amount, 0);
assert.equal(couponDiscount(c, 500 * 2).amount, 150); // capped
assert.equal(couponDiscount({ ...c, expiresAt: 1 }, 5000).error, "This coupon has expired");
assert.equal(couponDiscount({ ...c, type: "flat", value: 9999, maxDiscount: undefined, minOrder: 0 }, 300).amount, 300); // never exceeds subtotal

const p = { price: 1000, flashSale: { percent: 25, endsAt: Date.now() + 1000 } } as never;
assert.equal(unitPrice(p), 750);
assert.equal(unitPrice({ price: 1000, flashSale: { percent: 25, endsAt: 1 } } as never), 1000);

assert.equal(recommendSize("tee", { chest: 95 }), "M");
assert.equal(recommendSize("tee", { chest: 95, fit: "relaxed" }), "L");
assert.equal(recommendSize("pants", { waist: 200 }), "XXL");
assert.equal(recommendSize("cap", { chest: 95 }), null);
// Coins: 1 coin = ₹1, applied after coupon, tax on the remainder, free delivery judged before coins.
t = computeTotals([{ price: 1000, mrp: 1000, qty: 1 }], "standard", 0, 200);
assert.deepEqual([t.coins, t.delivery, t.tax, t.total], [200, 0, 40, 840]);
assert.equal(computeTotals([{ price: 100, mrp: 100, qty: 1 }], "standard", 0, 500).coins, 100); // never more than the basket
assert.equal(maxRedeemable(R, 1000, 1000), 200); // capped at 20%
assert.equal(maxRedeemable(R, 50, 1000), 50); // capped at balance
assert.equal(maxRedeemable({ ...R, loyalty: { ...R.loyalty, enabled: false } }, 1000, 1000), 0);
assert.equal(tierOf(0, R.tiers).tier.name, "Bronze");
assert.equal(tierOf(10000, R.tiers).tier.name, "Silver");
assert.equal(tierOf(99999, R.tiers).next, undefined);
// Member discount after coupon, before coins; member free delivery; city fee override.
t = computeTotals([{ price: 1000, mrp: 1000, qty: 1 }], "express", 100, 50, { memberPct: 10, freeDelivery: true });
assert.deepEqual([t.member, t.coins, t.delivery, t.total], [90, 50, 0, 760 + 38]);
assert.equal(computeTotals([{ price: 500, mrp: 500, qty: 1 }], "standard", 0, 0, { fee: 29 }).delivery, 29);
assert.equal(computeTotals([{ price: 500, mrp: 500, qty: 3 }], "express", 0, 0, { fee: 79 }).delivery, 79); // express never auto-free
// City delivery rules
assert.equal(deliveryFor(DEFAULT_DELIVERY, "  ahmedabad ").options.standard.fee, 29);
assert.equal(deliveryFor(DEFAULT_DELIVERY, "Delhi").cod, false);
assert.equal(deliveryFor(DEFAULT_DELIVERY, "Surat").serviceable, true);
assert.equal(deliveryFor({ ...DEFAULT_DELIVERY, restrictToCities: true }, "Surat").serviceable, false);
// White-label: palette keeps the chosen colour at 500, CSS exposes it; blank store needs owner credentials.
assert.equal(palette("#123456")[500], "#123456");
assert.equal(palette("nope")[500], "#f45d17"); // invalid input falls back to default
assert.match(brandCss({ primary: "#0a7d4f", font: "elegant" }), /--brand-500:#0a7d4f;.*--font-head:var\(--font-playfair\)/);
assert.throws(() => buildBlankSeed({}), /ADMIN_EMAIL/);
assert.throws(() => buildBlankSeed({ ADMIN_EMAIL: "o@shop.in", ADMIN_PASSWORD: "short" }), /ADMIN_PASSWORD/);
const blank = buildBlankSeed({ ADMIN_EMAIL: "Owner@Shop.in", ADMIN_PASSWORD: "Secret123", STORE_NAME: "Kapda Ghar" });
assert.deepEqual([blank.users.length, blank.users[0].email, blank.products.length, blank.orders.length, blank.brand!.name, blank.brand!.orderPrefix, blank.brand!.showDemoLogins], [1, "owner@shop.in", 0, 0, "Kapda Ghar", "KAP", false]);
// Two server instances must build the same demo store (same user/order ids, referral codes) but never share the signing secret.
const a = buildSeed(), b = buildSeed();
assert.deepEqual(a.users.map((u) => [u.id, u.email, u.referralCode]), b.users.map((u) => [u.id, u.email, u.referralCode]));
assert.deepEqual(a.orders.map((o) => o.id), b.orders.map((o) => o.id));
assert.notEqual(a.secret, b.secret);
// MySQL write-diff: unchanged store → nothing written; edits, inserts, deletes and reorders → only those rows.
{
  const d = buildSeed();
  let snap = snapshotOf(toRows(d));
  assert.equal(diff(snap, d).changes.length, 0);
  d.products[0].name = "Edited";
  d.users.push({ ...d.users[0], id: "new-user", email: "new@x.in" });
  const gone = d.coupons.pop()!.code;
  let r = diff(snap, d);
  const by = (t: string) => r.changes.find((c) => c.table === t);
  assert.deepEqual(by("products")?.upserts.map((x) => x.id), [d.products[0].id]);
  assert.deepEqual(by("users")?.upserts.map((x) => x.id), ["new-user"]);
  assert.deepEqual(by("coupons")?.deletes, [gone]);
  assert.equal(r.changes.length, 3);
  snap = r.next;
  [d.banners[0], d.banners[1]] = [d.banners[1], d.banners[0]]; // reorder = position change only
  r = diff(snap, d);
  assert.deepEqual(r.changes.map((c) => [c.table, c.upserts.length, c.deletes.length]), [["banners", 2, 0]]);
  const back = fromSnapshot(r.next);
  assert.deepEqual([back.banners.map((b) => b.id), back.products[0].name, back.secret, back.brand?.name], [d.banners.map((b) => b.id), "Edited", d.secret, d.brand?.name]);
  d.users.push({ ...d.users[1] }); // same id twice must never reach MySQL
  assert.throws(() => diff(r.next, d), /Duplicate key/);
}
// Foreign-key-safe write order: parents inserted before children, children deleted before parents.
{
  const row = { id: "x", pos: 0, json: "{}" };
  const plan = writePlan([
    { table: "reviews", upserts: [row], deletes: ["r1"] }, { table: "products", upserts: [row], deletes: ["p1"] },
    { table: "users", upserts: [row], deletes: [] }, { table: "coin_ledger", upserts: [], deletes: ["c1"] }, { table: "orders", upserts: [row], deletes: [] },
  ]).map((s) => `${s.op}:${s.table}`);
  assert.deepEqual(plan, ["upsert:users", "upsert:products", "upsert:orders", "upsert:reviews", "delete:coin_ledger", "delete:reviews", "delete:products"]);
}
console.log("selfcheck: all passed");
