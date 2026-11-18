"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { currentUser, endSession, requireUser, startSession } from "./auth";
import { hashPassword, hmac, newId, orderRef, safeEqual, verifyPassword } from "./crypto";
import { activePlan, creditCoins, grantBirthday, maxRedeemable, newReferralCode } from "./retention-core";
import { db, mutate } from "./db";
import { CURRENCIES, LANGS } from "./i18n";
import { couponDiscount, computeTotals, DELIVERY, memberDiscount, RETURN_WINDOW_DAYS, unitPrice, type DeliverySpeed } from "./pricing";
import { deliveryFor } from "./delivery";
import { fail, run, saveUpload, setOrderStatus, str } from "./server-utils";
import type { Address, CartLine, Coupon, DB, Measurements, PaymentMethod, Size, User } from "./types";
import { SIZES } from "./types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[6-9]\d{9}$/; // Indian mobile numbers

/* ---------------- Preferences ---------------- */
export async function setPref(key: "lang" | "currency" | "theme", value: string) {
  const ok = key === "lang" ? value in LANGS : key === "currency" ? value in CURRENCIES : ["light", "dark", "system"].includes(value);
  if (ok) (await cookies()).set(key, value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

/* ---------------- Auth ---------------- */
/** New-customer setup: referral code, welcome coins and (optionally) a referral link to the inviter. */
function onboard(d: DB, u: User, refCode?: string) {
  u.coins = 0;
  u.referralCode = newReferralCode(u.name);
  const r = d.retention;
  if (r.loyalty.enabled && r.loyalty.welcomeCoins) creditCoins(d, u, r.loyalty.welcomeCoins, "Welcome bonus");
  const code = str(refCode, 20).toUpperCase();
  const inviter = code && r.referral.enabled ? d.users.find((x) => x.referralCode === code && x.id !== u.id && !x.blocked) : undefined;
  if (inviter) {
    u.referredBy = inviter.id;
    creditCoins(d, u, r.referral.refereeCoins, `Joined with ${inviter.name.split(" ")[0]}'s referral code`);
  }
}

export async function register(input: { name: string; email: string; password: string; ref?: string }) {
  return run(async () => {
    const name = str(input.name, 80), email = str(input.email, 120).toLowerCase(), password = String(input.password ?? "");
    if (name.length < 2) fail("Please enter your name");
    if (!EMAIL.test(email)) fail("Please enter a valid email");
    if (password.length < 8 || !/\d/.test(password) || !/[a-zA-Z]/.test(password)) fail("Password needs 8+ characters with letters and numbers");
    if (db().users.some((u) => u.email === email)) fail("An account with this email already exists");
    const id = newId();
    mutate((d) => {
      const u: User = { id, name, email, passwordHash: hashPassword(password), role: "customer", blocked: false, addresses: [], measurements: {}, createdAt: Date.now(), lastActiveAt: Date.now() };
      d.users.push(u);
      onboard(d, u, input.ref);
    });
    await startSession(id);
    return { role: "customer" as const };
  });
}

export async function login(input: { email: string; password: string }) {
  return run(async () => {
    const email = str(input.email, 120).toLowerCase();
    const u = db().users.find((x) => x.email === email);
    if (!u || !verifyPassword(String(input.password ?? ""), u.passwordHash)) fail("Incorrect email or password");
    if (u!.blocked) fail("This account has been suspended. Contact support.");
    await startSession(u!.id);
    return { role: u!.role };
  });
}

export async function logout() {
  await endSession();
  revalidatePath("/", "layout");
}

export async function sendOtp(phoneRaw: string) {
  return run(async () => {
    const phone = str(phoneRaw, 15).replace(/\D/g, "").slice(-10);
    if (!PHONE.test(phone)) fail("Enter a valid 10-digit mobile number");
    const prev = db().otps.find((o) => o.phone === phone);
    if (prev && Date.now() - prev.sentAt < 30_000) fail("Please wait 30 seconds before requesting another code");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    mutate((d) => {
      d.otps = d.otps.filter((o) => o.phone !== phone && o.expiresAt > Date.now());
      d.otps.push({ phone, hash: hmac(d.secret, `${phone}:${code}`), expiresAt: Date.now() + 5 * 60_000, attempts: 0, sentAt: Date.now() });
    });
    // shortcut: no SMS provider wired; plug Twilio/MSG91 here. Code is logged on the server and echoed only outside production.
    console.log(`[OTP] ${phone}: ${code}`);
    return { devCode: process.env.NODE_ENV === "production" ? undefined : code };
  });
}

export async function verifyOtp(input: { phone: string; code: string; name?: string; ref?: string }) {
  return run(async () => {
    const phone = str(input.phone, 15).replace(/\D/g, "").slice(-10);
    const code = str(input.code, 6);
    // Count the attempt in its own write: a failed check throws and would otherwise roll the counter back.
    const ok = mutate((d) => {
      const o = d.otps.find((x) => x.phone === phone);
      if (!o || o.expiresAt < Date.now()) return "expired";
      if (o.attempts >= 5) return "locked";
      o.attempts++;
      return safeEqual(hmac(d.secret, `${phone}:${code}`), o.hash) ? "ok" : "bad";
    });
    if (ok === "expired") fail("Code expired. Request a new one.");
    if (ok === "locked") fail("Too many attempts. Request a new code.");
    if (ok === "bad") fail("Incorrect code");
    const userId = mutate((d) => {
      d.otps = d.otps.filter((x) => x.phone !== phone);
      let u = d.users.find((x) => x.phone === phone);
      if (u?.blocked) fail("This account has been suspended. Contact support.");
      if (!u) {
        u = { id: newId(), name: str(input.name, 80) || `Shopper ${phone.slice(-4)}`, phone, role: "customer", blocked: false, addresses: [], measurements: {}, createdAt: Date.now(), lastActiveAt: Date.now() };
        d.users.push(u);
        onboard(d, u, input.ref);
      }
      return u.id;
    });
    await startSession(userId);
    return { role: db().users.find((u) => u.id === userId)!.role };
  });
}

/* ---------------- Profile ---------------- */
export async function updateProfile(input: { name: string; phone?: string; measurements?: Measurements; dob?: string }) {
  return run(async () => {
    const me = await requireUser();
    const name = str(input.name, 80);
    if (name.length < 2) fail("Please enter your name");
    const phone = input.phone ? str(input.phone, 15).replace(/\D/g, "").slice(-10) : undefined;
    if (phone && !PHONE.test(phone)) fail("Enter a valid 10-digit mobile number");
    if (phone && db().users.some((u) => u.phone === phone && u.id !== me.id)) fail("This number is linked to another account");
    const m: Measurements = {};
    for (const k of ["height", "chest", "waist", "hips", "inseam"] as const) {
      const v = Number(input.measurements?.[k]);
      if (v > 0 && v < 300) m[k] = Math.round(v);
    }
    if (["slim", "regular", "relaxed"].includes(input.measurements?.fit ?? "")) m.fit = input.measurements!.fit;
    const dob = str(input.dob, 10);
    if (dob && (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob)) || Date.parse(dob) > Date.now() - 5 * 365 * 86_400_000)) fail("Enter a valid date of birth");
    if (dob && me.dob && me.dob !== dob) fail("Date of birth can only be set once. Contact support to change it.");
    mutate((d) => { const u = d.users.find((x) => x.id === me.id)!; u.name = name; if (phone) u.phone = phone; if (input.measurements) u.measurements = m; if (dob && !u.dob) { u.dob = dob; grantBirthday(d, u); } });
    revalidatePath("/account", "layout");
  });
}

