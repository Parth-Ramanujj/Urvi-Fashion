"use client";
import Link from "next/link";
import { ChevronRight, Percent, Truck } from "lucide-react";
import { DELIVERY } from "@/lib/pricing";
import ProductImage from "./ProductImage";
import { trackEvent, useApp } from "./Providers";
import SearchBar from "./SearchBar";

/** Mobile full-width search bar shown at the top of the home page. */
export function MobileTop() {
  return (
    <div className="px-4 pt-3 md:hidden [&_form]:h-12 [&_form]:rounded-full [&_form]:border-zinc-200 [&_form]:bg-white [&_form]:shadow-[0_2px_10px_rgba(0,0,0,0.08)] dark:[&_form]:border-zinc-800 dark:[&_form]:bg-zinc-900"><SearchBar /></div>
  );
}

/** "FLAT ₹X OFF · USE CODE · CLAIM NOW" strip. Claiming stores the code so the bag applies it automatically. */
export function CouponStrip({ code, headline, note }: { code: string; headline: string; note: string }) {
  const { toast } = useApp();
  const claim = () => {
    trackEvent("coupon_apply", { meta: code });
    try { sessionStorage.setItem("th_coupon", code); } catch {}
    navigator.clipboard?.writeText(code).catch(() => {});
    toast(`${code} claimed — it'll be applied in your bag`);
  };
  return (
    <button onClick={claim} className="flex w-full items-center overflow-hidden bg-gradient-to-r from-brand-900 via-brand-700 to-brand-900 text-white md:rounded-2xl">
      <span className="flex-1 whitespace-nowrap px-3 py-2.5 text-left font-display text-lg font-bold tracking-tight sm:px-4 sm:text-2xl">{headline}</span>
      <span className="h-10 w-px bg-white/30" />
      <span className="flex flex-col items-center px-3 py-1.5">
        <span className="text-[9px] font-semibold tracking-widest text-white/80">USE CODE:</span>
        <span className="rounded bg-amber-300 px-2 font-mono text-xs font-bold text-brand-900">{code}</span>
      </span>
      <span className="mr-3 flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-brand-900">CLAIM NOW <ChevronRight className="size-3 rounded-full bg-brand-900 text-white" /></span>
      <span className="sr-only">{note}</span>
    </button>
  );
}

/** Scrolling brand ribbon. */
export function BrandStrip({ brands }: { brands: string[] }) {
  const loop = [...brands, ...brands];
  return (
    <div className="relative overflow-hidden border-y border-amber-200/60 bg-gradient-to-r from-amber-50 via-white to-amber-50 py-2.5 dark:border-amber-900/40 dark:from-amber-950/30 dark:via-zinc-950 dark:to-amber-950/30">
      <div className="flex w-max animate-marquee items-center gap-6 hover:[animation-play-state:paused]">
        {loop.map((b, i) => (
          <Link key={i} href={`/shop?brand=${encodeURIComponent(b)}`} className="flex items-center gap-6 whitespace-nowrap">
            <span className="text-[9px] font-semibold tracking-widest text-zinc-500">{i % 2 ? "CO-POWERED BY" : "POWERED BY"}</span>
            <span className="font-display text-lg font-bold uppercase tracking-wide">{b}</span>
            <ChevronRight className="size-4 text-zinc-400" />
            <span className="h-6 w-px bg-zinc-300 dark:bg-zinc-700" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function OfferCard({ code, text }: { code: string; text: string }) {
  return (
    <Link href="/shop" className="mx-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-rose-50 via-orange-50 to-sky-50 px-4 py-3 ring-1 ring-zinc-200/70 md:mx-0 dark:from-rose-950/40 dark:via-orange-950/30 dark:to-sky-950/40 dark:ring-zinc-800">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-rose-600 text-white"><Percent className="size-5" /></span>
      <span className="h-8 w-px bg-zinc-300 dark:bg-zinc-700" />
      <span className="min-w-0 flex-1"><span className="block font-semibold">{text}</span><span className="text-xs text-zinc-500">Use code <b className="font-mono text-zinc-800 dark:text-zinc-200">{code}</b> · <Truck className="inline size-3" /> Free delivery over ₹{DELIVERY.standard.freeAbove}</span></span>
      <ChevronRight className="size-5 shrink-0 text-zinc-400" />
    </Link>
  );
}

export type BrandCard = { brand: string; image: string; off: number; count: number; from: number };

export function FeaturedBrands({ brands }: { brands: BrandCard[] }) {
  const { money } = useApp();
  return (
    <section className="mt-6 bg-gradient-to-b from-amber-100/70 via-amber-50/40 to-transparent pb-2 pt-5 md:mt-14 md:rounded-3xl dark:from-amber-950/40 dark:via-amber-950/10">
      <div className="relative mx-auto flex max-w-xl items-center justify-center px-6">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-500" />
        <h2 className="mx-3 rounded-xl border-2 border-amber-500 bg-gradient-to-b from-amber-50 to-amber-100 px-5 py-1.5 font-display text-xl font-bold uppercase tracking-wide text-[#8a1c1c] shadow-sm sm:text-2xl dark:from-amber-900/60 dark:to-amber-950 dark:text-amber-200">Featured brands</h2>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-500" />
      </div>
      <div className="no-scrollbar mt-5 flex snap-x gap-3 overflow-x-auto px-4 pb-3 md:grid md:grid-cols-5 md:overflow-visible">
        {brands.map((b) => (
          <Link key={b.brand} href={`/shop?brand=${encodeURIComponent(b.brand)}`} className="group w-[42vw] shrink-0 snap-start overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-amber-200/70 sm:w-[28vw] md:w-auto dark:bg-zinc-900 dark:ring-amber-900/40">
            <div className="aspect-[4/5] overflow-hidden"><div className="h-full transition duration-500 group-hover:scale-105"><ProductImage src={b.image} alt={b.brand} /></div></div>
            <div className="p-3 text-center">
              <p className="font-display text-base font-bold uppercase tracking-wide">{b.brand}</p>
              <p className="text-sm font-bold text-brand-600">{b.off > 0 ? `Up to ${b.off}% off` : `From ${money(b.from)}`}</p>
              <p className="text-[11px] text-zinc-500">{b.count} styles</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
