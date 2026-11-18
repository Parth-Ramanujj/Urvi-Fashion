import { hashPassword, newId as randomId } from "./crypto.ts";

// Seed IDs are deterministic so every server instance (e.g. several Vercel functions, each with its own /tmp)
// builds the identical store: a login or link made on one instance resolves on the others.
let idc = 0;
const newId = (n = 9) => `s${(++idc).toString(36).padStart(n - 1, "0")}`;
import { computeTotals } from "./pricing.ts";
import { creditCoins, DEFAULT_DELIVERY, DEFAULT_RETENTION } from "./retention-core.ts";
import type { ArtKind, Banner, Category, Coupon, DB, Order, OrderStatus, Product, Review, Size, User } from "./types";
import { FLOW, SIZES } from "./types.ts";
import { blankBrand, palette } from "./brand.ts";

// Deterministic PRNG so the demo catalog is stable between resets.
let s = 42;
const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const int = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const DAY = 86_400_000;

type Row = [string, string, Category, string, ArtKind, string, number, number, string];
const ROWS: Row[] = [
  ["Essential Crew Tee", "Northline", "men", "T-Shirts", "tee", "Cotton", 999, 499, "Black:#1c1c1e,White:#f3f2ec,Olive:#5b6b3a,Navy:#1f2a44"],
  ["Oxford Button-Down Shirt", "Harbor & Co", "men", "Shirts", "shirt", "Cotton", 2499, 1499, "Sky:#9cc3e6,White:#f5f5f0,Pink:#efc2c7"],
  ["Heavyweight Pullover Hoodie", "Northline", "men", "Hoodies", "hoodie", "Fleece", 2999, 1799, "Charcoal:#3a3a3d,Sand:#d8c8a8,Forest:#2f4a3a"],
  ["Denim Trucker Jacket", "Rivet", "men", "Jackets", "jacket", "Denim", 4499, 2999, "Indigo:#34497a,Washed:#7d97b8"],
  ["Slim Tapered Chinos", "Harbor & Co", "men", "Trousers", "pants", "Cotton Twill", 2299, 1399, "Khaki:#c2a878,Navy:#22304d,Stone:#a9a49a"],
  ["Linen Resort Shirt", "Coastline", "men", "Shirts", "shirt", "Linen", 2799, 1899, "Ecru:#e9e0cc,Terracotta:#c0643d,Sage:#9aae8c"],
  ["Utility Cargo Shorts", "Rivet", "men", "Shorts", "shorts", "Cotton Ripstop", 1799, 999, "Olive:#596437,Black:#202022"],
  ["Piqué Polo Tee", "Harbor & Co", "men", "T-Shirts", "tee", "Piqué Cotton", 1599, 899, "Maroon:#6e2433,White:#f3f2ec,Teal:#21706e"],
  ["Flight Bomber Jacket", "Urbanite", "men", "Jackets", "jacket", "Nylon", 5499, 3299, "Black:#1b1b1d,Olive:#4d5a32"],
  ["Relaxed Straight Jeans", "Rivet", "men", "Jeans", "pants", "Denim", 3299, 1999, "Mid Blue:#4a6890,Black:#232326"],
  ["Wrap Midi Dress", "Maison Lila", "women", "Dresses", "dress", "Viscose", 3499, 1999, "Rose:#d9828f,Emerald:#1f6b52,Black:#1b1b1d"],
  ["Satin Slip Dress", "Maison Lila", "women", "Dresses", "dress", "Satin", 3999, 2799, "Champagne:#e2cba0,Midnight:#1f2440"],
  ["Pleated Midi Skirt", "Aura", "women", "Skirts", "skirt", "Polyester", 2199, 1299, "Mauve:#b48a9b,Olive:#7b7d4a,Ivory:#efe9dc"],
  ["Cropped Boxy Tee", "Aura", "women", "Tops", "tee", "Cotton", 899, 449, "Lilac:#c4b2dc,White:#f5f4ef,Butter:#f1dd8f"],
  ["Oversized Poplin Shirt", "Maison Lila", "women", "Shirts", "shirt", "Cotton Poplin", 2599, 1599, "White:#f6f6f2,Powder Blue:#8fb1d9"],
  ["High-Rise Wide-Leg Trousers", "Aura", "women", "Trousers", "pants", "Crepe", 2899, 1799, "Camel:#b9895a,Black:#1d1d1f"],
  ["Longline Wool Coat", "Maison Lila", "women", "Jackets", "jacket", "Wool Blend", 8999, 5999, "Camel:#b88a5c,Grey:#8b8b8f"],
  ["Floral Sundress", "Coastline", "women", "Dresses", "dress", "Cotton", 2499, 1199, "Sky:#a7c7e7,Coral:#f08a70"],
  ["Denim Mini Skirt", "Rivet", "women", "Skirts", "skirt", "Denim", 1999, 1199, "Light Wash:#9db4d0,Black:#252528"],
  ["Cropped Zip Hoodie", "Aura", "women", "Hoodies", "hoodie", "Fleece", 2499, 1499, "Blush:#e8b4b8,Grey Marl:#a3a3a8"],
  ["Tailored Blazer", "Maison Lila", "women", "Jackets", "jacket", "Poly Viscose", 5999, 3899, "Black:#1b1b1d,Ivory:#ece5d6"],
  ["Dino Graphic Tee", "Little Loom", "kids", "T-Shirts", "tee", "Cotton", 699, 349, "Sunny:#f2c94c,Leaf:#6fbf73,Sky:#6aa9e9"],
  ["Kids Fleece Hoodie", "Little Loom", "kids", "Hoodies", "hoodie", "Fleece", 1299, 799, "Red:#d9534f,Navy:#24345a"],
  ["Twirl Party Dress", "Little Loom", "kids", "Dresses", "dress", "Tulle", 1999, 1299, "Pink:#f4a6c0,Lavender:#c3b1e1"],
  ["Kids Jogger Pants", "Playground", "kids", "Bottoms", "pants", "Cotton Terry", 999, 599, "Grey:#9b9ba0,Navy:#25304e"],
  ["Kids Puffer Jacket", "Playground", "kids", "Jackets", "jacket", "Nylon", 2999, 1799, "Orange:#f08a3c,Teal:#2a8c8c"],
  ["Canvas Tote Bag", "Fieldwork", "accessories", "Bags", "bag", "Canvas", 1499, 899, "Natural:#e6dcc4,Black:#1c1c1e"],
  ["Classic Baseball Cap", "Northline", "accessories", "Caps", "cap", "Cotton Twill", 899, 499, "Navy:#1f2a44,Beige:#d6c7a6,Black:#1c1c1e"],
  ["Cashmere-Feel Scarf", "Fieldwork", "accessories", "Scarves", "scarf", "Wool Blend", 1999, 1199, "Camel:#c09a6b,Burgundy:#7a2635,Grey:#8e8e93"],
  ["Leather Crossbody Bag", "Fieldwork", "accessories", "Bags", "bag", "Vegan Leather", 3999, 2399, "Tan:#a86b3c,Black:#1c1c1e"],
  ["Court Sneakers", "Stride", "accessories", "Footwear", "sneaker", "Leather", 4999, 2999, "White:#f4f4f1,Black:#1c1c1e"],
  ["Retro Runner Sneakers", "Stride", "accessories", "Footwear", "sneaker", "Mesh", 5499, 3499, "Grey:#a5a7ab,Navy:#26345a"],
  ["Quilted Puffer Jacket", "Urbanite", "seasonal", "Winterwear", "jacket", "Nylon", 6999, 3999, "Black:#1b1b1d,Olive:#505b35,Red:#b0302f"],
  ["Cable Knit Hoodie", "Northline", "seasonal", "Winterwear", "hoodie", "Wool Blend", 3999, 2499, "Cream:#ece3cf,Bottle:#2c4a3b"],
  ["Festive Silk Kurta", "Harbor & Co", "seasonal", "Festive", "shirt", "Silk Blend", 3999, 2599, "Mustard:#d4a032,Maroon:#7a1f2e"],
  ["Linen Beach Shorts", "Coastline", "seasonal", "Summer", "shorts", "Linen", 1499, 899, "Sand:#d8c39c,Aqua:#7cc3c4"],
  ["Rain Shell Jacket", "Urbanite", "seasonal", "Monsoon", "jacket", "Waterproof Nylon", 4499, 2799, "Yellow:#e8c33c,Navy:#1f2a44"],
  ["Ribbed Knit Beanie", "Northline", "seasonal", "Winterwear", "cap", "Acrylic", 799, 449, "Charcoal:#3a3a3d,Rust:#b5562e"],
];