export async function saveAddress(a: Partial<Address>) {
  return run(async () => {
    const me = await requireUser();
    const addr: Address = {
      id: a.id || newId(), name: str(a.name, 80), phone: str(a.phone, 15).replace(/\D/g, "").slice(-10), line1: str(a.line1, 160), line2: str(a.line2, 160),
      city: str(a.city, 60), state: str(a.state, 60), pincode: str(a.pincode, 6), label: (["Home", "Work", "Other"].includes(a.label!) ? a.label : "Home") as Address["label"], isDefault: !!a.isDefault,
    };
    if (!addr.name || !addr.line1 || !addr.city || !addr.state) fail("Please fill in all required address fields");
    if (!PHONE.test(addr.phone)) fail("Enter a valid 10-digit mobile number");
    if (!/^\d{6}$/.test(addr.pincode)) fail("Enter a valid 6-digit PIN code");
    mutate((d) => {
      const u = d.users.find((x) => x.id === me.id)!;
      if (addr.isDefault || u.addresses.length === 0) { u.addresses.forEach((x) => (x.isDefault = false)); addr.isDefault = true; }
      const i = u.addresses.findIndex((x) => x.id === addr.id);
      if (i >= 0) u.addresses[i] = addr; else u.addresses.push(addr);
    });
    revalidatePath("/account", "layout");
    revalidatePath("/checkout");
    return addr;
  });
}

