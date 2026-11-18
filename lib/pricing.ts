import type { Coupon, Product, Totals, Variant } from "./types";

export const TAX_RATE = 0.05; // GST on apparel, added on the discounted subtotal
export const DELIVERY = {
  standard: { label: "Standard", fee: 49, freeAbove: 999, days: [4, 6] },
  express: { label: "Express", fee: 149, freeAbove: Infinity, days: [1, 2] },
} as const;
export type DeliverySpeed = keyof typeof DELIVERY;
export const RETURN_WINDOW_DAYS = 14;

export function flashActive(p: Pick<Product, "flashSale">, now = Date.now()) {
  return !!p.flashSale && p.flashSale.endsAt > now;
}

/** Selling price of a product (or a variant override), after any live flash sale. */
export function unitPrice(p: Product, v?: Variant, now = Date.now()) {
  const base = v?.price ?? p.price;
  return flashActive(p, now) ? Math.round(base * (1 - p.flashSale!.percent / 100)) : base;
}

export const pctOff = (mrp: number, price: number) => (mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);

export function couponDiscount(c: Coupon | undefined, subtotal: number, now = Date.now()): { amount: number; error?: string } {
  if (!c || !c.active) return { amount: 0, error: "Invalid coupon code" };
  if (c.expiresAt && c.expiresAt < now) return { amount: 0, error: "This coupon has expired" };
  if (subtotal < c.minOrder) return { amount: 0, error: `Add items worth ₹${c.minOrder - subtotal} more to use ${c.code}` };
  let amount = c.type === "percent" ? Math.round((subtotal * c.value) / 100) : c.value;
  if (c.maxDiscount) amount = Math.min(amount, c.maxDiscount);
  return { amount: Math.min(amount, subtotal) };
}

/** Member % off applied to the subtotal after the coupon. */
export const memberDiscount = (afterCoupon: number, pct = 0) => Math.round((afterCoupon * pct) / 100);

/**
 * Order of deductions: product discount → coupon → member discount → coins (1 coin = ₹1) → GST on the rest.
 * Free-delivery eligibility is judged after the coupon (before member/coins); members with free delivery pay none.
 * `fee` overrides the default delivery fee (city-based delivery).
 */
export function computeTotals(
  lines: { price: number; mrp: number; qty: number }[], speed: DeliverySpeed, coupon = 0, coins = 0,
  opts: { memberPct?: number; freeDelivery?: boolean; fee?: number; freeAbove?: number } = {},
): Totals {
  const mrp = lines.reduce((s, l) => s + l.mrp * l.qty, 0);
  const sub = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const afterCoupon = Math.max(0, sub - coupon);
  const member = memberDiscount(afterCoupon, opts.memberPct);
  const afterMember = afterCoupon - member;
  const used = Math.min(coins, afterMember);
  const taxable = afterMember - used;
  const d = DELIVERY[speed];
  const freeAbove = speed === "standard" ? opts.freeAbove ?? d.freeAbove : Infinity;
  const delivery = lines.length === 0 || opts.freeDelivery || afterCoupon >= freeAbove ? 0 : opts.fee ?? d.fee;
  const tax = Math.round(taxable * TAX_RATE);
  return { mrp, discount: mrp - sub, coupon, member, coins: used, delivery, tax, total: taxable + delivery + tax };
}
