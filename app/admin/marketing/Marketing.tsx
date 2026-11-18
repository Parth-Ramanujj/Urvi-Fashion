"use client";
import { useState } from "react";
import { Bell, Megaphone, Search, Send, Tag, Trash2, Zap } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import { useApp } from "@/components/Providers";
import { Countdown } from "@/components/ui";
import { createFlashSale, deleteCoupon, endFlashSale, saveCoupon, sendCampaign, setCouponActive } from "@/lib/admin-actions";
import type { Campaign, Coupon } from "@/lib/types";
import { useAct } from "../_ui";

const local = (ms: number) => new Date(ms - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export function CouponManager({ coupons, now }: { coupons: Coupon[]; now: number }) {
  const { pending, act } = useAct();
  const { money } = useApp();
  const blank = { code: "", description: "", type: "percent" as "percent" | "flat", value: "", minOrder: "", maxDiscount: "", expiresAt: "" };
  const [f, setF] = useState(blank);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: k === "code" ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") : e.target.value });
  return (
    <section className="card p-5" aria-labelledby="cp-h">
      <h2 id="cp-h" className="flex items-center gap-2 font-semibold"><Tag className="size-4" />Discount coupons</h2>
      <form onSubmit={(e) => { e.preventDefault(); act(() => saveCoupon({ ...f, value: Number(f.value), minOrder: Number(f.minOrder) || 0, maxDiscount: Number(f.maxDiscount) || undefined, expiresAt: f.expiresAt ? new Date(f.expiresAt).getTime() : undefined }), "Coupon created", () => setF(blank)); }}
        className="mt-4 grid gap-3 rounded-xl bg-zinc-50 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:bg-zinc-800/50">
        <label><span className="label">Code</span><input required minLength={4} maxLength={20} value={f.code} onChange={set("code")} placeholder="SUMMER25" className="input font-mono" /></label>
        <label><span className="label">Type</span><select value={f.type} onChange={set("type")} className="input"><option value="percent">Percent off</option><option value="flat">Flat ₹ off</option></select></label>
        <label><span className="label">{f.type === "percent" ? "Percent" : "Amount (₹)"}</span><input required type="number" min={1} max={f.type === "percent" ? 90 : undefined} value={f.value} onChange={set("value")} className="input" /></label>
        <label><span className="label">Min. order (₹)</span><input type="number" min={0} value={f.minOrder} onChange={set("minOrder")} className="input" /></label>
        {f.type === "percent" && <label><span className="label">Max discount (₹)</span><input type="number" min={1} value={f.maxDiscount} onChange={set("maxDiscount")} placeholder="No cap" className="input" /></label>}
        <label><span className="label">Expires</span><input type="datetime-local" value={f.expiresAt} onChange={set("expiresAt")} className="input" /></label>
        <label className="sm:col-span-2"><span className="label">Description shown to shoppers</span><input value={f.description} onChange={set("description")} maxLength={140} placeholder="Auto-generated if empty" className="input" /></label>
        <button disabled={pending} className="btn-brand self-end lg:col-start-4">Create coupon</button>
      </form>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500"><tr><th className="py-2 font-semibold">Code</th><th className="font-semibold">Offer</th><th className="font-semibold">Min order</th><th className="font-semibold">Expires</th><th className="font-semibold">Used</th><th className="text-right font-semibold">Active</th></tr></thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {coupons.map((c) => {
              const expired = !!c.expiresAt && c.expiresAt < now;
              return (
                <tr key={c.code} className={!c.active || expired ? "opacity-60" : ""}>
                  <td className="py-2.5 font-mono font-semibold">{c.code}</td>
                  <td>{c.type === "percent" ? `${c.value}%${c.maxDiscount ? ` (max ${money(c.maxDiscount)})` : ""}` : money(c.value)}<div className="text-xs text-zinc-500">{c.description}</div></td>
                  <td>{c.minOrder ? money(c.minOrder) : "—"}</td>
                  <td className={expired ? "text-red-600" : ""}>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-IN") : "Never"}{expired && " (expired)"}</td>
                  <td className="tabular-nums">{c.used}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button role="switch" aria-checked={c.active} aria-label={`${c.code} active`} disabled={pending} onClick={() => act(() => setCouponActive(c.code, !c.active))} className={`relative h-6 w-11 rounded-full transition ${c.active ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`}><span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${c.active ? "left-[22px]" : "left-0.5"}`} /></button>
                      <button aria-label={`Delete ${c.code}`} disabled={pending} onClick={() => confirm(`Delete coupon ${c.code}?`) && act(() => deleteCoupon(c.code), "Coupon deleted")} className="p-1.5 text-zinc-400 hover:text-red-500"><Trash2 className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type P = { id: string; name: string; brand: string; image: string; price: number; flash: { percent: number; endsAt: number } | null };
export function FlashSaleManager({ products }: { products: P[] }) {
  const { pending, act } = useAct();
  const { money } = useApp();
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [pct, setPct] = useState("25");
  const [ends, setEnds] = useState(() => local(Date.now() + 2 * 86_400_000));
  const live = products.filter((p) => p.flash);
  const list = products.filter((p) => !p.flash && `${p.name} ${p.brand}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="card p-5" aria-labelledby="fs-h">
      <h2 id="fs-h" className="flex items-center gap-2 font-semibold"><Zap className="size-4 text-brand-500" />Flash sales</h2>
      {live.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between"><p className="label mb-0">Live now · {live.length} products</p><button disabled={pending} onClick={() => confirm("End all flash sales now?") && act(() => endFlashSale(), "All flash sales ended")} className="text-xs font-semibold text-red-600">End all</button></div>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-2 dark:border-brand-900 dark:bg-brand-950/30">
                <div className="h-12 w-10 shrink-0 overflow-hidden rounded-md"><ProductImage src={p.image} alt={p.name} /></div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.name}</p><p className="text-xs text-brand-700 dark:text-brand-300">−{p.flash!.percent}% · {money(Math.round(p.price * (1 - p.flash!.percent / 100)))}</p><Countdown endsAt={p.flash!.endsAt} className="mt-1 scale-90 origin-left" /></div>
                <button disabled={pending} onClick={() => act(() => endFlashSale(p.id), "Flash sale ended")} className="text-xs font-semibold text-red-600">End</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); act(() => createFlashSale(picked, Number(pct), new Date(ends).getTime()), `Flash sale live on ${picked.length} products`, () => setPicked([])); }} className="mt-5 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label><span className="label">Extra discount %</span><input type="number" min={5} max={80} required value={pct} onChange={(e) => setPct(e.target.value)} className="input w-28" /></label>
          <label><span className="label">Ends at</span><input type="datetime-local" required suppressHydrationWarning value={ends} onChange={(e) => setEnds(e.target.value)} className="input" /></label>
          <label className="relative min-w-48 flex-1"><span className="label">Find products</span><Search className="absolute bottom-3 left-3 size-4 text-zinc-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="input pl-9" /></label>
          <button disabled={pending || !picked.length} className="btn-brand"><Zap className="size-4" />Start sale ({picked.length})</button>
        </div>
        <ul className="grid max-h-72 gap-1 overflow-y-auto rounded-xl border border-zinc-200 p-2 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-800">
          {list.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <input type="checkbox" checked={picked.includes(p.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, p.id] : picked.filter((x) => x !== p.id))} className="size-4 accent-brand-500" />
                <div className="h-10 w-8 shrink-0 overflow-hidden rounded-md"><ProductImage src={p.image} alt="" /></div>
                <span className="min-w-0 text-sm"><span className="block truncate">{p.name}</span><span className="text-xs text-zinc-500">{p.brand} · {money(p.price)}</span></span>
              </label>
            </li>
          ))}
        </ul>
      </form>
    </section>
  );
}