export async function deleteAddress(id: string) {
  return run(async () => {
    const me = await requireUser();
    mutate((d) => {
      const u = d.users.find((x) => x.id === me.id)!;
      u.addresses = u.addresses.filter((a) => a.id !== id);
      if (u.addresses.length && !u.addresses.some((a) => a.isDefault)) u.addresses[0].isDefault = true;
    });
    revalidatePath("/account", "layout");
  });
}

/* ---------------- Catalog ---------------- */
const card = (p: DB["products"][number]) => ({ id: p.id, slug: p.slug, name: p.name, brand: p.brand, image: p.colors[0].images[0], price: unitPrice(p), mrp: p.mrp });

export async function suggest(qRaw: string) {
  const q = str(qRaw, 60).toLowerCase();
  if (q.length < 2) return { products: [], terms: [] };
  const words = q.split(/\s+/);
  const ps = db().products.filter((p) => p.active);
  const hay = (p: (typeof ps)[number]) => `${p.name} ${p.brand} ${p.category} ${p.subcategory} ${p.fabric} ${p.colors.map((c) => c.name).join(" ")}`.toLowerCase();
  const products = ps.filter((p) => words.every((w) => hay(p).includes(w))).sort((a, b) => b.sold - a.sold).slice(0, 6).map(card);
  const terms = [...new Set(ps.flatMap((p) => [p.subcategory, p.brand, p.category]))].filter((t) => t.toLowerCase().includes(q)).slice(0, 5);
  return { products, terms };
}

export async function productsByIds(ids: string[]) {
  const set = new Set(ids.slice(0, 100));
  return db().products.filter((p) => set.has(p.id) && p.active).map((p) => ({ ...card(p), colors: p.colors.map((c) => ({ name: c.name, hex: c.hex, image: c.images[0] })), sizes: p.sizes, variants: p.variants.map((v) => ({ color: v.color, size: v.size, stock: v.stock, sku: v.sku })) }));
}

type QuoteLine = { productId: string; color: string; size: Size; qty: number };

/** Authoritative re-pricing of a cart. Used by the cart page, checkout and placeOrder. */
/** Coupons a given shopper may use: public ones, plus personal/segment offers addressed to them. */
const couponVisible = (c: Coupon, u: User | null) => !c.userIds?.length || (!!u && c.userIds.includes(u.id));