const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
export const artImages = (kind: ArtKind, hex: string) => ["front", "back", "detail"].map((v) => `art:${kind}:${hex}:${v}`);

const DETAILS: Record<string, string[]> = {
  default: ["Machine wash cold, tumble dry low", "Ethically made in India", "Easy 14-day returns & exchanges"],
};
const FIT = ["Regular fit", "Relaxed fit", "Slim fit", "Oversized fit"];

function product(r: Row, i: number, now: number): Product {
  const [name, brand, category, subcategory, kind, fabric, mrp, price, cs] = r;
  const colors = cs.split(",").map((c) => { const [n, hex] = c.split(":"); return { name: n, hex, images: artImages(kind, hex) }; });
  const sizes: Size[] = category === "accessories" || kind === "cap" ? ["Free"] : category === "kids" ? ["XS", "S", "M", "L"] : [...SIZES];
  const slug = slugify(name);
  const variants = colors.flatMap((c) => sizes.map((sz) => {
    const roll = rnd();
    return { sku: `${slug.slice(0, 10).toUpperCase()}-${c.name.slice(0, 3).toUpperCase()}-${sz}`, color: c.name, size: sz, stock: roll < 0.08 ? 0 : roll < 0.2 ? int(1, 3) : int(6, 40) };
  }));
  return {
    id: `p${i + 1}`, slug, name, brand, category, subcategory, kind, fabric,
    description: `${name} from ${brand} — crafted in breathable ${fabric.toLowerCase()} with a considered silhouette that moves from weekday to weekend. Designed to last beyond the season.`,
    details: [`${pick(FIT)}`, `${fabric}`, ...DETAILS.default],
    mrp, price, colors, sizes, variants,
    rating: Math.round((3.7 + rnd() * 1.2) * 10) / 10, ratingCount: int(18, 2400), sold: int(20, 6000), views: int(500, 40000),
    createdAt: now - int(1, 90) * DAY, flashSale: i % 6 === 2 ? { percent: pick([15, 20, 25]), endsAt: now + 7 * DAY } : null, active: true,
  };
}

