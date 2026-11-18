import "server-only";
import { db } from "./db";
import { flashActive, pctOff, unitPrice } from "./pricing";
import type { Product } from "./types";

export type CardData = ReturnType<typeof cardData>;
export function cardData(p: Product) {
  const price = unitPrice(p);
  return {
    id: p.id, slug: p.slug, name: p.name, brand: p.brand, price, mrp: p.mrp, off: pctOff(p.mrp, price), rating: p.rating, ratingCount: p.ratingCount,
    colors: p.colors.map((c) => ({ name: c.name, hex: c.hex, image: c.images[0], alt: c.images[1] ?? c.images[0] })),
    flash: flashActive(p), isNew: Date.now() - p.createdAt < 14 * 86_400_000, stock: p.variants.reduce((s, v) => s + v.stock, 0),
  };
}

export const SORTS = { popular: "Popularity", new: "Newest", "price-asc": "Price: Low to High", "price-desc": "Price: High to Low", rating: "Best rated", discount: "Biggest discount" } as const;

export type Filters = Partial<Record<"category" | "q" | "sort" | "size" | "color" | "fabric" | "brand" | "min" | "max" | "discount" | "rating" | "sale", string>>;
const list = (v?: string) => (v ? v.split(",").filter(Boolean) : []);

/** Server-side catalog query; also returns facet values for the filter UI. */
export function queryProducts(f: Filters) {
  const all = db().products.filter((p) => p.active);
  const inCat = f.category ? all.filter((p) => p.category === f.category) : all;
  const words = (f.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const sizes = list(f.size), colors = list(f.color), fabrics = list(f.fabric), brands = list(f.brand);
  const min = Number(f.min) || 0, max = Number(f.max) || Infinity, disc = Number(f.discount) || 0, rating = Number(f.rating) || 0;

  let items = inCat.filter((p) => {
    const price = unitPrice(p);
    const hay = `${p.name} ${p.brand} ${p.category} ${p.subcategory} ${p.fabric} ${p.kind} ${p.colors.map((c) => c.name).join(" ")}`.toLowerCase();
    return words.every((w) => hay.includes(w.replace(/e?s$/, "")))
      && (!sizes.length || p.variants.some((v) => sizes.includes(v.size) && v.stock > 0))
      && (!colors.length || p.colors.some((c) => colors.includes(c.name)))
      && (!fabrics.length || fabrics.includes(p.fabric))
      && (!brands.length || brands.includes(p.brand))
      && price >= min && price <= max
      && pctOff(p.mrp, price) >= disc
      && p.rating >= rating
      && (f.sale !== "flash" || flashActive(p));
  });
  const by: Record<string, (a: Product, b: Product) => number> = {
    popular: (a, b) => b.sold + b.views / 10 - (a.sold + a.views / 10),
    new: (a, b) => b.createdAt - a.createdAt,
    "price-asc": (a, b) => unitPrice(a) - unitPrice(b),
    "price-desc": (a, b) => unitPrice(b) - unitPrice(a),
    rating: (a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount,
    discount: (a, b) => pctOff(b.mrp, unitPrice(b)) - pctOff(a.mrp, unitPrice(a)),
  };
  items = [...items].sort(by[f.sort ?? ""] ?? by.popular);

  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  const colorMap = new Map(inCat.flatMap((p) => p.colors.map((c) => [c.name, c.hex] as const)));
  return {
    items: items.map(cardData),
    facets: {
      sizes: uniq(inCat.flatMap((p) => p.sizes)),
      colors: [...colorMap].map(([name, hex]) => ({ name, hex })).sort((a, b) => a.name.localeCompare(b.name)),
      fabrics: uniq(inCat.map((p) => p.fabric)),
      brands: uniq(inCat.map((p) => p.brand)),
      maxPrice: Math.max(0, ...inCat.map((p) => p.price)),
    },
  };
}

/** Personal rails for a signed-in shopper, from their order history: things to re-buy and new picks that match their taste. */
export function personalRails(userId: string) {
  const d = db();
  const orders = d.orders.filter((o) => o.userId === userId && o.status !== "cancelled");
  if (!orders.length) return null;
  const times = new Map<string, { n: number; last: number }>();
  for (const o of orders) for (const id of new Set(o.items.map((i) => i.productId))) {
    const t = times.get(id) ?? { n: 0, last: 0 };
    times.set(id, { n: t.n + 1, last: Math.max(t.last, o.createdAt) });
  }
  const live = d.products.filter((p) => p.active && p.variants.some((v) => v.stock > 0));
  const bought = live.filter((p) => times.has(p.id));
  const weight = (key: (p: Product) => string) => {
    const m = new Map<string, number>();
    for (const p of bought) m.set(key(p), (m.get(key(p)) ?? 0) + times.get(p.id)!.n);
    return m;
  };
  const cat = weight((p) => p.category), brand = weight((p) => p.brand), kind = weight((p) => p.kind);
  const score = (p: Product) => 3 * (cat.get(p.category) ?? 0) + 2 * (brand.get(p.brand) ?? 0) + 2 * (kind.get(p.kind) ?? 0) + p.rating + (flashActive(p) ? 1 : 0);
  return {
    buyAgain: [...bought].sort((a, b) => times.get(b.id)!.n - times.get(a.id)!.n || times.get(b.id)!.last - times.get(a.id)!.last).slice(0, 10).map(cardData),
    forYou: live.filter((p) => !times.has(p.id)).sort((a, b) => score(b) - score(a)).slice(0, 10).map(cardData),
  };
}
