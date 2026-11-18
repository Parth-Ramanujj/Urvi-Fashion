"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BadgeCheck, Bell, ChevronDown, Heart, Minus, Plus, Ruler, Share2, ShoppingBag, Truck, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { joinWaitlist } from "@/lib/actions";
import { DELIVERY, RETURN_WINDOW_DAYS } from "@/lib/pricing";
import { chartFor, recommendSize } from "@/lib/sizes";
import type { Measurements, Product } from "@/lib/types";
import { useApp } from "../Providers";
import { Countdown, Modal, Money, Stars } from "../ui";
import Gallery from "./Gallery";

type P = Product & { off: number };

export default function ProductView({ p, initialColor, measurements }: { p: P; initialColor: string; measurements: Measurements | null }) {
  const { addToCart, setCartOpen, wishlist, toggleWish, toast, t, user } = useApp();
  const router = useRouter();
  const [alerted, setAlerted] = useState<string[]>([]);
  const [color, setColor] = useState(initialColor);
  const [size, setSize] = useState<string | null>(p.sizes.length === 1 ? p.sizes[0] : null);
  const [qty, setQty] = useState(1);
  const [guide, setGuide] = useState(false);
  const [shake, setShake] = useState(false);
  const c = p.colors.find((x) => x.name === color) ?? p.colors[0];
  const stockOf = (sz: string) => p.variants.find((v) => v.color === c.name && v.size === sz)?.stock ?? 0;
  const variant = size ? p.variants.find((v) => v.color === c.name && v.size === size) : undefined;
  const stock = size ? stockOf(size) : p.variants.filter((v) => v.color === c.name).reduce((s, v) => s + v.stock, 0);
  const rec = useMemo(() => (measurements ? recommendSize(p.kind, measurements, p.category === "kids") : null), [measurements, p.kind, p.category]);
  const wished = wishlist.includes(p.id);
  const flash = p.flashSale && p.flashSale.endsAt > Date.now();
  const price = variant?.price ? Math.round(variant.price * (flash ? 1 - p.flashSale!.percent / 100 : 1)) : p.price;

  const pickColor = (name: string) => {
    setColor(name);
    const u = new URL(location.href); u.searchParams.set("color", name); history.replaceState(null, "", u);
    if (size && !p.variants.find((v) => v.color === name && v.size === size)?.stock) setSize(null);
  };

  const add = (buyNow = false) => {
    if (!size) { setShake(true); setTimeout(() => setShake(false), 500); toast(t("pdp.selectSize"), "err"); return; }
    if (!variant || variant.stock < qty) return toast("Not enough stock for that size", "err");
    addToCart({ productId: p.id, slug: p.slug, name: p.name, brand: p.brand, image: c.images[0], color: c.name, size: variant.size, sku: variant.sku, qty, price, mrp: Math.max(p.mrp, price) });
    if (buyNow) location.href = "/checkout"; else { toast(`Added to bag · ${c.name}, ${size}`); setCartOpen(true); }
  };

  const notify = async () => {
    if (!user) return router.push(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    const r = await joinWaitlist(p.id, c.name, size as Product["sizes"][number]);
    if (!r.ok) return toast(r.error, "err");
    setAlerted((a) => [...a, `${c.name}-${size}`]);
    toast("Done! We'll notify you as soon as it's restocked 🔔");
  };

  const share = async () => {
    try { if (navigator.share) await navigator.share({ title: p.name, url: location.href }); else { await navigator.clipboard.writeText(location.href); toast("Link copied"); } } catch { /* user cancelled */ }
  };

  return (
    <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
      <div className="md:sticky md:top-24 md:self-start"><Gallery images={c.images} video={p.video} name={p.name} /></div>

      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href={`/shop?brand=${encodeURIComponent(p.brand)}`} className="text-sm font-semibold uppercase tracking-wider text-zinc-500 hover:underline">{p.brand}</Link>
            <h1 className="mt-1 font-display text-3xl font-bold leading-tight md:text-4xl">{p.name}</h1>
          </div>
          <button onClick={share} className="rounded-full p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Share"><Share2 className="size-5" /></button>
        </div>
        <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm"><Stars value={p.rating} /><b>{p.rating.toFixed(1)}</b><span className="text-zinc-500 underline-offset-2 hover:underline">{p.ratingCount.toLocaleString()} ratings</span></a>

        <div className="mt-5 flex flex-wrap items-baseline gap-3">
          <Money v={price} className="text-3xl font-bold" />
          {p.mrp > price && <><Money v={p.mrp} className="text-lg text-zinc-400 line-through" /><span className="badge bg-emerald-100 text-sm text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">{Math.round(((p.mrp - price) / p.mrp) * 100)}% off</span></>}
        </div>
        <p className="mt-1 text-xs text-zinc-500">MRP inclusive of all taxes</p>
        {flash && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-50 p-3 dark:bg-brand-900/30">
            <span className="flex items-center gap-1 text-sm font-semibold text-brand-700 dark:text-brand-300"><Zap className="size-4" />Flash sale · extra {p.flashSale!.percent}% off ends in</span>
            <Countdown endsAt={p.flashSale!.endsAt} />
          </div>
        )}

        <div className="mt-7">
          <p className="label">Colour: <span className="normal-case text-zinc-900 dark:text-white">{c.name}</span></p>
          <div className="flex flex-wrap gap-2.5">
            {p.colors.map((x) => (
              <button key={x.name} onClick={() => pickColor(x.name)} title={x.name} aria-label={x.name} aria-pressed={x.name === c.name}
                className={`size-11 rounded-full border border-black/10 ring-offset-2 transition hover:scale-105 dark:ring-offset-zinc-950 ${x.name === c.name ? "ring-2 ring-zinc-900 dark:ring-white" : ""}`} style={{ background: x.hex }} />
            ))}
          </div>
        </div>

        <div className="mt-7">
          <div className="flex items-center justify-between">
            <p className="label">{t("pdp.selectSize")}</p>
            {chartFor(p.kind, p.category === "kids") && <button onClick={() => setGuide(true)} className="flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"><Ruler className="size-4" />{t("pdp.sizeGuide")}</button>}
          </div>
          <div className={`flex flex-wrap gap-2 ${shake ? "animate-[pop_.4s]" : ""}`}>
            {p.sizes.map((sz) => {
              const st = stockOf(sz);
              return (
                <button key={sz} onClick={() => { setSize(sz); setQty(1); }} aria-pressed={size === sz} aria-label={st === 0 ? `${sz}, sold out` : sz}
                  className={`relative min-w-14 rounded-xl border px-4 py-3 text-sm font-semibold transition ${st === 0 && size !== sz ? "border-dashed text-zinc-400 line-through dark:text-zinc-600" : ""} ${size === sz ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900" : "border-zinc-300 hover:border-zinc-900 dark:border-zinc-700 dark:hover:border-white"}`}>
                  {sz}
                  {rec === sz && <span className="absolute -right-2 -top-2 rounded-full bg-emerald-500 px-1.5 text-[9px] font-bold text-white">FIT</span>}
                  {st > 0 && st <= 3 && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-500 px-1.5 text-[9px] font-bold text-white">{st} left</span>}
                </button>
              );
            })}
          </div>
          {rec && <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400"><BadgeCheck className="mr-1 inline size-4" />Size <b>{rec}</b> recommended from your measurement profile.</p>}
          {!rec && chartFor(p.kind) && <p className="mt-3 text-xs text-zinc-500"><Link href="/account" className="underline">Add your measurements</Link> to get personalised size picks.</p>}
        </div>

        <div className="mt-5 text-sm font-medium" aria-live="polite">
          {stock === 0 ? <span className="text-red-600">{t("pdp.outOfStock")}{size ? " in this size" : " in this colour"}</span>
            : stock <= 3 ? <span className="animate-pulse text-brand-600">🔥 {t("pdp.onlyLeft", { n: stock })}</span>
            : <span className="text-emerald-600">● {t("pdp.inStock")}</span>}
        </div>

        <div className="mt-5 flex gap-3">
          <div className="flex items-center rounded-full border border-zinc-300 dark:border-zinc-700">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-3" aria-label="Decrease quantity"><Minus className="size-4" /></button>
            <span className="w-6 text-center tabular-nums">{qty}</span>
            <button onClick={() => setQty((q) => Math.min(Math.min(10, variant?.stock ?? 10), q + 1))} className="p-3" aria-label="Increase quantity"><Plus className="size-4" /></button>
          </div>
          <button onClick={() => add()} disabled={stock === 0} className="btn-primary flex-1 py-3.5 text-base"><ShoppingBag className="size-5" />{t("pdp.addToBag")}</button>
          <button onClick={() => { toggleWish(p.id); toast(wished ? "Removed from wishlist" : "Saved to wishlist"); }} className="btn-ghost px-4" aria-label={t("pdp.wishlist")} aria-pressed={wished}>
            <Heart className={`size-5 ${wished ? "fill-brand-500 text-brand-500" : ""}`} />
          </button>
        </div>
        {size && stock === 0 ? (
          <button onClick={notify} disabled={alerted.includes(`${c.name}-${size}`)} className="btn mt-3 w-full border-2 border-dashed border-brand-500 py-3.5 text-base text-brand-600">
            <Bell className="size-5" />{alerted.includes(`${c.name}-${size}`) ? "We'll notify you when it's back" : `Notify me when ${size} is back`}
          </button>
        ) : <button onClick={() => add(true)} disabled={stock === 0} className="btn-brand mt-3 w-full py-3.5 text-base">Buy now</button>}

        <div className="mt-6 grid gap-2 rounded-2xl bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
          <p className="flex items-center gap-2"><Truck className="size-4" />Standard delivery in {DELIVERY.standard.days.join("–")} days · Express in {DELIVERY.express.days.join("–")} days</p>
          <p className="text-zinc-500">Free delivery over ₹{DELIVERY.standard.freeAbove} · {RETURN_WINDOW_DAYS}-day easy returns & exchanges · Cash on Delivery available</p>
        </div>

        <div className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {[["Description", <p key="d">{p.description}</p>], ["Details & care", <ul key="c" className="list-inside list-disc space-y-1">{p.details.map((d) => <li key={d}>{d}</li>)}</ul>], ["Fabric", <p key="f">{p.fabric}. Pre-washed to minimise shrinkage.</p>]].map(([title, body], i) => (
            <details key={title as string} open={i === 0} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">{title}<ChevronDown className="size-4 transition group-open:rotate-180" /></summary>
              <div className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</div>
            </details>
          ))}
        </div>
      </div>

      <Modal open={guide} onClose={() => setGuide(false)} title={t("pdp.sizeGuide")} wide>
        <SizeGuide p={p} rec={rec} onPick={(s) => { setSize(s); setGuide(false); }} available={(s) => stockOf(s) > 0} />
      </Modal>
    </div>
  );
}

function SizeGuide({ p, rec, onPick, available }: { p: P; rec: string | null; onPick: (s: string) => void; available: (s: string) => boolean }) {
  const chart = chartFor(p.kind, p.category === "kids")!;
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  const [mine, setMine] = useState("");
  const [fit, setFit] = useState<"slim" | "regular" | "relaxed">("regular");
  const conv = (v: number, col: string) => (col === "Age" ? v : unit === "in" ? (v / 2.54).toFixed(1) : v);
  const key = chart.key;
  const raw = Number(mine);
  const asCm = unit === "in" && key !== "height" ? raw * 2.54 : raw;
  const found = raw > 0 ? recommendSize(p.kind, { [key]: asCm, fit }, p.category === "kids") : rec;
  const keyLabel = key === "height" ? "Height (cm)" : `Your ${key === "chest" ? "chest / bust" : key} (${unit})`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">Body measurements. Tap a row to select that size.</p>
        <div className="flex rounded-full bg-zinc-100 p-1 dark:bg-zinc-800">
          {(["cm", "in"] as const).map((u) => <button key={u} onClick={() => setUnit(u)} className={`rounded-full px-3 py-1 text-xs font-semibold ${unit === u ? "bg-white shadow dark:bg-zinc-950" : ""}`}>{u}</button>)}
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left dark:bg-zinc-800/50"><tr><th className="p-3">Size</th>{chart.cols.map((c) => <th key={c} className="p-3">{c}</th>)}</tr></thead>
          <tbody>
            {Object.entries(chart.rows).filter(([s]) => p.sizes.includes(s as never)).map(([s, vals]) => (
              <tr key={s} onClick={() => available(s) && onPick(s)} className={`cursor-pointer border-t border-zinc-200 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 ${found === s ? "bg-emerald-50 font-semibold dark:bg-emerald-900/20" : ""} ${available(s) ? "" : "opacity-40"}`}>
                <td className="p-3">{s} {found === s && <span className="badge ml-1 bg-emerald-500 text-white">Your fit</span>}</td>
                {vals.map((v, i) => <td key={i} className="p-3 tabular-nums">{conv(v, chart.cols[i])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
        <p className="font-semibold">Find your size</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label><span className="label">{keyLabel}</span><input type="number" inputMode="decimal" value={mine} onChange={(e) => setMine(e.target.value)} className="input" placeholder={key === "height" ? "e.g. 120" : unit === "cm" ? "e.g. 96" : "e.g. 38"} /></label>
          <div><span className="label">Preferred fit</span><div className="flex gap-1.5">{(["slim", "regular", "relaxed"] as const).map((f) => <button key={f} onClick={() => setFit(f)} className={`chip flex-1 justify-center text-xs capitalize ${fit === f ? "chip-on" : ""}`}>{f}</button>)}</div></div>
        </div>
        {found && <p className="mt-3 text-sm">We recommend <b className="text-emerald-600">{found}</b>. <button onClick={() => available(found) && onPick(found)} className="font-semibold underline">Select {found}</button></p>}
      </div>
      <div className="grid gap-3 text-xs text-zinc-500 sm:grid-cols-3">
        <p><b className="text-zinc-900 dark:text-white">Chest:</b> measure around the fullest part, under the arms.</p>
        <p><b className="text-zinc-900 dark:text-white">Waist:</b> measure around your natural waistline.</p>
        <p><b className="text-zinc-900 dark:text-white">Hips / inseam:</b> fullest part of hips; crotch to ankle.</p>
      </div>
    </div>
  );
}
