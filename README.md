# Threadly — full-stack clothing store

Next.js 15 (App Router, Server Actions) · React 19 · Tailwind CSS v4 · TypeScript. Mobile-first, dark/light mode, English/Hindi (i18n-ready for more languages), prices in INR.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

The first request seeds `data/db.json` (or `$DATA_DIR`) with 38 products, ~90 orders, reviews, coupons and users. `npm run reset` deletes it so it re-seeds. `npm run check` runs the pricing/sizing self-checks.

| Role | Login |
|---|---|
| Customer | demo@threadly.dev / Demo@123 |
| Admin | admin@threadly.dev / Admin@123 → `/admin` |
| Delivery partner | rider@threadly.dev / Rider@123 → `/delivery` |

Phone OTP: in dev the code is shown in a toast and logged to the server console.
Coupons: `WELCOME10`, `STYLE20`, `FLAT500` (and `MONSOON15`, which has expired).

## What's in it

- **Auth & roles**: email/password (scrypt, HMAC-signed httpOnly session cookie), Google OAuth 2.0 (set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`), phone OTP (hashed, 5-min expiry, 5 attempts, 30s resend). Roles: customer, admin, delivery. Profile with saved addresses, order history, wishlist and a measurement profile that drives "FIT" size picks.
- **Discovery**: auto-rotating hero carousel, category tiles, flash sale with live countdown, trending/new/best-seller rails, search with instant suggestions, keyboard navigation and voice search (Web Speech API).
- **Catalog**: filter by category, price, size, colour swatches, fabric, brand, discount and rating; sort by popularity, newest, price, rating and discount. The URL holds the state so links can be shared.
- **Product page**: gallery with hover zoom, full-screen pinch/wheel/double-tap zoom, swipe on mobile, multi-angle views, 360° preview and optional video. Colour swatches update the images live. Size selector with per-size stock ("Only 3 left!"), an interactive size guide (cm/in, find-my-size). Reviews with star filters, photo uploads and verified-buyer tags. Upsell, "you may also like" and "complete the look" rails.
- **Cart & checkout**: slide-over bag and a full bag page, priced by the server (MRP, discount, coupon, delivery, 5% GST). Coupons with instant validation. 3-step checkout: address (add new), Standard/Express delivery, then payment (UPI, card with Luhn check and brand detection, net banking, wallets, COD). Animated success screen with the order reference.
- **Orders**: live status timeline that auto-refreshes while the order is in transit, cancel before shipping, return/exchange within 14 days, and a GST tax invoice → PDF (via the browser's print).
- **Admin** (`/admin`): KPIs, a 14-day revenue chart, orders by status, low-stock alerts; product CRUD with a colour × size stock/price grid and multi-image upload; order status, rider assignment and return approval; customers (block/unblock); support tickets; coupons, flash sales and in-app notification campaigns.
- **Delivery partner** (`/delivery`): assigned orders, call/directions, COD to collect, out-for-delivery and delivered actions.
- **Customer retention**: everything below is switched on, off and configured from **Admin → Retention** (`/admin/retention`).
  - **Coins & tiers.** Customers earn coins on delivered orders (1 coin = ₹1) and spend them at checkout, up to a % of the order that admin sets. Bronze → Silver → Gold → Platinum tiers multiply how fast coins are earned. Cancelling an order refunds the coins spent on it; a return takes back the coins it earned.
  - **Refer & earn.** Every customer gets a personal code and a share link (`/login?ref=CODE`). The new member gets bonus coins when they join, and the person who invited them gets coins when the new member's first order is delivered.
  - **Back-in-stock alerts.** Sold-out sizes show a "Notify me" button. Any restock automatically notifies everyone waiting.
  - **Abandoned bags.** Logged-in shoppers' bags are saved on the server, which also restores them across devices. Admin can remind people, optionally with a coupon.
  - **Segments & win-back offers.** Customers are grouped as new, repeat, VIP, at-risk, churned or never-purchased. One click sends a segment a personal, one-time coupon.
  - **Customer side.** `/account/rewards` shows the coin balance, tier progress, coin history and referral sharing (WhatsApp/share sheet).
- **Threadly Plus membership** (`/membership`): paid plans with an extra % off every order, free delivery and a coin multiplier. Admin manages plans, prices and members under **Admin → Membership**.
- **Personal touch**: "Picked for you" and "Buy again" rows on the home page, built from each customer's own purchases. A yearly birthday coupon is sent automatically once the customer adds their birthday in Profile.
- **Referral as a coupon**: admin can choose the referrer's reward, either coins or a personal ₹ coupon ("Bring a friend → ₹100 coupon").
- **Follow us, earn coins**: admin sets the social links and the reward; each platform can be claimed once.
- **City-based delivery** (**Admin → Delivery**): set the fee and delivery days per city, and whether express and COD are offered there. Admin can restrict delivery to listed cities and assign riders to a city.
- **Customer tracking** (**Admin → Customers → a customer**): products bought and how many times, spend, order frequency, returns, coins, tier, segment and membership.
- **Installable app + mobile shop management**: customers can install Threadly on their phone (PWA). The admin panel has a mobile bottom tab bar, quick restock, and an app shortcut ("Shop manager").

Product images: seed products use built-in vector art (`components/ProductArt.tsx`) that recolours with each swatch. Photos uploaded in admin replace it per colour.

## Deploying

- **Vercel (demo/testing only).** It works out of the box: the store keeps its data in Vercel's temporary `/tmp` folder. Set **`SESSION_SECRET`** in Vercel → Settings → Environment Variables, or logins will randomly drop between Vercel's servers. That data is **wiped on every cold start and not shared between Vercel's servers**, so new sign-ups, orders, uploads and admin changes can disappear. Fine for showing the demo, not for real customers.
- **Real store.** Use a host with a persistent disk (Railway or Render with a volume, or a VPS) and point `DATA_DIR` at that disk.

## White-label: run it as any brand

Nothing about "Threadly" is hard-coded. The demo just ships with Threadly as its default brand.

**1. Rebrand an existing store.** Everything is in **Admin → Branding** and **Admin → Banners**, and saving updates the whole store instantly:

| Setting | Where it shows |
|---|---|
| Store name, short name, tagline | Header, footer, browser tab, installed app name, SEO, emails/notifications |
| **Logo** (wide image) | Header, footer, admin, invoice. Without one, the name is shown in the brand font. |
| **App icon** (square PNG/JPG) | Phone home-screen icon, favicon, share previews. Without one, an auto icon is made from the first letter and brand colour. |
| Brand colour | Buttons, badges, highlights, coupon strip, membership banners, app theme colour (a full 50–900 palette is generated) |
| Font style | Classic, Modern, Elegant or Minimal heading/body pairs |
| Default theme | Light, dark or follow the phone |
| Announcement bar, footer text, SEO description | Storefront |
| Support email, phone, WhatsApp, address | Footer contact links, invoice |
| Legal company name, GSTIN, registered address, invoice note | Tax invoice (PDF) |
| Order number prefix | New order numbers, e.g. `KG261119-1A2B3C4D` |
| Membership and coin names | "Kapda Ghar Gold", "Kapda Coins", ... |
| Demo login hints | **Turn off for real stores** |
| Hero banners | Admin → Banners: text, colours, links, your own photos, order, show/hide |

**2. Set up a new client (empty store).** Copy `.env.example` to `.env.local` and set:

```bash
DEMO_DATA=false
STORE_NAME=Kapda Ghar
ADMIN_EMAIL=owner@kapdaghar.in
ADMIN_PASSWORD=ChangeMe123
SESSION_SECRET=<long random string>
DATA_DIR=./data-kapdaghar
```

The first start creates an empty store with only the owner's admin account: no demo products, customers, orders or passwords. The owner then logs in, changes their password (Account → Change password), and fills in Branding, Banners, Products, Delivery cities and Coupons.

**3. Several brands from one codebase.** Run one instance per client, each with its own `DATA_DIR`, `SESSION_SECRET` and domain/port:

```bash
DATA_DIR=./data-brand-a PORT=3000 npm start
```

```bash
DATA_DIR=./data-brand-b PORT=3001 npm start
```


## Before going live (deliberate shortcuts, marked `shortcut:` in code)

1. **Database**: `lib/db.ts` is a single-process JSON store. Swap it for Postgres/Prisma before running more than one instance. All reads and writes go through `db()`/`mutate()`.
2. **Payments** are simulated in `placeOrder` (`lib/actions.ts`). Integrate Razorpay or Stripe and mark orders paid from the webhook.
3. **SMS**: wire an OTP provider (Twilio/MSG91) in `sendOtp`.
4. **Wishlist** lives in localStorage, per device (the bag syncs to the server for logged-in customers).
5. **Referral via Google sign-in**: the `?ref=` code is only applied for email and phone sign-ups.
6. **Push**: campaigns go to the in-app notification feed. Real web push needs a service worker and VAPID keys.
7. Set `SESSION_SECRET` (see `.env.example`). Uploads are stored in `data/uploads`, so put that on persistent storage or move it to S3.
8. **Social follow rewards** are honour-based (a follow can't be verified without each platform's API). **Membership payments** are simulated like checkout.
9. **White-label hosting**: each client store is its own process and data folder (JSON store). For many clients, move to a shared database with a `storeId` per record.
