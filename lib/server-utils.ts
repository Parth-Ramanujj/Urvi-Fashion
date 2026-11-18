import "server-only";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { HttpError } from "./auth";
import { newId } from "./crypto";
import { db, UPLOAD_DIR } from "./db";
import { onDelivered, onReversed } from "./retention-core";
import { CURRENCIES, LANGS, translator, type Currency, type Lang } from "./i18n";
import type { DB, Order, OrderStatus } from "./types";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Wrap a server action body: known errors become { ok:false } (production redacts thrown messages). */
export async function run<T>(fn: () => Promise<T> | T): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, error: e.message };
    if (e && typeof e === "object" && "digest" in e) throw e; // let redirect()/notFound() through
    console.error(e);
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
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${newId(12)}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(await f.arrayBuffer()));
  return `/api/files/${name}`;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Order placed", packed: "Packed", shipped: "Shipped", out_for_delivery: "Out for delivery", delivered: "Delivered",
  cancelled: "Cancelled", return_requested: "Return requested", returned: "Returned & refunded", exchange_requested: "Exchange requested", exchanged: "Exchanged", return_rejected: "Return rejected",
};

/** The single place order status changes: timeline, stock restore, refund flag and customer notification. Call inside mutate(). */
export function setOrderStatus(d: DB, o: Order, status: OrderStatus, note?: string) {
  if (o.status === status) return;
  o.status = status;
  o.timeline.push({ status, at: Date.now(), note });
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
  d.notifications.push({ id: newId(), userId: o.userId, title: `${STATUS_LABEL[status]} · ${o.ref}`, body: note || `Your order ${o.ref} is now ${STATUS_LABEL[status].toLowerCase()}.`, href: `/account/orders/${o.id}`, createdAt: Date.now(), readBy: [] });
}
