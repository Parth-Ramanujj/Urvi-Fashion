"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { newId } from "./crypto";
import { mutate } from "./db";
import { deliverInBackground } from "./integrations";
import { artImages } from "./seed";
import { fail, run, saveUpload, setOrderStatus, str } from "./server-utils";
import { ART_KINDS, CATEGORIES, FLOW, SIZES, type Coupon, type OrderStatus, type Product, type Role, type Size, type Variant } from "./types";

const ALL_SIZES: Size[] = [...SIZES, "Free"];
const HEX = /^#[0-9a-f]{6}$/i;
const num = (v: unknown, min = 0, max = 1e7) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : NaN; };
const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const touchAdmin = () => revalidatePath("/", "layout");

/* ---------------- Products ---------------- */
type ProductInput = {
  id?: string; name: string; brand: string; category: string; subcategory: string; kind: string; fabric: string; description: string;
  details: string[]; mrp: number; price: number; sizes: string[]; colors: { name: string; hex: string; images: string[] }[];
  variants: { color: string; size: string; stock: number; price?: number | null }[]; video?: string; active: boolean;
};

/** FormData: "data" = JSON ProductInput, "img<i>" = new image files for colour i. */
export async function saveProduct(form: FormData) {
  return run(async () => {
    await requireUser("admin");
    let d: ProductInput;
    try { d = JSON.parse(String(form.get("data"))); } catch { fail("Invalid product data"); }
    const name = str(d.name, 120), brand = str(d.brand, 60);
    if (name.length < 2 || !brand) fail("Name and brand are required");
    if (!CATEGORIES.includes(d.category as never)) fail("Choose a category");
    if (!ART_KINDS.includes(d.kind as never)) fail("Choose a product type");
    const mrp = num(d.mrp, 1), price = num(d.price, 1);
    if (Number.isNaN(mrp) || Number.isNaN(price)) fail("Enter valid prices");
    if (price > mrp) fail("Selling price can't exceed MRP");
    const sizes = ALL_SIZES.filter((s) => d.sizes?.includes(s));
    if (!sizes.length) fail("Pick at least one size");
    if (!Array.isArray(d.colors) || !d.colors.length || d.colors.length > 12) fail("Add 1–12 colours");
    const video = str(d.video, 400);
    if (video && !/^https?:\/\//.test(video)) fail("Video must be an http(s) URL");

    const colors: Product["colors"] = [];
    for (let i = 0; i < d.colors.length; i++) {
      const c = d.colors[i];
      const cname = str(c.name, 30);
      if (!cname || !HEX.test(c.hex)) fail(`Colour ${i + 1} needs a name and a valid hex`);
      const uploaded = (await Promise.all(form.getAll(`img${i}`).slice(0, 8).map(saveUpload))).filter(Boolean) as string[];
      const kept = (c.images ?? []).filter((s) => typeof s === "string" && (s.startsWith("/api/files/") || s.startsWith("https://res.cloudinary.com/")));
      const images = [...kept, ...uploaded].slice(0, 10);
      colors.push({ name: cname, hex: c.hex.toLowerCase(), images: images.length ? images : artImages(d.kind as Product["kind"], c.hex.toLowerCase()) });
    }
    if (new Set(colors.map((c) => c.name)).size !== colors.length) fail("Colour names must be unique");

    const savedId = await mutate((db) => {
      const existing = d.id ? db.products.find((p) => p.id === d.id) : undefined;
      if (d.id && !existing) fail("Product not found");
      let slug = slugify(name);
      if (db.products.some((p) => p.slug === slug && p.id !== existing?.id)) slug = `${slug}-${newId(3).toLowerCase()}`;
      const skuBase = slug.slice(0, 10).toUpperCase();
      const variants: Variant[] = colors.flatMap((c) => sizes.map((size) => {
        const inV = d.variants?.find((v) => v.color === c.name && v.size === size);
        const old = existing?.variants.find((v) => v.color === c.name && v.size === size);
        const stock = num(inV?.stock ?? 0, 0, 100000);
        const vp = inV?.price ? num(inV.price, 1) : undefined;
        return { sku: old?.sku ?? `${skuBase}-${c.name.replace(/\W/g, "").toUpperCase()}-${size}`, color: c.name, size, stock: Number.isNaN(stock) ? 0 : stock, ...(vp && !Number.isNaN(vp) ? { price: vp } : {}) };
      }));
      const fields = {
        slug, name, brand, category: d.category as Product["category"], subcategory: str(d.subcategory, 40) || "General", kind: d.kind as Product["kind"],
        fabric: str(d.fabric, 40) || "Cotton", description: str(d.description, 2000), details: (d.details ?? []).map((x) => str(x, 120)).filter(Boolean).slice(0, 12),
        mrp, price, colors, sizes, variants, video: video || undefined, active: !!d.active,
      };
      if (existing) { Object.assign(existing, fields); return existing.id; }
      const id = `p${newId(5)}`;
      db.products.push({ id, ...fields, rating: 0, ratingCount: 0, sold: 0, views: 0, createdAt: Date.now(), flashSale: null });
      return id;
    });
    touchAdmin();
    return { id: savedId };
  });
}

export async function deleteProduct(id: string) {
  return run(async () => {
    await requireUser("admin");
    const mode = await mutate((d) => {
      const i = d.products.findIndex((p) => p.id === id);
      if (i < 0) fail("Product not found");
      if (d.orders.some((o) => o.items.some((it) => it.productId === id))) { d.products[i].active = false; return "archived"; }
      d.products.splice(i, 1);
      d.reviews = d.reviews.filter((r) => r.productId !== id);
      d.waitlist = d.waitlist.filter((w) => w.productId !== id); // children go with the product (foreign keys)
      return "deleted";
    });
    touchAdmin();
    return { mode };
  });
}

export async function updateStock(productId: string, sku: string, stock: number) {
  return run(async () => {
    await requireUser("admin");
    const n = num(stock, 0, 100000);
    if (Number.isNaN(n)) fail("Enter a valid stock quantity");
    await mutate((d) => {
      const v = d.products.find((p) => p.id === productId)?.variants.find((x) => x.sku === sku);
      if (!v) fail("Variant not found");
      v.stock = n;
    });
    touchAdmin();
  });
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

/** Bulk-import products from a CSV string in a single transaction. */
export async function bulkImportProducts(csvText: string) {
  return run(async () => {
    await requireUser("admin");
    const rows = parseCsvRows(String(csvText ?? ""));
    if (rows.length < 2) fail("CSV needs a header row and at least 1 product row");
    const hdr = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, "_"));
    const col = (r: string[], name: string) => r[hdr.indexOf(name)] ?? "";
    const errors: string[] = [];
    const toAdd: Product[] = [];
    const now = Date.now();

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const name = str(col(r, "name"), 120), brand = str(col(r, "brand"), 60);
      const cat = str(col(r, "category"), 20).toLowerCase();
      const kindRaw = str(col(r, "kind") || "tee", 20).toLowerCase();
      const kind = (ART_KINDS.includes(kindRaw as never) ? kindRaw : "tee") as Product["kind"];
      const mrp = num(col(r, "mrp"), 1), price = num(col(r, "price"), 1);
      if (name.length < 2 || !brand) { errors.push(`Row ${i + 1}: name and brand are required`); continue; }
      if (!CATEGORIES.includes(cat as never)) { errors.push(`Row ${i + 1}: category must be one of ${CATEGORIES.join(", ")}`); continue; }
      if (Number.isNaN(mrp) || Number.isNaN(price) || price > mrp) { errors.push(`Row ${i + 1}: invalid mrp/price`); continue; }
      const sizesRaw = (col(r, "sizes") || "S,M,L,XL").split(/[|,/]+/).map((s) => s.trim().toUpperCase());
      const sizes = ALL_SIZES.filter((s) => sizesRaw.includes(s.toUpperCase()));
      if (!sizes.length) sizes.push("S", "M", "L", "XL");
      const colorsRaw = (col(r, "colors") || "Black:#1c1c1e").split(/[|,]+/).map((s) => s.trim()).filter(Boolean);
      const imgUrl = str(col(r, "image_url"), 400);
      const validImg = imgUrl && /^https?:\/\//.test(imgUrl) ? imgUrl : "";
      const colors: Product["colors"] = colorsRaw.slice(0, 12).map((c) => {
        const [cn, ch] = c.split(":");
        const hex = HEX.test(ch ?? "") ? ch!.toLowerCase() : "#1c1c1e";
        return { name: str(cn || "Default", 30), hex, images: validImg ? [validImg] : artImages(kind, hex) };
      });
      const stock = Math.max(0, Math.min(100000, Math.round(Number(col(r, "stock")) || 10)));
      const slugBase = slugify(name) || `item-${i}`;
      const slug = `${slugBase}-${newId(3).toLowerCase()}`;
      const skuBase = slug.slice(0, 10).toUpperCase();
      const variants: Variant[] = colors.flatMap((c) => sizes.map((size) => ({
        sku: `${skuBase}-${c.name.replace(/\W/g, "").toUpperCase()}-${size}`, color: c.name, size, stock,
      })));
      toAdd.push({
        id: `p${newId(5)}`, slug, name, brand, category: cat as Product["category"],
        subcategory: str(col(r, "subcategory"), 40) || "General", kind,
        fabric: str(col(r, "fabric"), 40) || "Cotton",
        description: str(col(r, "description"), 2000) || `${name} by ${brand}.`,
        details: ["Easy 14-day returns & exchanges"],
        mrp, price, colors, sizes, variants, rating: 0, ratingCount: 0, sold: 0, views: 0, createdAt: now + i, flashSale: null, active: true,
      });
    }
    if (!toAdd.length) fail(errors[0] || "No valid products found in CSV");
    await mutate((d) => { d.products.push(...toAdd); });
    touchAdmin();
    return { imported: toAdd.length, errors: errors.slice(0, 10) };
  });
}

