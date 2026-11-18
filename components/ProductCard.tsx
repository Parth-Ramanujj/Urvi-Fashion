"use client";
import Link from "next/link";
import { useState } from "react";
import { Heart, Zap } from "lucide-react";
import ProductImage from "./ProductImage";
import { useApp } from "./Providers";
import { Money } from "./ui";
import type { CardData } from "@/lib/catalog";

export default function ProductCard({ p, priority }: { p: CardData; priority?: boolean }) {
  const { wishlist, toggleWish, toast } = useApp();
  const [ci, setCi] = useState(0);
  const c = p.colors[ci];
  const wished = wishlist.includes(p.id);
  return (
    <div className={`group relative ${priority ? "" : "animate-fade-in"}`}>
      <Link href={`/product/${p.slug}?color=${encodeURIComponent(c.name)}`} className="block overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
        <div className="relative aspect-[4/5]">
          <ProductImage src={c.image} alt={p.name} className="transition duration-500 group-hover:opacity-0" />
          <div className="absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100"><ProductImage src={c.alt} alt={`${p.name} alternate view`} /></div>
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {p.flash && <span className="badge bg-brand-500 text-white"><Zap className="mr-0.5 size-3" />Flash</span>}
            {p.isNew && <span className="badge bg-white/90 text-zinc-900">New</span>}
            {p.stock === 0 && <span className="badge bg-zinc-900 text-white">Sold out</span>}
          </div>
        </div>
      </Link>
      <button
        onClick={() => { toggleWish(p.id); toast(wished ? "Removed from wishlist" : "Saved to wishlist"); }}
        className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:scale-110 dark:bg-zinc-900/80"
        aria-label={wished ? "Remove from wishlist" : "Add to wishlist"} aria-pressed={wished}
      >
        <Heart className={`size-[18px] transition ${wished ? "fill-brand-500 text-brand-500" : ""}`} />
      </button>
      <div className="mt-2.5 space-y-0.5 px-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-500">{p.brand}</p>
          <span className="shrink-0 text-xs text-zinc-500">★ {p.rating.toFixed(1)}</span>
        </div>
        <Link href={`/product/${p.slug}`} className="line-clamp-1 text-sm font-medium hover:underline">{p.name}</Link>
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <Money v={p.price} className="font-semibold" />
          {p.off > 0 && <><Money v={p.mrp} className="text-xs text-zinc-400 line-through" /><span className="text-xs font-semibold text-emerald-600">{p.off}% off</span></>}
        </div>
        {p.colors.length > 1 && (
          <div className="flex gap-1.5 pt-1">
            {p.colors.map((x, i) => (
              <button key={x.name} onMouseEnter={() => setCi(i)} onClick={() => setCi(i)} aria-label={x.name} title={x.name}
                className={`size-4 rounded-full border ring-offset-1 ring-offset-white transition dark:ring-offset-zinc-950 ${i === ci ? "ring-2 ring-zinc-900 dark:ring-white" : "border-black/10"}`} style={{ background: x.hex }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProductRail({ items }: { items: CardData[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 lg:grid-cols-5">
      {items.map((p) => <div key={p.id} className="w-[44vw] shrink-0 snap-start sm:w-[30vw] md:w-auto"><ProductCard p={p} /></div>)}
    </div>
  );
}