const FIRST = ["Aarav", "Diya", "Kabir", "Ananya", "Vihaan", "Isha", "Rohan", "Meera", "Arjun", "Saanvi", "Kian", "Tara", "Neel", "Zoya", "Dev", "Riya", "Aditya", "Nisha", "Ishaan", "Kavya"];
const LAST = ["Sharma", "Iyer", "Kapoor", "Mehta", "Reddy", "Nair", "Gupta", "Bose", "Singh", "Das"];
const CITIES: [string, string, string][] = [["Ahmedabad", "Gujarat", "380009"], ["Mumbai", "Maharashtra", "400050"], ["Bengaluru", "Karnataka", "560038"], ["Delhi", "Delhi", "110016"], ["Pune", "Maharashtra", "411001"], ["Chennai", "Tamil Nadu", "600017"], ["Kolkata", "West Bengal", "700019"], ["Hyderabad", "Telangana", "500034"]];
const REVIEWS: [number, string, string][] = [
  [5, "Perfect fit", "True to size and the fabric feels premium. Already ordered another colour."],
  [5, "Love it", "Looks even better in person. Got so many compliments on the first wear."],
  [4, "Great quality", "Stitching is neat and the colour is exactly as shown. Slightly long for me."],
  [4, "Comfortable", "Soft, breathable and survived three washes without shrinking."],
  [3, "Decent", "Nice design but runs a little large, I'd size down."],
  [5, "Worth every rupee", "Fast delivery, beautiful packaging and the quality is excellent."],
  [2, "Not for me", "The colour was a bit duller than the photos. Exchange was easy though."],
];

