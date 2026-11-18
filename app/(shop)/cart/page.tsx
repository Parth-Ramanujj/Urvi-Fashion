"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Heart, Minus, Plus, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import { CouponBox, PriceSummary } from "@/components/PriceSummary";
import ProductImage from "@/components/ProductImage";
import { useApp } from "@/components/Providers";
import { useQuote } from "@/components/useQuote";
import { Empty, Money } from "@/components/ui";

export default function CartPage() {
  const { cart, setQty, removeFromCart, toggleWish, wishlist, toast, t } = useApp();
  const [coupon, setCoupon] = useState("");
  useEffect(() => { try { setCoupon(sessionStorage.getItem("th_coupon") ?? ""); } catch {} }, []);
  useEffect(() => { try { sessionStorage.setItem("th_coupon", coupon); } catch {} }, [coupon]);
  const { q, loading, line } = useQuote(coupon, "standard");

  if (cart.length === 0) return <div className="mx-auto max-w-7xl px-4"><Empty icon={<ShoppingBag className="size-7" />} title={t("cart.empty")}><p className="text-sm text-zinc-500">Looks like you haven&apos;t added anything yet.</p><Link href="/shop" className="btn-primary">Start shopping</Link></Empty></div>;
  const blocked = q?.lines.some((l) => !l.available);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6">
      <h1 className="font-display text-3xl font-bold">{t("cart.title")} <span className="text-lg font-normal text-zinc-400">({cart.length} items)</span></h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <ul className="space-y-3">
          {cart.map((l) => {
            const s = line(l.sku);
            return (
              <li key={l.sku} className="card flex animate-fade-in gap-4 p-3 sm:p-4">
                <Link href={`/product/${l.slug}?color=${encodeURIComponent(l.color)}`} className="h-32 w-24 shrink-0 overflow-hidden rounded-xl sm:h-36 sm:w-28"><ProductImage src={l.image} alt={l.name} /></Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0"><p className="text-xs font-semibold uppercase text-zinc-500">{l.brand}</p><Link href={`/product/${l.slug}`} className="line-clamp-1 font-medium hover:underline">{l.name}</Link><p className="text-sm text-zinc-500">{l.color} · Size {l.size}</p></div>
                    <button onClick={() => removeFromCart(l.sku)} className="self-start p-1 text-zinc-400 hover:text-red-500" aria-label={`Remove ${l.name}`}><Trash2 className="size-4" /></button>
                  </div>
                  {s && !s.available && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600"><AlertTriangle className="size-3.5" />{s.stock === 0 ? "Out of stock — remove to continue" : `Only ${s.stock} left — reduce quantity`}</p>}
                  {s && s.available && s.stock <= 3 && <p className="mt-1 text-xs font-medium text-brand-600">Hurry, only {s.stock} left</p>}
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
                    <div className="flex items-center rounded-full border border-zinc-300 dark:border-zinc-700">
                      <button onClick={() => (l.qty > 1 ? setQty(l.sku, l.qty - 1) : removeFromCart(l.sku))} className="p-2" aria-label="Decrease quantity"><Minus className="size-3.5" /></button>
                      <span className="w-6 text-center text-sm tabular-nums">{l.qty}</span>
                      <button onClick={() => setQty(l.sku, l.qty + 1)} disabled={l.qty >= Math.min(10, s?.stock ?? 10)} className="p-2 disabled:opacity-30" aria-label="Increase quantity"><Plus className="size-3.5" /></button>
                    </div>
                    <div className="text-right">
                      <Money v={(s?.price ?? l.price) * l.qty} className="font-semibold" />
                      {(s?.mrp ?? l.mrp) > (s?.price ?? l.price) && <Money v={(s?.mrp ?? l.mrp) * l.qty} className="ml-2 text-xs text-zinc-400 line-through" />}
                    </div>
                  </div>
                  {!wishlist.includes(l.productId) && <button onClick={() => { toggleWish(l.productId); removeFromCart(l.sku); toast("Moved to wishlist"); }} className="mt-2 flex items-center gap-1 self-start text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><Heart className="size-3.5" />Move to wishlist</button>}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <CouponBox q={q} code={coupon} setCode={setCoupon} />
          <PriceSummary totals={q?.totals} loading={loading}>
            <Link href={blocked ? "#" : "/checkout"} aria-disabled={blocked} className={`btn-brand w-full py-3.5 text-base ${blocked ? "pointer-events-none opacity-50" : ""}`}>Proceed to checkout</Link>
            <p className="flex items-center justify-center gap-1.5 text-xs text-zinc-500"><ShieldCheck className="size-3.5" />Safe & secure payments · Easy returns</p>
          </PriceSummary>
        </div>
      </div>
    </div>
  );
}