/** Authoritative re-pricing of a cart. Used by the cart page, checkout and placeOrder. */
function priceLines(lines: QuoteLine[], couponCode: string | undefined, speed: DeliverySpeed, user: User | null = null, useCoins = false, city?: string | null) {
  const d = db();
  const priced = lines.slice(0, 50).map((l) => {
    const p = d.products.find((x) => x.id === l.productId && x.active);
    const v = p?.variants.find((x) => x.color === l.color && x.size === l.size);
    const qty = Math.max(1, Math.min(10, Math.floor(Number(l.qty) || 1)));
    if (!p || !v) return { ...l, qty, price: 0, mrp: 0, stock: 0, available: false, p: undefined, v: undefined };
    return { ...l, qty, price: unitPrice(p, v), mrp: v.price ? Math.max(p.mrp, v.price) : p.mrp, stock: v.stock, available: v.stock >= qty, p, v };
  });
  const valid = priced.filter((l) => l.available);
  const sub = valid.reduce((s, l) => s + l.price * l.qty, 0);
  const code = str(couponCode, 30).toUpperCase();
  const coupon = d.coupons.find((x) => x.code === code);
  let c: { amount: number; error?: string } = code ? couponDiscount(coupon && couponVisible(coupon, user) ? coupon : undefined, sub) : { amount: 0 };
  if (code && !c.error && coupon?.onePerUser) {
    if (!user) c = { amount: 0, error: "Log in to use this coupon" };
    else if (d.orders.some((o) => o.userId === user.id && o.couponCode === code && o.status !== "cancelled")) c = { amount: 0, error: "You've already used this coupon" };
  }
  const plan = activePlan(d, user);
  const afterMember = sub - c.amount - memberDiscount(sub - c.amount, plan?.discountPct);
  const coinsAvail = user ? maxRedeemable(d.retention, user.coins ?? 0, afterMember) : 0;
  const s2: DeliverySpeed = speed in DELIVERY ? speed : "standard";
  const dq = deliveryFor(d.delivery!, city);
  const opt = dq.options[s2];
  const totals = computeTotals(valid, s2, c.amount, useCoins ? coinsAvail : 0, { memberPct: plan?.discountPct, freeDelivery: plan?.freeDelivery, fee: opt.fee, freeAbove: dq.freeAbove });
  return { priced, valid, code, couponAmount: c.amount, couponError: code ? c.error : undefined, coinsAvail, totals, plan, dq, speed: s2 };
}

export async function quote(lines: QuoteLine[], couponCode?: string, speed: DeliverySpeed = "standard", useCoins = false, addressId?: string) {
  const u = await currentUser();
  const city = u?.addresses.find((a) => a.id === addressId)?.city ?? null;
  const r = priceLines(lines, couponCode, speed, u, useCoins, city);
  const d = db();
  return {
    lines: r.priced.map(({ productId, color, size, qty, price, mrp, stock, available }) => ({ productId, color, size, qty, price, mrp, stock, available })),
    totals: r.totals, coupon: r.code && !r.couponError ? { code: r.code, amount: r.couponAmount } : null, couponError: r.couponError,
    coins: u && d.retention.loyalty.enabled ? { balance: u.coins ?? 0, usable: r.coinsAvail, maxPct: d.retention.loyalty.maxRedeemPct } : null,
    member: r.plan ? { name: r.plan.name, pct: r.plan.discountPct, freeDelivery: r.plan.freeDelivery } : null,
    delivery: r.dq,
    coupons: d.coupons.filter((c) => c.active && (!c.expiresAt || c.expiresAt > Date.now()) && couponVisible(c, u)).map((c) => ({ code: c.code, description: c.description, minOrder: c.minOrder, personal: !!c.userIds?.length })),
  };
}

export async function addReview(form: FormData) {
  return run(async () => {
    const me = await requireUser();
    const productId = str(form.get("productId"), 20);
    const rating = Math.round(Number(form.get("rating")));
    const title = str(form.get("title"), 80), body = str(form.get("body"), 1500);
    const p = db().products.find((x) => x.id === productId);
    if (!p) fail("Product not found");
    if (!(rating >= 1 && rating <= 5)) fail("Please choose a star rating");
    if (body.length < 10) fail("Tell us a little more (10+ characters)");
    const files = form.getAll("photos").slice(0, 4);
    const photos = (await Promise.all(files.map(saveUpload))).filter(Boolean) as string[];
    const orders = db().orders.filter((o) => o.userId === me.id && ["delivered", "returned", "exchanged", "return_requested", "exchange_requested", "return_rejected"].includes(o.status));
    const bought = orders.flatMap((o) => o.items).find((i) => i.productId === productId);
    mutate((d) => {
      const prod = d.products.find((x) => x.id === productId)!;
      prod.rating = Math.round(((prod.rating * prod.ratingCount + rating) / (prod.ratingCount + 1)) * 10) / 10;
      prod.ratingCount++;
      d.reviews.push({ id: newId(), productId, userId: me.id, name: me.name, rating, title: title || `${rating} stars`, body, photos, verified: !!bought, size: bought?.size, createdAt: Date.now() });
    });
    revalidatePath(`/product/${p!.slug}`);
  });
}