export function buildSeed(): DB {
  s = 42;
  idc = 0;
  const now = Date.now();
  const products = ROWS.map((r, i) => product(r, i, now));
  const mkUser = (name: string, extra: Partial<User>): User => ({
    id: newId(), name, role: "customer", blocked: false, addresses: [], measurements: {}, createdAt: now - int(5, 200) * DAY, lastActiveAt: now - int(0, 40) * DAY, ...extra,
  });
  const addr = (name: string, phone: string, i = 0) => { const [city, state, pincode] = CITIES[i % CITIES.length]; return { id: newId(), name, phone, line1: `${int(2, 220)}, ${pick(["Palm Grove", "Lake View", "Sunrise Residency", "Green Park"])}`, line2: pick(["Near Metro Station", "Opp. City Mall", ""]), city, state, pincode, label: "Home" as const, isDefault: true }; };

  const admin = mkUser("Store Admin", { email: "admin@threadly.dev", passwordHash: hashPassword("Admin@123"), role: "admin", lastActiveAt: now });
  const demo = mkUser("Demo Shopper", { email: "demo@threadly.dev", phone: "9876543210", passwordHash: hashPassword("Demo@123"), lastActiveAt: now, measurements: { height: 175, chest: 98, waist: 82, hips: 96, inseam: 80, fit: "regular" } });
  demo.addresses = [addr("Demo Shopper", "9876543210", 1), { ...addr("Demo Shopper", "9876543210", 0), label: "Work", isDefault: false }];
  const riders = [mkUser("Ravi Kumar", { email: "rider@threadly.dev", phone: "9000000001", passwordHash: hashPassword("Rider@123"), role: "delivery", city: "Mumbai" }), mkUser("Sunil Yadav", { email: "rider2@threadly.dev", phone: "9000000002", passwordHash: hashPassword("Rider@123"), role: "delivery", city: "Ahmedabad" })];
  const customers = Array.from({ length: 28 }, (_, i) => {
    const name = `${FIRST[i % FIRST.length]} ${pick(LAST)}`;
    const u = mkUser(name, { email: `${name.toLowerCase().replace(" ", ".")}${i}@example.com`, phone: `98${int(10000000, 99999999)}` });
    u.addresses = [addr(name, u.phone!, i)];
    if (i === 7) u.blocked = true;
    return u;
  });

  const reviews: Review[] = products.flatMap((p) => Array.from({ length: int(2, 5) }, () => {
    const [rating, title, body] = pick(REVIEWS); const u = pick(customers);
    return { id: newId(), productId: p.id, userId: u.id, name: u.name.split(" ")[0] + " " + u.name.split(" ")[1][0] + ".", rating, title, body, photos: [], verified: rnd() > 0.3, size: p.sizes[int(0, p.sizes.length - 1)], createdAt: now - int(1, 60) * DAY };
  }));

  const orders: Order[] = [];
  const buyers = [demo, demo, demo, ...customers];
  for (let k = 0; k < 90; k++) {
    const u = k < 3 ? demo : pick(buyers);
    const ageDays = k === 0 ? 3 : k === 1 ? 1 : k === 2 ? 0 : rnd() < 0.7 ? int(0, 29) : int(30, 120);
    const created = now - ageDays * DAY - int(0, 20) * 3_600_000;
    const items = Array.from({ length: int(1, 3) }, () => {
      const p = pick(products); const c = pick(p.colors); const sz = pick(p.sizes);
      return { productId: p.id, slug: p.slug, name: p.name, brand: p.brand, image: c.images[0], color: c.name, size: sz, sku: `${p.slug}-${c.name}-${sz}`, qty: int(1, 2), price: p.price, mrp: p.mrp };
    });
    const speed = rnd() > 0.8 ? "express" : "standard";
    let status: OrderStatus = FLOW[Math.min(4, Math.floor(ageDays / 1.2))];
    if (k === 0) status = "delivered"; if (k === 1) status = "shipped"; if (k === 2) status = "placed";
    if (k > 2 && rnd() < 0.07) status = "cancelled";
    if (k > 2 && status === "delivered" && rnd() < 0.12) status = "return_requested";
    const idx = FLOW.indexOf(status);
    const steps = idx >= 0 ? FLOW.slice(0, idx + 1) : status === "cancelled" ? ["placed", "cancelled"] as OrderStatus[] : [...FLOW, status];
    const method = pick(["card", "upi", "upi", "cod", "wallet", "netbanking"] as const);
    orders.push({
      id: newId(), ref: `TH${new Date(created).toISOString().slice(2, 10).replace(/-/g, "")}-${(0x10000000 + k * 7919).toString(16).toUpperCase()}`, userId: u.id, items,
      address: u.addresses[0] ?? addr(u.name, "9999999999"), deliverySpeed: speed,
      payment: { method, status: method === "cod" && status !== "delivered" ? "pending" : "paid", txnId: method === "cod" ? undefined : `pay_${newId(8)}` },
      totals: computeTotals(items, speed), status,
      timeline: steps.map((st, j) => ({ status: st, at: created + j * 0.9 * DAY })),
      deliveryPartnerId: idx >= 2 || status === "delivered" ? pick(riders).id : undefined,
      returnRequest: status === "return_requested" ? { type: "return", reason: "Size too large", at: now - DAY } : undefined,
      createdAt: created, eta: created + (speed === "express" ? 2 : 5) * DAY,
    });
  }
  for (const o of orders) if (o.status === "delivered") o.timeline.forEach((t, j) => (t.at = Math.min(t.at, now - (4 - j) * 3_600_000)));

  const coupons: Coupon[] = [
    { code: "WELCOME10", description: "10% off your first order (up to ₹300)", type: "percent", value: 10, minOrder: 999, maxDiscount: 300, active: true, used: 112 },
    { code: "STYLE20", description: "20% off on orders above ₹1,999 (up to ₹1,000)", type: "percent", value: 20, minOrder: 1999, maxDiscount: 1000, expiresAt: now + 30 * DAY, active: true, used: 58 },
    { code: "FLAT500", description: "Flat ₹500 off on orders above ₹2,999", type: "flat", value: 500, minOrder: 2999, active: true, used: 31 },
    { code: "MONSOON15", description: "15% off — monsoon edit (expired)", type: "percent", value: 15, minOrder: 0, expiresAt: now - 5 * DAY, active: true, used: 240 },
  ];
  const banners: Banner[] = [
    { id: "b4", eyebrow: "Grand Festive Sale", title: "Celebrate\nin style", subtitle: "Silk kurtas, festive shirts and party dresses for every celebration.", cta: "Shop now", href: "/shop?q=festive", from: "#5a1020", to: "#a3243b", art: { kind: "shirt", hex: "#d4a032" }, badge: "40–60% OFF" },
    { id: "b1", eyebrow: "Winter '26 Collection", title: "Layers that\nmean business", subtitle: "Puffers, wool coats and heavyweight knits.", cta: "Shop winterwear", href: "/shop?category=seasonal", from: "#1f2a44", to: "#3d5a80", art: { kind: "jacket", hex: "#b88a5c" }, badge: "UP TO 45% OFF" },
    { id: "b2", eyebrow: "Flash Sale · Live now", title: "Extra off\nthe icons", subtitle: "Limited-time prices on bestsellers. While stocks last.", cta: "Grab the deals", href: "/shop?sale=flash", from: "#be300d", to: "#f45d17", art: { kind: "hoodie", hex: "#f3f2ec" }, badge: "EXTRA 25% OFF" },
    { id: "b3", eyebrow: "New In · Women", title: "The dress\nedit", subtitle: "Wrap, slip and sun dresses in this season's palette.", cta: "Explore dresses", href: "/shop?category=women&q=dress", from: "#5b2a3a", to: "#b4677a", art: { kind: "dress", hex: "#e2cba0" }, badge: "FROM ₹1,199" },
    { id: "b5", eyebrow: "Kids · Back to play", title: "Little ones,\nbig style", subtitle: "Graphic tees, hoodies and joggers built for play.", cta: "Shop kids", href: "/shop?category=kids&max=800", from: "#1d5c63", to: "#2a8c8c", art: { kind: "tee", hex: "#f2c94c" }, badge: "UNDER ₹800" },
  ];
  const users = [admin, demo, ...riders, ...customers];
  const d = { users, orders, coinLedger: [], retention: structuredClone(DEFAULT_RETENTION) } as unknown as DB;
  users.forEach((u, i) => { u.coins = 0; u.referralCode = `${(u.name.replace(/[^a-z]/gi, "").slice(0, 5) || "TH").toUpperCase()}${(4096 + i * 37).toString(16).toUpperCase()}`; });
  creditCoins(d, demo, DEFAULT_RETENTION.loyalty.welcomeCoins, "Welcome bonus");
  for (const o of [...orders].sort((a, b) => a.createdAt - b.createdAt)) {
    const u = users.find((x) => x.id === o.userId)!;
    if (o.status === "delivered" || o.status === "return_requested") o.coinsEarned = creditCoins(d, u, Math.floor(((o.totals.total - o.totals.delivery - o.totals.tax) / 100) * 5), `Earned on order ${o.ref}`, o.id);
  }
  customers[3].referredBy = demo.id; customers[3].referralRewarded = true;
  creditCoins(d, demo, DEFAULT_RETENTION.referral.referrerCoins, `Referral reward — ${customers[3].name} placed their first order`);
  // A few abandoned bags (older than the reminder threshold) for the admin retention page.
  [customers[0], customers[5], customers[9]].forEach((u, i) => {
    const p = products[i * 7 + 2]; const c = p.colors[0]; const v = p.variants.find((x) => x.color === c.name && x.stock > 0) ?? p.variants[0];
    u.cart = { updatedAt: now - (5 + i * 20) * 3_600_000, items: [{ productId: p.id, slug: p.slug, name: p.name, brand: p.brand, image: c.images[0], color: c.name, size: v.size, sku: v.sku, qty: 1, price: p.price, mrp: p.mrp }] };
  });
  // Waitlist demand on sold-out variants.
  const soldOut = products.flatMap((p) => p.variants.filter((v) => v.stock === 0).map((v) => ({ p, v }))).slice(0, 6);
  const waitlist = soldOut.flatMap(({ p, v }, i) => customers.slice(i, i + 1 + (i % 3)).map((u) => ({ id: newId(), userId: u.id, productId: p.id, color: v.color, size: v.size, createdAt: now - int(1, 10) * DAY })));
  // A few existing Plus members so the membership dashboard has data.
  const memberships = [customers[1], customers[2], customers[4], customers[11]].map((u, i) => {
    const plan = d.retention.membership!.plans[i % 2];
    const at = now - int(5, 200) * DAY;
    const expiresAt = Math.max(at + plan.days * DAY, now + int(3, 40) * DAY);
    u.membership = { planId: plan.id, since: at, expiresAt };
    return { id: newId(), userId: u.id, planId: plan.id, planName: plan.name, price: plan.price, method: "upi" as const, txnId: `pay_${newId(8)}`, at, expiresAt };
  });
  return {
    version: 1, users, products, orders, reviews, coupons, banners, retention: d.retention, coinLedger: d.coinLedger, waitlist, memberships, delivery: structuredClone(DEFAULT_DELIVERY),
    notifications: [{ id: newId(), userId: null, title: "Welcome to Threadly 👋", body: "Use WELCOME10 for 10% off your first order.", href: "/shop", createdAt: now - DAY, readBy: [] }],
    campaigns: [], otps: [], secret: randomId(32),
    tickets: [{ id: newId(), userId: demo.id, subject: "Exchange size for my hoodie", orderRef: orders[0].ref, status: "open", messages: [{ from: "customer", body: "Hi, can I exchange my hoodie for a size L?", at: now - 2 * 3_600_000 }], createdAt: now - 2 * 3_600_000 }],
  };
}