export function CampaignComposer({ campaigns }: { campaigns: Campaign[] }) {
  const { toast, brand } = useApp();
  const { pending, act } = useAct();
  const blank = { title: "", body: "", href: "/shop", audience: "all" as "all" | "customers" };
  const [f, setF] = useState(blank);
  return (
    <section className="card p-5" aria-labelledby="pn-h">
      <h2 id="pn-h" className="flex items-center gap-2 font-semibold"><Megaphone className="size-4" />Push notification campaigns</h2>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <form onSubmit={(e) => { e.preventDefault(); act(() => sendCampaign(f), undefined, (r) => { toast(`Sent to ${r.reach} users`); setF(blank); }); }} className="space-y-3">
          <label className="block"><span className="label">Title</span><input required maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Weekend drop is live 🔥" className="input" /></label>
          <label className="block"><span className="label">Message</span><textarea required maxLength={240} rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="New winter jackets just landed — extra 10% off till Sunday." className="input" /><span className="text-xs text-zinc-500">{f.body.length}/240</span></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="label">Link (path)</span><input value={f.href} onChange={(e) => setF({ ...f, href: e.target.value })} placeholder="/shop?sale=flash" className="input" /></label>
            <label><span className="label">Audience</span><select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value as "all" | "customers" })} className="input"><option value="all">Everyone</option><option value="customers">Customers only</option></select></label>
          </div>
          <button disabled={pending} className="btn-brand"><Send className="size-4" />Send campaign</button>
        </form>
        <div>
          <p className="label">Preview</p>
          <div className="rounded-3xl bg-gradient-to-br from-zinc-700 to-zinc-900 p-5">
            <div className="flex gap-3 rounded-2xl bg-white/95 p-3 shadow-lg dark:bg-zinc-800/95">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-500 text-white"><Bell className="size-4" /></span>
              <div className="min-w-0"><p className="text-xs text-zinc-500">{brand.shortName} · now</p><p className="truncate text-sm font-semibold">{f.title || "Notification title"}</p><p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">{f.body || "Your message will appear here."}</p></div>
            </div>
          </div>
          <p className="label mt-5">History</p>
          <ul className="max-h-56 divide-y divide-zinc-100 overflow-y-auto text-sm dark:divide-zinc-800">
            {campaigns.length === 0 && <li className="py-3 text-zinc-500">No campaigns sent yet.</li>}
            {campaigns.map((c) => <li key={c.id} className="py-2.5"><p className="font-medium">{c.title}</p><p className="text-xs text-zinc-500">{new Date(c.sentAt).toLocaleString("en-IN")} · {c.audience} · {c.reach} reached</p></li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