/* ---------------- Orders ---------------- */
export async function placeOrder(input: {
  lines: QuoteLine[]; addressId: string; speed: DeliverySpeed; method: PaymentMethod; couponCode?: string; payRef?: string; useCoins?: boolean;
}) {
  return run(async () => {
    const me = await requireUser();
    if (!["card", "upi", "netbanking", "wallet", "cod"].includes(input.method)) fail("Choose a payment method");
    const address = me.addresses.find((a) => a.id === input.addressId);
    if (!address) fail("Choose a delivery address");
    const r = priceLines(input.lines, input.couponCode, input.speed, me, !!input.useCoins, address!.city);
    if (!r.dq.serviceable) fail(`Sorry, we don't deliver to ${address!.city} yet`);
    if (!r.dq.options[r.speed].available) fail(`Express delivery isn't available in ${address!.city}`);
    if (input.method === "cod" && !r.dq.cod) fail(`Cash on Delivery isn't available in ${address!.city}`);
    if (!r.priced.length) fail("Your bag is empty");
    const bad = r.priced.find((l) => !l.available);
    if (bad) fail(`${bad.p?.name ?? "An item"} (${bad.color}, ${bad.size}) is no longer available in that quantity`);
    if (r.couponError) fail(r.couponError);
    if (input.method === "cod" && r.totals.total > 10000) fail("Cash on Delivery is available for orders up to ₹10,000");
    const speed = r.speed;
    const id = newId();
    mutate((d) => {
      for (const l of r.valid) {
        const v = d.products.find((p) => p.id === l.productId)!.variants.find((x) => x.color === l.color && x.size === l.size)!;
        if (v.stock < l.qty) fail("Stock changed while you were checking out. Please review your bag.");
        v.stock -= l.qty;
        d.products.find((p) => p.id === l.productId)!.sold += l.qty;
      }
      if (r.code) d.coupons.find((c) => c.code === r.code)!.used++;
      const user = d.users.find((x) => x.id === me.id)!;
      const coinsUsed = r.totals.coins ?? 0;
      if (coinsUsed > (user.coins ?? 0)) fail("Your coin balance changed. Please review your order.");
      if (coinsUsed) creditCoins(d, user, -coinsUsed, "Redeemed at checkout", id);
      user.cart = undefined; // bag converted: no abandoned-cart reminder
      const now = Date.now();
      // shortcut: payment is simulated (always succeeds); integrate Razorpay/Stripe and confirm via webhook before marking paid.
      d.orders.push({
        id, ref: orderRef(d.brand?.orderPrefix), userId: me.id, address: address!, deliverySpeed: speed, couponCode: r.code || undefined, totals: r.totals, status: "placed", coinsUsed: coinsUsed || undefined,
        items: r.valid.map((l) => ({ productId: l.productId, slug: l.p!.slug, name: l.p!.name, brand: l.p!.brand, image: l.p!.colors.find((c) => c.name === l.color)?.images[0] ?? l.p!.colors[0].images[0], color: l.color, size: l.size, sku: l.v!.sku, qty: l.qty, price: l.price, mrp: l.mrp })),
        payment: { method: input.method, status: input.method === "cod" ? "pending" : "paid", txnId: input.method === "cod" ? undefined : `pay_${newId(10)}` },
        timeline: [{ status: "placed", at: now }], createdAt: now, eta: now + Math.max(1, r.dq.options[speed].days[1]) * 86_400_000,
      });
      d.notifications.push({ id: newId(), userId: me.id, title: "Order confirmed 🎉", body: "We've received your order and will pack it shortly.", href: `/account/orders/${id}`, createdAt: now, readBy: [] });
    });
    revalidatePath("/", "layout");
    return { id };
  });
}

export async function cancelOrder(id: string, reason: string) {
  return run(async () => {
    const me = await requireUser();
    mutate((d) => {
      const o = d.orders.find((x) => x.id === id && x.userId === me.id);
      if (!o) fail("Order not found");
      if (!["placed", "packed"].includes(o!.status)) fail("This order can no longer be cancelled");
      setOrderStatus(d, o!, "cancelled", str(reason, 200) || "Cancelled by customer");
    });
    revalidatePath(`/account/orders/${id}`);
  });
}

