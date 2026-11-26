# AGENTS.md

White-label clothing store (default brand "Threadly"): Next.js 15 App Router, React 19, Tailwind CSS v4, strict TypeScript, PostgreSQL (with a JSON-file fallback). Prices are INR.

## Commands

- `npm run dev` — dev server; the first start seeds `data/db.json` with demo data.
- `npm run check` — the only automated suite (assert-based checks for pricing, sizing, delivery, crypto, seed and the store diff). Requires Node >= 22.6 because it uses `--experimental-strip-types`.
- `npx tsc --noEmit` — typecheck. There is no lint script or ESLint config; `npm run build` also typechecks.
- `npm run reset` — deletes the hardcoded `./data` folder, **including uploads**; it ignores a custom `DATA_DIR`. The next start re-seeds.
- No test framework, CI, pre-commit or formatter config. Add pure-logic assertions to `scripts/selfcheck.ts`.

## Data layer: read with `db()`, write only with `mutate()`

- `lib/db.ts` keeps the whole store in memory. `db()` is synchronous; `mutate((d) => ...)` is the only write path (serialized; one PostgreSQL transaction or an atomic JSON rewrite). Never edit the object returned by `db()` and never write `db.json` directly.
- `instrumentation.ts` calls `initDb()` once per server process. A startup failure is logged and pages then throw `Database not ready`.
- PostgreSQL is the real database (`pg`). The README, `instrumentation.ts` comment, `lib/store-diff.ts` comments and the Admin → Database UI still say "MySQL" — they are stale. `mysql2` in `package.json` is unused. Use a `postgresql://` URL; the commented example in `.env.local` is a stale MySQL URL.
- Without `DATABASE_URL`, data is the JSON file at `DATA_DIR/db.json`. It is loaded once, so manual edits while the server runs are lost; use the Admin backup/restore or reset.
- Schema and versioned migrations live in `lib/db-schema.ts` and run automatically at startup. Add new migrations there; do not hand-edit tables.
- A new persisted collection or setting must be registered in `COLLECTIONS` / `SETTINGS` in `lib/store-diff.ts` and have matching tables/columns in `lib/db-schema.ts`, or it will not be saved.
- Other server processes pick up writes within ~3 seconds; a writer refreshes before its own write.

## Server Actions, auth and mutations

- Mutations are Server Actions in `lib/actions.ts` (storefront), `lib/admin-actions.ts`, `lib/admin-extra-actions.ts` and `lib/retention-admin.ts`. The only API routes are `/api/auth/google`, `/api/analytics`, `/api/files/[name]` and `/api/health`; do not add mutation API routes.
- Wrap action bodies in `run()` and throw `fail("message")` / `HttpError` for user-facing errors. `run()` maps PostgreSQL `23505` / `23503` and connection errors to friendly messages.
- Guard actions with `await requireUser("admin")` (roles: `customer | admin | delivery`); guard pages/layouts with `await pageUser(nextPath, "admin")`, which redirects.
- After a mutation call `revalidatePath`; admin code uses `touchAdmin()` = `revalidatePath("/", "layout")`.
- The `th_session` cookie stores a `tokenVersion`. Password changes and role changes bump it to invalidate sessions — keep that pattern for any new "log out everywhere" behavior.

## Environment

- `.env.local` is loaded by Next; `.env.example` is the template.
- `SESSION_SECRET` (>= 16 chars, not a placeholder) is required in production; otherwise a generated secret is stored in the DB and sessions break on reset.
- `DEMO_DATA=false` creates an empty store with only `ADMIN_EMAIL` / `ADMIN_PASSWORD` (8+ chars, letters + numbers).
- `DATA_DIR` defaults to `./data` (Vercel: `/tmp/store-data`). `CLOUDINARY_URL` is optional; without it uploads are written to `DATA_DIR/uploads` and served by `/api/files/[name]`.

## Conventions and traps

- `@/*` maps to the repo root. Modules that must never reach the client import `server-only`.
- Branding is data, not code: read `getBrand()`; colours and fonts are runtime CSS variables (`brand-*`, `--font-head` / `--font-body`) injected by `brandCss()` in `app/layout.tsx`. Never hardcode the store name, "Threadly" or a brand colour in new UI.
- Money is computed on the server in `lib/pricing.ts` (`computeTotals`, `unitPrice`): 5% GST, standard delivery ₹49 / express ₹149, free standard at ₹1999+. Format with `formatMoney` or `<Money>`.
- i18n: server `getT()`, client `useApp().t` or `<T k="..." />`. Add keys to both `en` and `hi` in `lib/i18n.ts`.
- Raw `<img>` is intentional (see `components/ProductImage.tsx`): uploads can be arbitrary/Cloudinary URLs and `next.config.ts` has no `images.remotePatterns`. Seed images are `art:<kind>:<hex>:<view>` pseudo-URLs rendered by `ProductArt`. Do not convert these to `next/image`.
- `CLAUDE.md` is a generic stub that conflicts with this repo (e.g. it mandates `next/image`); prefer this file.
- Deliberate stubs are marked `shortcut:` in code: payments are simulated in `placeOrder`, OTP is only logged/toasted, wishlist is localStorage, campaigns are in-app notifications. Do not "fix" them unasked.
- Demo logins: `demo@threadly.dev / Demo@123`, `admin@threadly.dev / Admin@123`, `rider@threadly.dev / Rider@123`. Demo coupons: `WELCOME10`, `STYLE20`, `FLAT500`.
