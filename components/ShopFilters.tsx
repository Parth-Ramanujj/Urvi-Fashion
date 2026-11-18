"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { useApp } from "./Providers";

type Facets = { sizes: string[]; colors: { name: string; hex: string }[]; fabrics: string[]; brands: string[]; maxPrice: number };
const CATS = ["men", "women", "kids", "accessories", "seasonal"];

export function useParamsUpdater() {
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  const [pending, start] = useTransition();
  const set = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) (v ? p.set(k, v) : p.delete(k));
    start(() => router.replace(`${path}?${p}`, { scroll: false }));
  };
  return { sp, set, pending };
}

export function SortSelect({ sorts }: { sorts: Record<string, string> }) {
  const { sp, set } = useParamsUpdater();
  const { t } = useApp();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-zinc-500 sm:inline">{t("common.sort")}</span>
      <select value={sp.get("sort") ?? "popular"} onChange={(e) => set({ sort: e.target.value })} className="input w-auto rounded-full py-2 pr-8">
        {Object.entries(sorts).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </label>
  );
}

export default function ShopFilters({ facets }: { facets: Facets }) {
  const { sp, set, pending } = useParamsUpdater();
  const { t, money } = useApp();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(Number(sp.get("max")) || facets.maxPrice);
  useEffect(() => setPrice(Number(sp.get("max")) || facets.maxPrice), [sp, facets.maxPrice]);

  const multi = (key: string) => (sp.get(key) ?? "").split(",").filter(Boolean);
  const toggle = (key: string, v: string) => { const cur = multi(key); set({ [key]: (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(",") || null }); };
  const active = ["category", "size", "color", "fabric", "brand", "max", "discount", "rating", "sale"].filter((k) => sp.get(k));

  const body = (
    <div className={`space-y-7 transition ${pending ? "opacity-60" : ""}`}>
      {active.length > 0 && <button onClick={() => set(Object.fromEntries(active.map((k) => [k, null])))} className="text-sm font-semibold text-brand-600">{t("common.clear")} ({active.length})</button>}
      <Group title="Category">
        <div className="flex flex-wrap gap-1.5">{CATS.map((c) => <button key={c} onClick={() => set({ category: sp.get("category") === c ? null : c })} className={`chip text-xs capitalize ${sp.get("category") === c ? "chip-on" : ""}`}>{c}</button>)}</div>
      </Group>
      <Group title={`Price · up to ${money(price)}`}>
        <input type="range" min={0} max={facets.maxPrice} step={100} value={price} onChange={(e) => setPrice(+e.target.value)} onPointerUp={() => set({ max: price >= facets.maxPrice ? null : String(price) })} onKeyUp={() => set({ max: price >= facets.maxPrice ? null : String(price) })} className="w-full accent-brand-500" aria-label="Maximum price" />
        <div className="flex justify-between text-xs text-zinc-500"><span>{money(0)}</span><span>{money(facets.maxPrice)}</span></div>
      </Group>
      {facets.sizes.length > 1 && (
        <Group title="Size">
          <div className="grid grid-cols-4 gap-1.5">{facets.sizes.map((s) => <button key={s} onClick={() => toggle("size", s)} className={`chip justify-center text-xs ${multi("size").includes(s) ? "chip-on" : ""}`}>{s}</button>)}</div>
        </Group>
      )}
      <Group title="Colour">
        <div className="flex flex-wrap gap-2.5">
          {facets.colors.map((c) => {
            const on = multi("color").includes(c.name);
            return <button key={c.name} onClick={() => toggle("color", c.name)} title={c.name} aria-label={c.name} aria-pressed={on} className={`grid size-8 place-items-center rounded-full border border-black/10 ring-offset-2 transition dark:ring-offset-zinc-950 ${on ? "ring-2 ring-zinc-900 dark:ring-white" : ""}`} style={{ background: c.hex }}>{on && <Check className="size-4 mix-blend-difference text-white" />}</button>;
          })}
        </div>
      </Group>
      <Group title="Fabric"><Checks items={facets.fabrics} on={multi("fabric")} toggle={(v) => toggle("fabric", v)} /></Group>
      <Group title="Brand"><Checks items={facets.brands} on={multi("brand")} toggle={(v) => toggle("brand", v)} /></Group>
      <Group title="Discount">
        <div className="flex flex-wrap gap-1.5">{["10", "30", "40", "50"].map((d) => <button key={d} onClick={() => set({ discount: sp.get("discount") === d ? null : d })} className={`chip text-xs ${sp.get("discount") === d ? "chip-on" : ""}`}>{d}%+</button>)}</div>
      </Group>
      <Group title="Rating">
        <div className="flex flex-wrap gap-1.5">{["4.5", "4", "3"].map((r) => <button key={r} onClick={() => set({ rating: sp.get("rating") === r ? null : r })} className={`chip text-xs ${sp.get("rating") === r ? "chip-on" : ""}`}>★ {r}+</button>)}</div>
      </Group>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sp.get("sale") === "flash"} onChange={(e) => set({ sale: e.target.checked ? "flash" : null })} className="size-4 accent-brand-500" />Flash sale only</label>
    </div>
  );

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost py-2 lg:hidden"><SlidersHorizontal className="size-4" />{t("common.filters")}{active.length > 0 && <span className="badge bg-brand-500 text-white">{active.length}</span>}</button>
      <aside className="hidden w-60 shrink-0 lg:block"><div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">{body}</div></aside>
      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] animate-slide-up flex-col rounded-t-3xl bg-white dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800"><h2 className="font-semibold">{t("common.filters")}</h2><button onClick={() => setOpen(false)} aria-label="Close filters"><X className="size-5" /></button></div>
            <div className="overflow-y-auto p-5">{body}</div>
            <div className="border-t border-zinc-200 p-4 dark:border-zinc-800"><button onClick={() => setOpen(false)} className="btn-primary w-full">Show results</button></div>
          </div>
        </div>
      )}
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="label">{title}</p>{children}</div>;
}
function Checks({ items, on, toggle }: { items: string[]; on: string[]; toggle: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      {items.map((x) => <label key={x} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={on.includes(x)} onChange={() => toggle(x)} className="size-4 rounded accent-zinc-900 dark:accent-white" />{x}</label>)}
    </div>
  );
}