export async function requestReturn(id: string, type: "return" | "exchange", reason: string, exchangeSize?: Size) {
  return run(async () => {
    const me = await requireUser();
    if (str(reason, 300).length < 3) fail("Please tell us why");
    if (type === "exchange" && !SIZES.includes(exchangeSize as never)) fail("Choose the size you'd like instead");
    mutate((d) => {
      const o = d.orders.find((x) => x.id === id && x.userId === me.id);
      if (!o || o.status !== "delivered") fail("Only delivered orders can be returned");
      const deliveredAt = o!.timeline.find((t) => t.status === "delivered")?.at ?? o!.createdAt;
      if (Date.now() - deliveredAt > RETURN_WINDOW_DAYS * 86_400_000) fail(`The ${RETURN_WINDOW_DAYS}-day return window has closed`);
      o!.returnRequest = { type: type === "exchange" ? "exchange" : "return", reason: str(reason, 300), at: Date.now(), exchangeSize: type === "exchange" ? exchangeSize : undefined };
      setOrderStatus(d, o!, type === "exchange" ? "exchange_requested" : "return_requested", "We'll schedule a pickup within 48 hours.");
    });
    revalidatePath(`/account/orders/${id}`);
  });
}

/* ---------------- Support & notifications ---------------- */
export async function createTicket(input: { subject: string; message: string; orderRef?: string }) {
  return run(async () => {
    const me = await requireUser();
    const subject = str(input.subject, 120), message = str(input.message, 2000);
    if (subject.length < 3 || message.length < 5) fail("Please add a subject and a message");
    mutate((d) => d.tickets.push({ id: newId(), userId: me.id, subject, orderRef: str(input.orderRef, 30) || undefined, status: "open", messages: [{ from: "customer", body: message, at: Date.now() }], createdAt: Date.now() }));
    revalidatePath("/account/support");
  });
}

export async function replyTicket(id: string, message: string) {
  return run(async () => {
    const me = await requireUser();
    const body = str(message, 2000);
    if (!body) fail("Message can't be empty");
    mutate((d) => {
      const t = d.tickets.find((x) => x.id === id && (x.userId === me.id || me.role === "admin"));
      if (!t) fail("Ticket not found");
      t!.messages.push({ from: me.role === "admin" ? "admin" : "customer", body, at: Date.now() });
      t!.status = "open";
    });
    revalidatePath("/account/support");
  });
}

export async function myNotifications() {
  const me = await currentUser();
  if (!me) return [];
  // Birthday reward is granted lazily the first time the shopper is active in their birthday month.
  if (me.dob && me.role === "customer") mutate((d) => { grantBirthday(d, d.users.find((x) => x.id === me.id)!); });
  return db().notifications.filter((n) => n.userId === me.id || (n.userId === null && n.createdAt >= me.createdAt - 7 * 86_400_000))
    .sort((a, b) => b.createdAt - a.createdAt).slice(0, 20)
    .map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, createdAt: n.createdAt, read: n.readBy.includes(me.id) }));
}

export async function markNotificationsRead() {
  const me = await currentUser();
  if (!me) return;
  mutate((d) => d.notifications.forEach((n) => { if ((n.userId === me.id || n.userId === null) && !n.readBy.includes(me.id)) n.readBy.push(me.id); }));
}

/* ---------------- Retention: back-in-stock, saved bag ---------------- */
export async function joinWaitlist(productId: string, color: string, size: Size) {
  return run(async () => {
    const me = await requireUser();
    if (!db().retention.backInStock.enabled) fail("Back-in-stock alerts are currently off");
    const p = db().products.find((x) => x.id === productId && x.active);
    const v = p?.variants.find((x) => x.color === color && x.size === size);
    if (!p || !v) fail("Product not found");
    if (v!.stock > 0) fail("Good news — this size is in stock now");
    mutate((d) => {
      if (d.waitlist.some((w) => w.userId === me.id && w.productId === productId && w.color === color && w.size === size && !w.notifiedAt)) return;
      d.waitlist.push({ id: newId(), userId: me.id, productId, color, size, createdAt: Date.now() });
    });
  });
}

