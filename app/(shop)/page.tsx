import Link from "next/link";
import { ArrowRight, RotateCcw, ShieldCheck, Truck, Zap } from "lucide-react";
import HeroCarousel from "@/components/HeroCarousel";
import ProductArt from "@/components/ProductArt";
import { ProductRail } from "@/components/ProductCard";
import { Countdown } from "@/components/ui";
import { cardData, personalRails } from "@/lib/catalog";
import { activePlan } from "@/lib/retention-core";
import { memberProgram } from "@/lib/brand";
import { getBrand } from "@/lib/server-utils";
import { db } from "@/lib/db";
import { BrandStrip, CouponStrip, FeaturedBrands, MobileTop, OfferCard, type BrandCard } from "@/components/HomeExtras";
import { currentUser } from "@/lib/auth";
import { flashActive, pctOff, unitPrice } from "@/lib/pricing";
import { getT } from "@/lib/server-utils";
import type { ArtKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const CATS: { key: "men" | "women" | "kids" | "accessories" | "seasonal"; label: "nav.men" | "nav.women" | "nav.kids" | "nav.accessories" | "nav.seasonal"; kind: ArtKind; hex: string }[] = [
  { key: "men", label: "nav.men", kind: "shirt", hex: "#9cc3e6" },
  { key: "women", label: "nav.women", kind: "dress", hex: "#d9828f" },
  { key: "kids", label: "nav.kids", kind: "tee", hex: "#f2c94c" },
  { key: "accessories", label: "nav.accessories", kind: "bag", hex: "#a86b3c" },
  { key: "seasonal", label: "nav.seasonal", kind: "jacket", hex: "#505b35" },
];

function Section({ title, href, children, action }: { title: string; href?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mx-auto mt-14 max-w-7xl px-4">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-bold md:text-3xl">{title}</h2>
        {action}
        {href && <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold hover:underline">View all <ArrowRight className="size-4" /></Link>}
      </div>
      {children}
    </section>
  );
}

export default async function Home() {
  const t = await getT();
  const d = db();
  const ps = d.products.filter((p) => p.active);
  const top = (fn: (a: (typeof ps)[number], b: (typeof ps)[number]) => number, n = 10) => [...ps].sort(fn).slice(0, n).map(cardData);
  const flash = ps.filter((p) => flashActive(p));
  const flashEnds = Math.min(...flash.map((p) => p.flashSale!.endsAt));
  const counts = Object.fromEntries(CATS.map((c) => [c.key, ps.filter((p) => p.category === c.key).length]));
  const user = await currentUser();
  const live = d.coupons.filter((c) => c.active && (!c.expiresAt || c.expiresAt > Date.now()));
  const flat = live.filter((c) => c.type === "flat").sort((a, b) => b.value - a.value)[0];
  const pct = live.find((c) => c.type === "percent" && c.minOrder <= 999);
  const brands: BrandCard[] = [...new Set(ps.map((p) => p.brand))].map((brand) => {
    const mine = ps.filter((p) => p.brand === brand);
    const top = [...mine].sort((a, b) => b.sold - a.sold)[0];
    return { brand, image: top.colors[0].images[0], count: mine.length, off: Math.max(...mine.map((p) => pctOff(p.mrp, unitPrice(p)))), from: Math.min(...mine.map((p) => unitPrice(p))) };
  }).sort((a, b) => b.count - a.count).slice(0, 10);

  const personal = user ? personalRails(user.id) : null;
  const plusPlans = d.retention.membership?.enabled ? d.retention.membership.plans.filter((p) => p.active) : [];
  const isMember = !!activePlan(d, user);
  const first = user?.name.split(" ")[0];

  return (
    <div className="md:pt-4">
      <MobileTop defaultPin={user?.addresses.find((a) => a.isDefault)?.pincode} />
      {flat && <div className="mt-4 md:mx-auto md:mb-4 md:max-w-7xl md:px-4"><CouponStrip code={flat.code} headline={`FLAT ₹${flat.value} OFF`} note={flat.description} /></div>}
      <div className="mx-auto mt-3 max-w-7xl px-2 md:mt-0 md:px-4"><HeroCarousel banners={d.banners.filter((b) => b.active !== false)} /></div>
      <div className="mt-4 space-y-3 md:mx-auto md:max-w-7xl md:px-4">
        <BrandStrip brands={brands.map((b) => b.brand)} />
        {pct && <OfferCard code={pct.code} text={pct.description} />}
      </div>
      {personal && personal.forYou.length > 0 && <Section title={`Picked for you, ${first} ✨`}><ProductRail items={personal.forYou} /></Section>}
      {personal && personal.buyAgain.length > 0 && <Section title="Buy again 🔁" href="/account/orders"><ProductRail items={personal.buyAgain} /></Section>}
      {plusPlans.length > 0 && !isMember && (
        <section className="mx-auto mt-10 max-w-7xl px-4">
          <Link href="/membership" className="flex items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-r from-brand-800 via-brand-600 to-amber-500 p-5 text-white md:p-7">
            <span className="text-4xl">👑</span>
            <span className="flex-1"><span className="block font-display text-xl font-bold md:text-2xl">Join {memberProgram(getBrand())}</span><span className="text-sm text-white/85">Up to {Math.max(...plusPlans.map((p) => p.discountPct))}% extra off + free delivery on every order · from ₹{Math.min(...plusPlans.map((p) => p.price))}</span></span>
            <ArrowRight className="size-6 shrink-0" />
          </Link>
        </section>
      )}
      <div className="md:mx-auto md:max-w-7xl md:px-4"><FeaturedBrands brands={brands} /></div>

      <div className="mx-auto mt-6 grid max-w-7xl grid-cols-3 gap-2 px-4 text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
        {[[Truck, "Free delivery over ₹999"], [RotateCcw, "14-day easy returns"], [ShieldCheck, "Secure payments"]].map(([I, l]) => {
          const Icon = I as typeof Truck;
          return <div key={l as string} className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-50 px-2 py-3 text-center dark:bg-zinc-900"><Icon className="size-4 shrink-0" />{l as string}</div>;
        })}
      </div>

      <Section title={t("home.categories")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATS.map((c, i) => (
            <Link key={c.key} href={`/shop?category=${c.key}`} className={`group relative overflow-hidden rounded-3xl ${i === 0 ? "col-span-2 sm:col-span-1" : ""}`}>
              <div className="aspect-[4/5] transition duration-500 group-hover:scale-105"><ProductArt kind={c.kind} hex={c.hex} className="h-full w-full" /></div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-white">
                <p className="text-lg font-semibold">{t(c.label)}</p>
                <p className="text-xs text-white/80">{counts[c.key]} styles</p>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {flash.length > 0 && (
        <section className="mx-auto mt-14 max-w-7xl px-4">
          <div className="rounded-3xl bg-gradient-to-br from-brand-50 to-amber-50 p-5 md:p-8 dark:from-brand-900/30 dark:to-zinc-900">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-brand-500 text-white"><Zap className="size-5" /></span>
                <div><h2 className="font-display text-2xl font-bold md:text-3xl">{t("home.flash")}</h2><p className="text-sm text-zinc-500">Extra off on handpicked styles</p></div>
              </div>
              <div className="flex items-center gap-3"><span className="text-sm font-medium text-zinc-500">{t("home.endsIn")}</span><Countdown endsAt={flashEnds} /></div>
            </div>
            <ProductRail items={flash.map(cardData)} />
            <Link href="/shop?sale=flash" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold hover:underline">Shop the sale <ArrowRight className="size-4" /></Link>
          </div>
        </section>
      )}

      <Section title={t("home.trending")} href="/shop?sort=popular"><ProductRail items={top((a, b) => b.views - a.views)} /></Section>

      <section className="mx-auto mt-14 grid max-w-7xl gap-4 px-4 md:grid-cols-2">
        {[
          { title: "The Linen Edit", sub: "Breathable layers for warm days", href: "/shop?fabric=Linen", kind: "shirt" as ArtKind, hex: "#e9e0cc", bg: "from-amber-100 to-orange-50 dark:from-amber-900/30 dark:to-zinc-900" },
          { title: "Denim, done right", sub: "Jackets, jeans & skirts from ₹1,199", href: "/shop?fabric=Denim", kind: "jacket" as ArtKind, hex: "#34497a", bg: "from-sky-100 to-indigo-50 dark:from-sky-900/30 dark:to-zinc-900" },
        ].map((x) => (
          <Link key={x.title} href={x.href} className={`group flex items-center overflow-hidden rounded-3xl bg-gradient-to-br ${x.bg}`}>
            <div className="flex-1 p-6 md:p-8"><h3 className="font-display text-2xl font-bold">{x.title}</h3><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{x.sub}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold group-hover:underline">Explore <ArrowRight className="size-4" /></span></div>
            <div className="h-48 w-40 shrink-0 transition duration-500 group-hover:scale-105 md:h-56 md:w-48"><ProductArt kind={x.kind} hex={x.hex} className="h-full w-full" /></div>
          </Link>
        ))}
      </section>

      <Section title={t("home.new")} href="/shop?sort=new"><ProductRail items={top((a, b) => b.createdAt - a.createdAt)} /></Section>
      <Section title={t("home.best")} href="/shop?sort=popular"><ProductRail items={top((a, b) => b.sold - a.sold)} /></Section>
    </div>
  );
}
