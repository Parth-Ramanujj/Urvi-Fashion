import "server-only";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { queueAutomation, storeUrl } from "./automation-core";
import { HttpError } from "./auth";
import { newId } from "./crypto";
import { db, UPLOAD_DIR } from "./db";
import { onDelivered, onReversed } from "./retention-core";
import { CURRENCIES, LANGS, translator, type Currency, type Lang } from "./i18n";
import type { AnalyticsEvent, DB, Order, OrderStatus } from "./types";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Wrap a server action body: known errors become { ok:false } with a clear, user-friendly message. */
export async function run<T>(fn: () => Promise<T> | T): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, error: e.message };
    if (e && typeof e === "object" && "digest" in e) throw e; // let redirect()/notFound() through
    console.error(e);
    const code = (e as { code?: string })?.code;
    const msg = e instanceof Error ? e.message : "";
    if (code === "23505" || msg.includes("Duplicate key")) return { ok: false, error: "This item already exists. Please use a different name or code." };
    if (code === "23503") return { ok: false, error: "This record is linked to other data and cannot be removed." };
    if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENOTFOUND") return { ok: false, error: "Connection issue — please check your internet or database and try again." };
    if (msg.includes("Database not ready")) return { ok: false, error: "Database is still starting up. Please try again in a few seconds." };
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export function fail(msg: string): never { throw new HttpError(msg); }
export const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function prefs() {
  const c = await cookies();
  const lang = (c.get("lang")?.value ?? "en") as Lang;
  const currency = (c.get("currency")?.value ?? "INR") as Currency;
  const theme = c.get("theme")?.value;
  // themeSet: the shopper picked a theme themself; otherwise the brand's default theme applies.
  return { lang: lang in LANGS ? lang : "en", currency: currency in CURRENCIES ? currency : "INR", theme: theme ?? "system", themeSet: !!theme } as { lang: Lang; currency: Currency; theme: string; themeSet: boolean };
}
export const getT = async () => translator((await prefs()).lang);
export const getBrand = () => db().brand!;

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
export async function saveUpload(f: unknown) {
  if (!(f instanceof File) || f.size === 0) return null;
  const ext = IMAGE_TYPES[f.type];
  if (!ext) fail("Only JPG, PNG, WEBP or GIF images are allowed");
  if (f.size > 5 * 1024 * 1024) fail("Each image must be under 5 MB");
  const buf = Buffer.from(await f.arrayBuffer());

  // Production cloud storage: if CLOUDINARY_URL is set, upload permanently to Cloudinary.
  const cld = process.env.CLOUDINARY_URL?.trim().replace(/^['"]|['"]$/g, "");
  if (cld) {
    let cloud: string, apiKey: string, apiSecret: string;
    try {
      const u = new URL(cld);
      cloud = u.hostname; apiKey = decodeURIComponent(u.username); apiSecret = decodeURIComponent(u.password);
      if (!cloud || !apiKey || !apiSecret) throw new Error("missing parts");
    } catch {
      fail("CLOUDINARY_URL is invalid. Format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME");
    }
    const ts = Math.floor(Date.now() / 1000);
    const folder = "urvi-fashion";
    const sig = createHash("sha1").update(`folder=${folder}&timestamp=${ts}${apiSecret}`).digest("hex");
    const body = new FormData();
    body.append("file", new Blob([buf], { type: f.type }), `upload.${ext}`);
    body.append("api_key", apiKey);
    body.append("timestamp", String(ts));
    body.append("folder", folder);
    body.append("signature", sig);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body }).catch(() => null);
    if (!res) fail("Could not reach Cloudinary to upload image");
    const data = await res.json().catch(() => ({})) as { secure_url?: string; error?: { message?: string } };
    if (!res.ok || !data.secure_url) fail(data.error?.message || "Cloudinary image upload failed");
    return data.secure_url;
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${newId(12)}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/api/files/${name}`;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Order placed", packed: "Packed", shipped: "Shipped", out_for_delivery: "Out for delivery", delivered: "Delivered",
  cancelled: "Cancelled", return_requested: "Return requested", returned: "Returned & refunded", exchange_requested: "Exchange requested", exchanged: "Exchanged", return_rejected: "Return rejected",
};

/** The single place order status changes: timeline, stock restore, refund flag and customer notification. Call inside mutate(). */
export function setOrderStatus(d: DB, o: Order, status: OrderStatus, note?: string) {
  if (o.status === status) return;
  const now = Date.now();
  o.status = status;
  o.timeline.push({ status, at: now, note });
  if (!o.trackingCode) o.trackingCode = `TRK-${newId(6).toUpperCase()}`;
  (o.trackingLogs ??= []).push({ id: newId(4), title: STATUS_LABEL[status], note, at: now });
  if (status === "cancelled" || status === "returned") {
    for (const it of o.items) {
      const v = d.products.find((p) => p.id === it.productId)?.variants.find((x) => x.color === it.color && x.size === it.size);
      if (v) v.stock += it.qty;
    }
    if (o.payment.status === "paid") o.payment.status = "refunded";
    onReversed(d, o, status);
  }
  if (status === "delivered" && o.payment.method === "cod") o.payment.status = "paid";
  if (status === "delivered") onDelivered(d, o);
  const href = `/account/orders/${o.id}`;
  d.notifications.push({ id: newId(), userId: o.userId, title: `${STATUS_LABEL[status]} · ${o.ref}`, body: note || `Your order ${o.ref} is now ${STATUS_LABEL[status].toLowerCase()}.`, href, createdAt: Date.now(), readBy: [] });
  const user = d.users.find((u) => u.id === o.userId);
  const vars = { orderRef: o.ref, orderTotal: `₹${o.totals.total}`, status: STATUS_LABEL[status], note: note ?? "", link: storeUrl(href) };
  if (status === "shipped") queueAutomation(d, "order_shipped", user, vars);
  else if (status === "delivered") queueAutomation(d, "order_delivered", user, vars);
  else if (["return_requested", "returned", "exchange_requested", "exchanged", "return_rejected"].includes(status)) queueAutomation(d, "return_update", user, vars);
}

/** Append an activity event to the analytics feed (capped at 3000). Enriches product name/slug when productId is given. Call inside mutate(). */
export function recordActivity(d: DB, event: Omit<AnalyticsEvent, "id" | "at">) {
  const prod = event.productId && (!event.productName || !event.slug) ? d.products.find((p) => p.id === event.productId) : undefined;
  const list = (d.analytics ??= []);
  list.unshift({
    ...event,
    id: newId(6),
    productName: event.productName || prod?.name,
    slug: event.slug || prod?.slug,
    userName: event.userName || "Guest",
    at: Date.now(),
  });
  if (list.length > 3000) list.length = 3000;
}