/** Mirror of the browser bag for logged-in shoppers. Only identifiers + display fields are kept; prices are re-quoted on use. */
export async function syncCart(items: CartLine[]) {
  const me = await currentUser();
  if (!me || me.role !== "customer") return;
  const clean = (Array.isArray(items) ? items : []).slice(0, 30).map((l) => ({
    productId: str(l.productId, 20), slug: str(l.slug, 120), name: str(l.name, 120), brand: str(l.brand, 60), image: str(l.image, 300),
    color: str(l.color, 40), size: str(l.size, 5) as Size, sku: str(l.sku, 60), qty: Math.max(1, Math.min(10, Math.floor(Number(l.qty) || 1))), price: Number(l.price) || 0, mrp: Number(l.mrp) || 0,
  })).filter((l) => l.productId && l.sku);
  mutate((d) => {
    const u = d.users.find((x) => x.id === me.id)!;
    const same = JSON.stringify(u.cart?.items ?? []) === JSON.stringify(clean);
    if (!same) u.cart = clean.length ? { items: clean, updatedAt: Date.now() } : undefined;
  });
}

export async function savedCart() {
  const me = await currentUser();
  return me?.cart?.items ?? [];
}

/* ---------------- Membership ---------------- */
export async function buyMembership(planId: string, method: PaymentMethod) {
  return run(async () => {
    const me = await requireUser("customer");
    const r = db().retention.membership;
    if (!r?.enabled) fail("Memberships are not available right now");
    const plan = r!.plans.find((p) => p.id === planId && p.active);
    if (!plan) fail("This plan is no longer available");
    if (!["card", "upi", "netbanking", "wallet"].includes(method)) fail("Choose an online payment method");
    // shortcut: payment is simulated like checkout; confirm via the gateway webhook before activating in production.
    return mutate((d) => {
      const u = d.users.find((x) => x.id === me.id)!;
      const now = Date.now();
      const base = u.membership && u.membership.expiresAt > now && u.membership.planId === plan!.id ? u.membership.expiresAt : now; // renewing extends
      const expiresAt = base + plan!.days * 86_400_000;
      u.membership = { planId: plan!.id, since: u.membership && u.membership.expiresAt > now ? u.membership.since : now, expiresAt };
      d.memberships!.push({ id: newId(), userId: u.id, planId: plan!.id, planName: plan!.name, price: plan!.price, method, txnId: `pay_${newId(10)}`, at: now, expiresAt });
      d.notifications.push({ id: newId(), userId: u.id, title: `Welcome to ${plan!.name} 👑`, body: `Your perks are live until ${new Date(expiresAt).toLocaleDateString("en-IN")}.`, href: "/membership", createdAt: now, readBy: [] });
      return { expiresAt };
    });
  });
}

/* ---------------- Social follow reward ---------------- */
export async function claimSocial(platformId: string) {
  return run(async () => {
    const me = await requireUser("customer");
    const s = db().retention.social;
    const link = s?.enabled ? s.links.find((l) => l.id === platformId) : undefined;
    if (!link) fail("This reward isn't available");
    // shortcut: honour-based (we can't verify a follow without each platform's API); one claim per platform per account.
    return mutate((d) => {
      const u = d.users.find((x) => x.id === me.id)!;
      if (u.socialClaimed?.includes(link!.id)) return 0;
      u.socialClaimed = [...(u.socialClaimed ?? []), link!.id];
      return creditCoins(d, u, s!.coins, `Followed us on ${link!.label}`);
    });
  });
}

/* ---------------- Password ---------------- */
export async function changePassword(input: { current?: string; next: string }) {
  return run(async () => {
    const me = await requireUser();
    const next = String(input.next ?? "");
    // Accounts created by OTP/Google have no password yet and may set one without the current password.
    if (me.passwordHash && !verifyPassword(String(input.current ?? ""), me.passwordHash)) fail("Current password is incorrect");
    if (next.length < 8 || !/\d/.test(next) || !/[a-zA-Z]/.test(next)) fail("New password needs 8+ characters with letters and numbers");
    mutate((d) => { d.users.find((x) => x.id === me.id)!.passwordHash = hashPassword(next); });
  });
}
