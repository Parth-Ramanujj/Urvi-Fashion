"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, ShoppingBag, X } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import { useApp } from "@/components/Providers";
import { Empty, Money } from "@/components/ui";
import { productsByIds } from "@/lib/actions";

type Item = Awaited<ReturnType<typeof productsByIds>>[number];

export default function WishlistPage() {
  const { wishlist, toggleWish, addToCart, toast, setCartOpen } = useApp();
  const [items, setItems] = useState<Item[] | null>(null);
  const [picking, setPicking] = useState<Record<string, string>>({});
  const key = wishlist.join(",");
  useEffect(() => { productsByIds(wishlist).then((r) => setItems(wishlist.map((id) => r.find((p) => p.id === id)).filter(Boolean) as Item[])); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (p: Item) => {
    const color = p.colors[0];
    const size = p.sizes.length === 1 ? p.sizes[0] : picking[p.id];
    if (!size) return toast("Pick a size first", "err");
    const v = p.variants.find((x) => x.color === color.name && x.size === size);
    if (!v || v.stock === 0) return toast("That size is out of stock", "err");
    addToCart({ productId: p.id, slug: p.slug, name: p.name, brand: p.brand, image: color.image, color: color.name, size: v.size, sku: v.sku, qty: 1, price: p.price, mrp: p.mrp });
    toggleWish(p.id);
    toast("Moved to bag"); setCartOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6">
      <h1 className="font-display text-3xl font-bold">Wishlist <span className="text-lg font-normal text-zinc-400">({wishlist.length})</span></h1>
      {items === null ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: Math.min(5, wishlist.length || 5) }, (_, i) => <div key={i} className="skeleton aspect-[4/5]" />)}</div>
      ) : items.length === 0 ? (
        <Empty icon={<Heart className="size-7" />} title="Your wishlist is empty"><p className="text-sm text-zinc-500">Tap the heart on any product to save it here.</p><Link href="/shop" className="btn-primary">Explore styles</Link></Empty>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((p) => (
            <div key={p.id} className="relative animate-fade-in">
              <Link href={`/product/${p.slug}`} className="block aspect-[4/5] overflow-hidden rounded-2xl"><ProductImage src={p.image} alt={p.name} /></Link>
              <button onClick={() => toggleWish(p.id)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/90 text-zinc-700 shadow dark:bg-zinc-900/80 dark:text-zinc-200" aria-label="Remove from wishlist"><X className="size-4" /></button>
              <p className="mt-2 text-xs font-semibold uppercase text-zinc-500">{p.brand}</p>
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="text-sm"><Money v={p.price} className="font-semibold" />{p.mrp > p.price && <Money v={p.mrp} className="ml-2 text-xs text-zinc-400 line-through" />}</p>
              {p.sizes.length > 1 && (
                <select value={picking[p.id] ?? ""} onChange={(e) => setPicking({ ...picking, [p.id]: e.target.value })} className="input mt-2 py-1.5 text-xs" aria-label={`Size for ${p.name}`}>
                  <option value="">Select size</option>
                  {p.sizes.map((s) => { const st = p.variants.find((v) => v.color === p.colors[0].name && v.size === s)?.stock ?? 0; return <option key={s} value={s} disabled={!st}>{s}{!st ? " — sold out" : ""}</option>; })}
                </select>
              )}
              <button onClick={() => move(p)} className="btn-primary mt-2 w-full py-2 text-xs"><ShoppingBag className="size-3.5" />Move to bag</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
