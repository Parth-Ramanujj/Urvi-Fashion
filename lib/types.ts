import type { Brand } from "./brand";

export type Role = "customer" | "admin" | "delivery";
export const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export type Size = (typeof SIZES)[number] | "Free";
export const CATEGORIES = ["men", "women", "kids", "accessories", "seasonal"] as const;
export type Category = (typeof CATEGORIES)[number];
export const ART_KINDS = ["tee", "shirt", "hoodie", "jacket", "dress", "pants", "skirt", "shorts", "cap", "bag", "scarf", "sneaker"] as const;
export type ArtKind = (typeof ART_KINDS)[number];

/** Image strings are either a URL or "art:<kind>:<hex>:<view>" for built-in generated product art. */
export interface ColorOption { name: string; hex: string; images: string[] }
export interface Variant { sku: string; color: string; size: Size; stock: number; price?: number }

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: Category;
  subcategory: string;
  kind: ArtKind;
  fabric: string;
  description: string;
  details: string[];
  mrp: number;
  price: number;
  colors: ColorOption[];
  sizes: Size[];
  variants: Variant[];
  rating: number;
  ratingCount: number;
  sold: number;
  views: number;
  createdAt: number;
  flashSale: { percent: number; endsAt: number } | null;
  video?: string;
  active: boolean;
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  label: "Home" | "Work" | "Other";
  isDefault?: boolean;
}

export interface Measurements { height?: number; chest?: number; waist?: number; hips?: number; inseam?: number; fit?: "slim" | "regular" | "relaxed" }

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  passwordHash?: string;
  googleId?: string;
  tokenVersion?: number;
  role: Role;
  blocked: boolean;
  addresses: Address[];
  measurements: Measurements;
  createdAt: number;
  lastActiveAt: number;
  coins?: number;
  referralCode?: string;
  referredBy?: string;
  referralRewarded?: boolean;
  /** Server copy of the bag for logged-in users (abandoned-cart reminders + cross-device restore). */
  cart?: { items: CartLine[]; updatedAt: number; remindedAt?: number };
  membership?: { planId: string; since: number; expiresAt: number };
  /** YYYY-MM-DD; drives the yearly birthday reward. */
  dob?: string;
  birthdayRewardYear?: number;
  /** YYYY-MM-DD; wedding / relationship anniversary. */
  anniversary?: string;
  /** Any other personal milestone (e.g. Partner's birthday, Kid's birthday). */
  specialEvent?: { label: string; date: string };
  /** Social platforms whose follow reward was claimed. */
  socialClaimed?: string[];
  /** Delivery partners: the city they serve. */
  city?: string;
}

export type OrderStatus =
  | "placed" | "packed" | "shipped" | "out_for_delivery" | "delivered"
  | "cancelled" | "return_requested" | "returned" | "exchange_requested" | "exchanged" | "return_rejected";

export const FLOW: OrderStatus[] = ["placed", "packed", "shipped", "out_for_delivery", "delivered"];

export type PaymentMethod = "card" | "upi" | "netbanking" | "wallet" | "cod";

export interface OrderItem { productId: string; slug: string; name: string; brand: string; image: string; color: string; size: Size; sku: string; qty: number; price: number; mrp: number }

export interface Totals { mrp: number; discount: number; coupon: number; member?: number; coins?: number; delivery: number; tax: number; total: number }

export interface Order {
  id: string;
  ref: string;
  userId: string;
  items: OrderItem[];
  address: Address;
  deliverySpeed: "standard" | "express";
  payment: { method: PaymentMethod; status: "paid" | "pending" | "refunded"; txnId?: string };
  couponCode?: string;
  totals: Totals;
  status: OrderStatus;
  timeline: { status: OrderStatus; at: number; note?: string }[];
  deliveryPartnerId?: string;
  returnRequest?: { type: "return" | "exchange"; reason: string; at: number; exchangeSize?: Size };
  createdAt: number;
  eta: number;
  coinsUsed?: number;
  coinsEarned?: number;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  name: string;
  rating: number;
  title: string;
  body: string;
  photos: string[];
  verified: boolean;
  size?: string;
  createdAt: number;
}

