"use client";
import { useState } from "react";
import { Check, Tag, X } from "lucide-react";
import type { Totals } from "@/lib/types";
import type { Quote } from "./useQuote";
import { useApp } from "./Providers";

export function PriceSummary({ totals, loading, children }: { totals?: Totals; loading?: boolean; children?: React.ReactNode }) {
  const { money } = useApp();
  if (!totals) return <div className="skeleton h-56" />;
  const rows: [string, number, string?][] = [
    ["Total MRP", totals.mrp],
    ["Discount on MRP", -totals.discount, "text-emerald-600"],
    ...(totals.coupon ? [["Coupon discount", -totals.coupon, "text-emerald-600"] as [string, number, string]] : []),
    ...(totals.member ? [["Plus member discount 👑", -totals.member, "text-violet-600"] as [string, number, string]] : []),
    ...(totals.coins ? [["Coins redeemed 🪙", -totals.coins, "text-amber-600"] as [string, number, string]] : []),
    ["Delivery", totals.delivery],
    ["GST (5%)", totals.tax],
  ];
  return (
    <div className={`card space-y-3 p-5 transition ${loading ? "opacity-60" : ""}`}>
      <p className="label">Price details</p>
      {rows.map(([l, v, cls]) => (
        <div key={l} className="flex justify-between text-sm"><span className="text-zinc-600 dark:text-zinc-400">{l}</span><span className={cls}>{l === "Delivery" && v === 0 ? <span className="text-emerald-600">FREE</span> : `${v < 0 ? "−" : ""}${money(Math.abs(v))}`}</span></div>
      ))}
      <div className="flex justify-between border-t border-zinc-200 pt-3 text-base font-bold dark:border-zinc-800"><span>Total</span><span>{money(totals.total)}</span></div>
      {totals.discount + totals.coupon + (totals.member ?? 0) + (totals.coins ?? 0) > 0 && <p className="rounded-xl bg-emerald-50 p-2.5 text-center text-sm font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">You save {money(totals.discount + totals.coupon + (totals.member ?? 0) + (totals.coins ?? 0))} on this order 🎉</p>}
      {children}
    </div>
  );
}

export function CouponBox({ q, code, setCode }: { q: Quote | null; code: string; setCode: (c: string) => void }) {
  const { money } = useApp();
  const [input, setInput] = useState(code);
  const [showAll, setShowAll] = useState(false);
  const applied = q?.coupon;
  return (
    <div className="card p-5">
      <p className="label flex items-center gap-1.5"><Tag className="size-3.5" />Coupons</p>
      {applied ? (
        <div className="flex items-center justify-between rounded-xl border border-dashed border-emerald-500 bg-emerald-50 p-3 dark:bg-emerald-900/20">
          <span className="flex items-center gap-2 text-sm"><Check className="size-4 text-emerald-600" /><b>{applied.code}</b> applied · −{money(applied.amount)}</span>
          <button onClick={() => { setCode(""); setInput(""); }} aria-label="Remove coupon" className="text-zinc-500 hover:text-red-500"><X className="size-4" /></button>
        </div>
      ) : (
        <>
          <form onSubmit={(e) => { e.preventDefault(); setCode(input.trim().toUpperCase()); }} className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} placeholder="Enter coupon code" className="input uppercase" aria-label="Coupon code" />
            <button className="btn-primary px-4" disabled={!input.trim()}>Apply</button>
          </form>
          {code && q?.couponError && <p className="mt-2 text-sm text-red-600" role="alert">{q.couponError}</p>}
        </>
      )}
      {q && q.coupons.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowAll(!showAll)} className="text-sm font-semibold text-brand-600">{showAll ? "Hide" : "View"} available coupons ({q.coupons.length})</button>
          {showAll && (
            <ul className="mt-2 space-y-2">
              {q.coupons.map((c) => (
                <li key={c.code} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
                  <div><p className="font-mono text-sm font-bold">{c.code}{c.personal && <span className="badge ml-2 bg-violet-100 font-sans text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">Just for you</span>}</p><p className="text-xs text-zinc-500">{c.description}</p></div>
                  <button onClick={() => { setInput(c.code); setCode(c.code); }} className="text-sm font-semibold text-brand-600">Apply</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** "Use my coins" toggle shown at checkout when the shopper has a redeemable balance. */
export function CoinsToggle({ q, on, setOn }: { q: Quote | null; on: boolean; setOn: (v: boolean) => void }) {
  const { money, brand } = useApp();
  const c = q?.coins;
  if (!c || c.balance <= 0) return null;
  return (
    <label className={`card flex cursor-pointer items-center gap-3 p-4 transition ${on ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20" : ""} ${c.usable ? "" : "opacity-60"}`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-lg">🪙</span>
      <span className="flex-1 text-sm">
        <span className="block font-semibold">Use {c.usable} {brand.coinName}{c.usable > 0 && <> · save {money(c.usable)}</>}</span>
        <span className="text-xs text-zinc-500">Balance {c.balance} · up to {c.maxPct}% of your order</span>
      </span>
      <input type="checkbox" checked={on && c.usable > 0} disabled={!c.usable} onChange={(e) => setOn(e.target.checked)} className="size-5 accent-amber-500" aria-label="Use coins" />
    </label>
  );
}
