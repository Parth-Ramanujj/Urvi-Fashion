"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { DELIVERY } from "@/lib/pricing";
import ProductImage from "./ProductImage";
import { useApp } from "./Providers";
import { Empty, Money } from "./ui";

export default function CartDrawer() {
  const { cart, cartOpen, setCartOpen, setQty, removeFromCart, t, money } = useApp();
  useEffect(() => {
    if (!cartOpen) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setCartOpen(false);
    document.body.style.overflow = "hidden"; addEventListener("keydown", k);
    return () => { document.body.style.overflow = ""; removeEventListener("keydown", k); };
  }, [cartOpen, setCartOpen]);
  if (!cartOpen) return null;
  const sub = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const toFree = DELIVERY.standard.freeAbove - sub;
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={t("cart.title")}>
      <div className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md animate-slide-in-right flex-col bg-white shadow-2xl dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">{t("cart.title")} <span className="text-zinc-400">({cart.reduce((s, l) => s + l.qty, 0)})</span></h2>
          <button onClick={() => setCartOpen(false)} aria-label="Close bag" className="rounded-full p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="size-5" /></button>
        </div>
        {cart.length === 0 ? (
          <Empty icon={<ShoppingBag className="size-7" />} title={t("cart.empty")}><button onClick={() => setCartOpen(false)} className="btn-primary">Start shopping</button></Empty>
        ) : (
          <>
            <div className="px-5 pt-4">
              <p className="text-xs text-zinc-500">{toFree > 0 ? <>Add <b className="text-zinc-900 dark:text-white">{money(toFree)}</b> more for free delivery</> : <span className="font-semibold text-emerald-600">🎉 You&apos;ve unlocked free delivery</span>}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, (sub / DELIVERY.standard.freeAbove) * 100)}%` }} /></div>
            </div>
            <ul className="flex-1 divide-y divide-zinc-100 overflow-y-auto px-5 dark:divide-zinc-800">
              {cart.map((l) => (
                <li key={l.sku} className="flex gap-3 py-4">
                  <Link href={`/product/${l.slug}`} onClick={() => setCartOpen(false)} className="h-24 w-20 shrink-0 overflow-hidden rounded-xl"><ProductImage src={l.image} alt={l.name} /></Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="text-xs font-semibold uppercase text-zinc-500">{l.brand}</p>
                    <p className="truncate text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-zinc-500">{l.color} · {l.size}</p>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center rounded-full border border-zinc-300 dark:border-zinc-700">
                        <button onClick={() => (l.qty > 1 ? setQty(l.sku, l.qty - 1) : removeFromCart(l.sku))} className="p-1.5" aria-label="Decrease quantity"><Minus className="size-3.5" /></button>
                        <span className="w-6 text-center text-sm tabular-nums">{l.qty}</span>
                        <button onClick={() => setQty(l.sku, l.qty + 1)} className="p-1.5" aria-label="Increase quantity" disabled={l.qty >= 10}><Plus className="size-3.5" /></button>
                      </div>
                      <Money v={l.price * l.qty} className="text-sm font-semibold" />
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(l.sku)} className="self-start p-1 text-zinc-400 hover:text-red-500" aria-label={`Remove ${l.name}`}><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
            <div className="space-y-3 border-t border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex justify-between text-sm"><span className="text-zinc-500">Subtotal</span><Money v={sub} className="font-semibold" /></div>
              <p className="text-xs text-zinc-500">Coupons, delivery & taxes calculated in your bag.</p>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/cart" onClick={() => setCartOpen(false)} className="btn-ghost">{t("cart.view")}</Link>
                <Link href="/checkout" onClick={() => setCartOpen(false)} className="btn-brand">{t("cart.checkout")}</Link>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