/* ---------------- Orders ---------------- */
export async function updateOrder(id: string, input: { status?: OrderStatus; deliveryPartnerId?: string; trackingCode?: string; courierName?: string; trackingUrl?: string }) {
  return run(async () => {
    const me = await requireUser("admin");
    await mutate((d) => {
      const o = d.orders.find((x) => x.id === id);
      if (!o) fail("Order not found");
      if (!o!.trackingCode) o!.trackingCode = `TRK-${newId(6).toUpperCase()}`;
      if (input.trackingCode !== undefined) o!.trackingCode = str(input.trackingCode, 60) || o!.trackingCode;
      if (input.courierName !== undefined) o!.courierName = str(input.courierName, 60) || undefined;
      if (input.trackingUrl !== undefined) {
        const u = str(input.trackingUrl, 300);
        if (u && !/^https?:\/\//i.test(u)) fail("Tracking URL must start with http:// or https://");
        o!.trackingUrl = u || undefined;
      }
      if (input.deliveryPartnerId !== undefined) {
        const partner = input.deliveryPartnerId ? d.users.find((u) => u.id === input.deliveryPartnerId && u.role === "delivery") : undefined;
        if (input.deliveryPartnerId && !partner) fail("Not a delivery partner");
        const changed = o!.deliveryPartnerId !== (input.deliveryPartnerId || undefined);
        o!.deliveryPartnerId = input.deliveryPartnerId || undefined;
        if (changed && partner) {
          const now = Date.now();
          (o!.trackingLogs ??= []).push({ id: newId(4), title: `Assigned to ${partner.name}`, location: partner.city || o!.address.city, note: `Courier: ${o!.courierName || "Store Delivery"}`, by: me.name, at: now });
          d.notifications.push({ id: newId(), userId: partner.id, title: `New delivery assigned · ${o!.ref}`, body: `${o!.address.name} · ${o!.address.city} (${o!.items.reduce((s, i) => s + i.qty, 0)} items)`, href: "/delivery", createdAt: now, readBy: [] });
        }
      }
      if (input.status) {
        if (![...FLOW, "cancelled"].includes(input.status)) fail("Use the return controls for returns");
        if (!FLOW.includes(o!.status) || o!.status === "delivered") fail("This order is closed — use the return controls");
        if (input.status !== "cancelled" && FLOW.indexOf(input.status) < FLOW.indexOf(o!.status)) fail("Order status can only move forward");
        setOrderStatus(d, o!, input.status, input.status === "cancelled" ? "Cancelled by the store. Any payment will be refunded." : undefined);
      }
    });
    deliverInBackground();
    touchAdmin();
  });
}

export async function resolveReturn(id: string, approve: boolean) {
  return run(async () => {
    await requireUser("admin");
    await mutate((d) => {
      const o = d.orders.find((x) => x.id === id);
      if (!o || !o.returnRequest || !["return_requested", "exchange_requested"].includes(o.status)) fail("No open return request");
      if (!approve) return setOrderStatus(d, o, "return_rejected", "Your return request was reviewed and couldn't be approved. Contact support for help.");
      if (o.returnRequest.type === "return") return setOrderStatus(d, o, "returned", "Return approved — refund initiated to your original payment method.");
      const size = o.returnRequest.exchangeSize;
      for (const it of o.items) {
        const vs = d.products.find((p) => p.id === it.productId)?.variants;
        const from = vs?.find((v) => v.color === it.color && v.size === it.size);
        const to = vs?.find((v) => v.color === it.color && v.size === size);
        if (!to || to.stock < it.qty) fail(`Not enough stock of ${it.name} in size ${size}`);
        to.stock -= it.qty;
        if (from) from.stock += it.qty;
      }
      setOrderStatus(d, o, "exchanged", `Exchange approved — size ${size} is on its way.`);
    });
    deliverInBackground();
    touchAdmin();
  });
}

/* ---------------- Customers & support ---------------- */
export async function setUserBlocked(id: string, blocked: boolean) {
  return run(async () => {
    const me = await requireUser("admin");
    if (id === me.id) fail("You can't block yourself");
    await mutate((d) => {
      const u = d.users.find((x) => x.id === id);
      if (!u) fail("User not found");
      if (u.role === "admin") fail("Admins can't be blocked");
      u.blocked = !!blocked;
    });
    revalidatePath("/admin/customers");
  });
}

export async function setUserRole(id: string, role: Role) {
  return run(async () => {
    const me = await requireUser("admin");
    if (id === me.id) fail("You can't change your own role");
    if (!["customer", "admin", "delivery"].includes(role)) fail("Invalid role");
    await mutate((d) => { const u = d.users.find((x) => x.id === id); if (!u) fail("User not found"); u.role = role; u.tokenVersion = (u.tokenVersion ?? 0) + 1; });
    revalidatePath("/admin/customers");
  });
}

export async function adminReplyTicket(id: string, message: string, resolve = false) {
  return run(async () => {
    await requireUser("admin");
    const body = str(message, 2000);
    if (!body && !resolve) fail("Message can't be empty");
    await mutate((d) => {
      const t = d.tickets.find((x) => x.id === id);
      if (!t) fail("Ticket not found");
      if (body) t.messages.push({ from: "admin", body, at: Date.now() });
      t.status = resolve ? "resolved" : "open";
      d.notifications.push({ id: newId(), userId: t.userId, title: `Support replied · ${t.subject}`, body: body || "Your ticket was marked resolved.", href: "/account/support", createdAt: Date.now(), readBy: [] });
    });
    revalidatePath("/admin/support");
    revalidatePath("/account/support");
  });
}

/* ---------------- Marketing ---------------- */
export async function saveCoupon(input: Partial<Coupon>) {
  return run(async () => {
    await requireUser("admin");
    const code = str(input.code, 20).toUpperCase();
    if (!/^[A-Z0-9]{4,20}$/.test(code)) fail("Code must be 4–20 letters/numbers");
    const value = num(input.value, 1, 100000), minOrder = num(input.minOrder ?? 0, 0);
    if (Number.isNaN(value) || Number.isNaN(minOrder)) fail("Enter valid amounts");
    if (input.type === "percent" && value > 90) fail("Percent discount must be 1–90");
    const max = input.maxDiscount ? num(input.maxDiscount, 1) : undefined;
    const expiresAt = input.expiresAt ? Number(input.expiresAt) : undefined;
    if (expiresAt !== undefined && !(expiresAt > Date.now())) fail("Expiry must be in the future");
    await mutate((d) => {
      if (d.coupons.some((c) => c.code === code)) fail("A coupon with this code already exists");
      d.coupons.unshift({
        code, description: str(input.description, 140) || (input.type === "percent" ? `${value}% off` : `₹${value} off`), type: input.type === "flat" ? "flat" : "percent", value, minOrder,
        maxDiscount: max && !Number.isNaN(max) ? max : undefined, expiresAt, active: true, used: 0,
      });
    });
    revalidatePath("/admin/marketing");
  });
}

export async function setCouponActive(code: string, active: boolean) {
  return run(async () => {
    await requireUser("admin");
    await mutate((d) => { const c = d.coupons.find((x) => x.code === code); if (!c) fail("Coupon not found"); c.active = active; });
    revalidatePath("/admin/marketing");
  });
}

export async function deleteCoupon(code: string) {
  return run(async () => {
    await requireUser("admin");
    await mutate((d) => { d.coupons = d.coupons.filter((c) => c.code !== code); });
    revalidatePath("/admin/marketing");
  });
}

export async function createFlashSale(productIds: string[], percent: number, endsAt: number) {
  return run(async () => {
    await requireUser("admin");
    const pct = num(percent, 5, 80);
    if (Number.isNaN(pct)) fail("Discount must be 5–80%");
    if (!(Number(endsAt) > Date.now())) fail("End time must be in the future");
    if (!productIds?.length) fail("Pick at least one product");
    await mutate((d) => { for (const p of d.products) if (productIds.includes(p.id)) p.flashSale = { percent: pct, endsAt: Number(endsAt) }; });
    touchAdmin();
  });
}

export async function endFlashSale(productId?: string) {
  return run(async () => {
    await requireUser("admin");
    await mutate((d) => { for (const p of d.products) if (!productId || p.id === productId) p.flashSale = null; });
    touchAdmin();
  });
}

export async function sendCampaign(input: { title: string; body: string; href?: string; audience: "all" | "customers" }) {
  return run(async () => {
    await requireUser("admin");
    const title = str(input.title, 80), body = str(input.body, 240), href = str(input.href, 200);
    if (title.length < 3 || body.length < 3) fail("Add a title and message");
    if (href && !href.startsWith("/")) fail("Link must be a path on this site, e.g. /shop");
    // shortcut: in-app notification feed only; add Web Push (VAPID + service worker) or FCM to reach closed browsers/apps.
    const reach = await mutate((d) => {
      const now = Date.now();
      let reach: number;
      if (input.audience === "customers") {
        const targets = d.users.filter((u) => u.role === "customer" && !u.blocked);
        for (const u of targets) d.notifications.push({ id: newId(), userId: u.id, title, body, href: href || undefined, createdAt: now, readBy: [] });
        reach = targets.length;
      } else {
        d.notifications.push({ id: newId(), userId: null, title, body, href: href || undefined, createdAt: now, readBy: [] });
        reach = d.users.filter((u) => !u.blocked).length;
      }
      d.campaigns.unshift({ id: newId(), title, body, href: href || undefined, audience: input.audience === "customers" ? "customers" : "all", sentAt: now, reach });
      return reach;
    });
    revalidatePath("/admin/marketing");
    return { reach };
  });
}

/* ---------------- Delivery partner & tracking ---------------- */
export async function deliveryUpdate(orderId: string, action: "shipped" | "out_for_delivery" | "delivered" | "attempt_failed", note?: string) {
  return run(async () => {
    const me = await requireUser("delivery");
    const cleanNote = str(note, 200);
    await mutate((d) => {
      const o = d.orders.find((x) => x.id === orderId && x.deliveryPartnerId === me.id);
      if (!o) fail("Order not assigned to you");
      const now = Date.now();
      if (action === "attempt_failed") {
        if (!["shipped", "out_for_delivery"].includes(o!.status)) fail("Order must be in transit to report an attempt");
        const reason = cleanNote || "Customer not reachable — will re-attempt delivery";
        (o!.trackingLogs ??= []).push({ id: newId(4), title: "Delivery attempt failed", location: o!.address.city, note: reason, by: me.name, at: now });
        d.notifications.push({ id: newId(), userId: o!.userId, title: `Delivery attempt · ${o!.ref}`, body: reason, href: `/account/orders/${o!.id}`, createdAt: now, readBy: [] });
        return;
      }
      if (action === "shipped") {
        if (!["placed", "packed"].includes(o!.status)) fail("Order is already shipped");
        setOrderStatus(d, o!, "shipped", cleanNote || `Picked up by ${me.name}`);
      } else if (action === "out_for_delivery") {
        if (o!.status !== "shipped") fail("Order must be marked picked up / shipped first");
        setOrderStatus(d, o!, "out_for_delivery", cleanNote || `${me.name} is on the way with your order.`);
      } else if (action === "delivered") {
        if (o!.status !== "out_for_delivery") fail("Start delivery (Out for delivery) before marking delivered");
        setOrderStatus(d, o!, "delivered", cleanNote || `Handed over by ${me.name}`);
      } else {
        fail("Invalid status");
      }
    });
    deliverInBackground();
    revalidatePath("/delivery");
    revalidatePath("/admin/orders");
  });
}

export async function claimDeliveryOrder(orderId: string) {
  return run(async () => {
    const me = await requireUser("delivery");
    await mutate((d) => {
      const o = d.orders.find((x) => x.id === orderId);
      if (!o) fail("Order not found");
      if (o!.deliveryPartnerId) fail("This order is already assigned to a partner");
      if (!["placed", "packed", "shipped"].includes(o!.status)) fail("This order cannot be claimed");
      const now = Date.now();
      o!.deliveryPartnerId = me.id;
      if (!o!.trackingCode) o!.trackingCode = `TRK-${newId(6).toUpperCase()}`;
      (o!.trackingLogs ??= []).push({ id: newId(4), title: `Claimed by ${me.name}`, location: me.city || o!.address.city, by: me.name, at: now });
      d.notifications.push({ id: newId(), userId: o!.userId, title: `Rider assigned · ${o!.ref}`, body: `${me.name} will deliver your order.`, href: `/account/orders/${o!.id}`, createdAt: now, readBy: [] });
    });
    revalidatePath("/delivery");
    revalidatePath("/admin/orders");
  });
}

export async function addTrackingCheckpoint(orderId: string, input: { title: string; location?: string; note?: string }) {
  return run(async () => {
    const me = await requireUser();
    if (me.role !== "admin" && me.role !== "delivery") fail("Not allowed");
    const title = str(input.title, 80);
    const location = str(input.location, 80);
    const note = str(input.note, 200);
    if (title.length < 2) fail("Enter a tracking status title");
    await mutate((d) => {
      const o = d.orders.find((x) => x.id === orderId);
      if (!o) fail("Order not found");
      if (me.role === "delivery" && o!.deliveryPartnerId !== me.id) fail("Order not assigned to you");
      const now = Date.now();
      if (!o!.trackingCode) o!.trackingCode = `TRK-${newId(6).toUpperCase()}`;
      (o!.trackingLogs ??= []).push({ id: newId(4), title, location: location || undefined, note: note || undefined, by: me.name, at: now });
      d.notifications.push({
        id: newId(),
        userId: o!.userId,
        title: `Tracking update · ${o!.ref}`,
        body: `${title}${location ? ` (${location})` : ""}${note ? ` — ${note}` : ""}`,
        href: `/account/orders/${o!.id}`,
        createdAt: now,
        readBy: [],
      });
    });
    revalidatePath("/delivery");
    revalidatePath("/admin/orders");
    revalidatePath(`/account/orders/${orderId}`);
  });
}