/**
 * Empty store for a new white-label client: no demo products, orders, customers or demo passwords.
 * The owner's admin login comes from ADMIN_EMAIL / ADMIN_PASSWORD; the store name from STORE_NAME.
 */
export function buildBlankSeed(env: Record<string, string | undefined> = process.env): DB {
  idc = 0;
  const email = (env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = env.ADMIN_PASSWORD ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("DEMO_DATA=false needs ADMIN_EMAIL set to the store owner's email (see .env.example)");
  if (password.length < 8 || !/\d/.test(password) || !/[a-z]/i.test(password)) throw new Error("DEMO_DATA=false needs ADMIN_PASSWORD with 8+ characters, letters and numbers");
  const name = (env.STORE_NAME ?? "My Store").trim().slice(0, 40) || "My Store";
  const now = Date.now();
  const admin: User = { id: newId(), name: "Store Owner", email, passwordHash: hashPassword(password), role: "admin", blocked: false, addresses: [], measurements: {}, createdAt: now, lastActiveAt: now, coins: 0, referralCode: `${(name.replace(/[^a-z]/gi, "").slice(0, 5) || "TH").toUpperCase()}1000` };
  const brand = blankBrand(name);
  const p = palette(brand.primary);
  return {
    version: 1, users: [admin], products: [], orders: [], reviews: [], coupons: [], notifications: [], campaigns: [], tickets: [], otps: [],
    secret: randomId(32), coinLedger: [], waitlist: [], memberships: [],
    retention: structuredClone(DEFAULT_RETENTION), delivery: { ...structuredClone(DEFAULT_DELIVERY), cities: [] }, brand,
    banners: [{ id: "welcome", eyebrow: "Welcome", title: `Welcome to\n${name}`, subtitle: brand.tagline, cta: "Shop now", href: "/shop", from: p[700], to: p[500], art: { kind: "tee", hex: "#f3f2ec" }, active: true }],
  };
}