export interface Coupon {
  code: string;
  description: string;
  type: "percent" | "flat";
  value: number;
  minOrder: number;
  maxDiscount?: number;
  expiresAt?: number;
  active: boolean;
  used: number;
  /** Restrict to these customers (personal / segment offers). */
  userIds?: string[];
  onePerUser?: boolean;
}

export interface Banner { id: string; eyebrow: string; title: string; subtitle: string; cta: string; href: string; from: string; to: string; art: { kind: ArtKind; hex: string }; badge?: string; /** Uploaded banner photo; replaces the generated art. */ image?: string; active?: boolean }

export interface Notification { id: string; userId: string | null; title: string; body: string; href?: string; createdAt: number; readBy: string[] }
export interface Campaign { id: string; title: string; body: string; href?: string; audience: string; sentAt: number; reach: number }

export interface Ticket {
  id: string;
  userId: string;
  subject: string;
  orderRef?: string;
  status: "open" | "resolved";
  messages: { from: "customer" | "admin"; body: string; at: number }[];
  createdAt: number;
}

export interface Otp { phone: string; hash: string; expiresAt: number; attempts: number; sentAt: number }

export interface DB {
  version: number;
  users: User[];
  products: Product[];
  orders: Order[];
  reviews: Review[];
  coupons: Coupon[];
  banners: Banner[];
  notifications: Notification[];
  campaigns: Campaign[];
  tickets: Ticket[];
  otps: Otp[];
  secret: string;
  retention: RetentionSettings;
  coinLedger: CoinEntry[];
  waitlist: WaitlistEntry[];
  delivery?: DeliverySettings;
  memberships?: MembershipPurchase[];
  brand?: Brand;
}

export interface MembershipPlan { id: string; name: string; price: number; days: number; discountPct: number; freeDelivery: boolean; coinMultiplier: number; color: string; active: boolean; tagline: string }
export interface MembershipPurchase { id: string; userId: string; planId: string; planName: string; price: number; method: PaymentMethod; txnId?: string; at: number; expiresAt: number }
export interface SocialLink { id: string; label: string; url: string }
export interface CityRule { id: string; name: string; active: boolean; standardFee: number; expressFee: number; standardDays: [number, number]; expressDays: [number, number]; express: boolean; cod: boolean }
/** City-based delivery. Cities not listed use the defaults, unless restrictToCities is on (then they're not serviceable). */
export interface DeliverySettings { restrictToCities: boolean; freeAbove: number; standardFee: number; expressFee: number; cities: CityRule[] }

export interface Tier { name: string; minSpend: number; multiplier: number; color: string }
export interface RetentionSettings {
  loyalty: { enabled: boolean; earnPer100: number; maxRedeemPct: number; welcomeCoins: number };
  tiers: Tier[];
  /** rewardType "coupon": the referrer gets a personal flat ₹referrerCoins coupon instead of coins. */
  referral: { enabled: boolean; referrerCoins: number; refereeCoins: number; rewardType?: "coins" | "coupon" };
  membership?: { enabled: boolean; plans: MembershipPlan[] };
  birthday?: { enabled: boolean; type: "percent" | "flat"; value: number; validDays: number };
  social?: { enabled: boolean; coins: number; links: SocialLink[] };
  backInStock: { enabled: boolean };
  abandonedCart: { enabled: boolean; afterHours: number };
  segments: { atRiskDays: number; churnDays: number; vipOrders: number };
}
export interface CoinEntry { id: string; userId: string; amount: number; reason: string; orderId?: string; at: number }
export interface WaitlistEntry { id: string; userId: string; productId: string; color: string; size: Size; createdAt: number; notifiedAt?: number }

/** Shape of a cart line kept in the browser; prices here are display-only, the server re-prices at checkout. */
export interface CartLine { productId: string; slug: string; name: string; brand: string; image: string; color: string; size: Size; sku: string; qty: number; price: number; mrp: number }
