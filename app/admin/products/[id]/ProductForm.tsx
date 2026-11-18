"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import { useApp } from "@/components/Providers";
import { saveProduct } from "@/lib/admin-actions";
import { ART_KINDS, CATEGORIES, SIZES, type Product, type Size } from "@/lib/types";
import { useAct } from "../../_ui";

type ColorRow = { name: string; hex: string; images: string[]; files: File[] };
const ALL: Size[] = [...SIZES, "Free"];

export default function ProductForm({ product: p }: { product: Product | null }) {
  const router = useRouter();
  const { money } = useApp();
  const { pending, act } = useAct();
  const [f, setF] = useState({
    name: p?.name ?? "", brand: p?.brand ?? "", category: p?.category ?? "men", subcategory: p?.subcategory ?? "", kind: p?.kind ?? "tee", fabric: p?.fabric ?? "Cotton",
    description: p?.description ?? "", details: (p?.details ?? []).join("\n"), mrp: String(p?.mrp ?? ""), price: String(p?.price ?? ""), video: p?.video ?? "", active: p?.active ?? true,
  });
  const [sizes, setSizes] = useState<Size[]>(p?.sizes ?? ["S", "M", "L", "XL"]);
  const [colors, setColors] = useState<ColorRow[]>(p?.colors.map((c) => ({ ...c, images: c.images.filter((s) => !s.startsWith("art:")), files: [] })) ?? [{ name: "Black", hex: "#1c1c1e", images: [], files: [] }]);
  // variant grid keyed by colour index so renaming a colour keeps its numbers
  const [grid, setGrid] = useState<Record<string, { stock: string; price: string }>>(() => {
    const g: Record<string, { stock: string; price: string }> = {};
    p?.variants.forEach((v) => { const ci = p.colors.findIndex((c) => c.name === v.color); g[`${ci}|${v.size}`] = { stock: String(v.stock), price: v.price ? String(v.price) : "" }; });
    return g;
  });
  const [sel, setSel] = useState(0);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });
  const cell = (ci: number, s: Size) => grid[`${ci}|${s}`] ?? { stock: "0", price: "" };
  const setCell = (ci: number, s: Size, k: "stock" | "price", v: string) => setGrid({ ...grid, [`${ci}|${s}`]: { ...cell(ci, s), [k]: v } });
  const updColor = (i: number, patch: Partial<ColorRow>) => setColors(colors.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const previews = useMemo(() => colors.map((c) => c.files.map((file) => URL.createObjectURL(file))), [colors]);
  useEffect(() => () => previews.flat().forEach(URL.revokeObjectURL), [previews]);
  const c = colors[Math.min(sel, colors.length - 1)];
  const previewSrc = c ? (previews[colors.indexOf(c)]?.[0] ?? c.images[0] ?? `art:${f.kind}:${/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#888888"}:front`) : "";
  const off = Number(f.mrp) > Number(f.price) ? Math.round((1 - Number(f.price) / Number(f.mrp)) * 100) : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.set("data", JSON.stringify({
      id: p?.id, ...f, mrp: Number(f.mrp), price: Number(f.price), details: f.details.split("\n"), sizes,
      colors: colors.map(({ name, hex, images }) => ({ name, hex, images })),
      variants: colors.flatMap((col, ci) => sizes.map((s) => ({ color: col.name.trim(), size: s, stock: Number(cell(ci, s).stock) || 0, price: Number(cell(ci, s).price) || null }))),
    }));
    colors.forEach((col, i) => col.files.forEach((file) => fd.append(`img${i}`, file)));
    act(() => saveProduct(fd), p ? "Product saved" : "Product created", (r) => { if (!p) router.replace(`/admin/products/${r.id}`); else setColors(colors.map((x) => ({ ...x, files: [] }))); });
  };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Details</h2>
          <label className="sm:col-span-2"><span className="label">Name</span><input required value={f.name} onChange={set("name")} className="input" /></label>
          <label><span className="label">Brand</span><input required value={f.brand} onChange={set("brand")} className="input" /></label>
          <label><span className="label">Fabric</span><input value={f.fabric} onChange={set("fabric")} className="input" /></label>
          <label><span className="label">Category</span><select value={f.category} onChange={set("category")} className="input capitalize">{CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label><span className="label">Subcategory</span><input value={f.subcategory} onChange={set("subcategory")} placeholder="e.g. T-Shirts" className="input" /></label>
          <label><span className="label">Product type (art & size guide)</span><select value={f.kind} onChange={set("kind")} className="input capitalize">{ART_KINDS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label><span className="label">Video preview URL (optional)</span><input type="url" value={f.video} onChange={set("video")} placeholder="https://…/clip.mp4" className="input" /></label>
          <label className="sm:col-span-2"><span className="label">Description</span><textarea rows={3} value={f.description} onChange={set("description")} className="input" /></label>
          <label className="sm:col-span-2"><span className="label">Highlights (one per line)</span><textarea rows={3} value={f.details} onChange={set("details")} className="input" /></label>
        </section>

        <section className="card grid gap-4 p-5 sm:grid-cols-3">
          <h2 className="font-semibold sm:col-span-3">Pricing</h2>
          <label><span className="label">MRP (₹)</span><input required type="number" min={1} value={f.mrp} onChange={set("mrp")} className="input" /></label>
          <label><span className="label">Selling price (₹)</span><input required type="number" min={1} value={f.price} onChange={set("price")} className="input" /></label>
          <div className="self-end pb-2.5 text-sm text-zinc-500">{off > 0 ? <b className="text-emerald-600">{off}% off</b> : "No discount"}</div>
        </section>

        <section className="card space-y-4 p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Colours & images</h2><button type="button" onClick={() => setColors([...colors, { name: "", hex: "#888888", images: [], files: [] }])} className="btn-ghost px-3 py-1.5 text-xs"><Plus className="size-3.5" />Add colour</button></div>
          {colors.map((col, i) => (
            <div key={i} className={`rounded-xl border p-3 ${sel === i ? "border-zinc-900 dark:border-white" : "border-zinc-200 dark:border-zinc-800"}`} onFocus={() => setSel(i)} onClick={() => setSel(i)}>
              <div className="flex flex-wrap items-center gap-2">
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(col.hex) ? col.hex : "#888888"} onChange={(e) => updColor(i, { hex: e.target.value })} className="size-10 cursor-pointer rounded-lg border-0 bg-transparent" aria-label={`Colour ${i + 1} swatch`} />
                <input required value={col.name} onChange={(e) => updColor(i, { name: e.target.value })} placeholder="Colour name" className="input w-40 flex-1" aria-label={`Colour ${i + 1} name`} />
                <label className="btn-ghost cursor-pointer px-3 py-2 text-xs"><ImagePlus className="size-4" />Upload<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => { updColor(i, { files: [...col.files, ...Array.from(e.target.files ?? [])] }); e.target.value = ""; }} /></label>
                {colors.length > 1 && <button type="button" aria-label="Remove colour" onClick={(e) => {
                  e.stopPropagation();
                  const g: typeof grid = {};
                  for (const [k, v] of Object.entries(grid)) { const [ci, s] = k.split("|"); if (+ci < i) g[k] = v; else if (+ci > i) g[`${+ci - 1}|${s}`] = v; }
                  setGrid(g); setColors(colors.filter((_, j) => j !== i)); setSel(0);
                }} className="p-2 text-zinc-400 hover:text-red-500"><Trash2 className="size-4" /></button>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {col.images.map((src) => <Thumb key={src} src={src} onRemove={() => updColor(i, { images: col.images.filter((x) => x !== src) })} />)}
                {previews[i]?.map((src, j) => <Thumb key={src} src={src} isNew onRemove={() => updColor(i, { files: col.files.filter((_, k) => k !== j) })} />)}
                {!col.images.length && !col.files.length && <p className="text-xs text-zinc-500">No photos — generated product art will be used.</p>}
              </div>
            </div>
          ))}
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Sizes, stock & variant pricing</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ALL.map((s) => <button type="button" key={s} onClick={() => setSizes(sizes.includes(s) ? sizes.filter((x) => x !== s) : ALL.filter((x) => x === s || sizes.includes(x)))} className={`chip text-xs ${sizes.includes(s) ? "chip-on" : ""}`} aria-pressed={sizes.includes(s)}>{s}</button>)}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="text-sm">
              <thead><tr><th className="p-2 text-left text-xs uppercase text-zinc-500">Colour</th>{sizes.map((s) => <th key={s} className="p-2 text-xs text-zinc-500">{s}</th>)}</tr></thead>
              <tbody>
                {colors.map((col, ci) => (
                  <tr key={ci} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="p-2"><span className="flex items-center gap-2 whitespace-nowrap"><span className="size-4 rounded-full border border-black/10" style={{ background: col.hex }} />{col.name || "—"}</span></td>
                    {sizes.map((s) => (
                      <td key={s} className="p-1.5 align-top">
                        <input type="number" min={0} value={cell(ci, s).stock} onChange={(e) => setCell(ci, s, "stock", e.target.value)} aria-label={`${col.name} ${s} stock`} className={`input w-20 px-2 py-1.5 ${Number(cell(ci, s).stock) <= 3 ? "border-amber-400" : ""}`} />
                        <input type="number" min={1} value={cell(ci, s).price} onChange={(e) => setCell(ci, s, "price", e.target.value)} placeholder="₹ default" aria-label={`${col.name} ${s} price override`} className="input mt-1 w-20 px-2 py-1 text-xs" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-zinc-500">Top: stock units. Bottom: optional price override for that variant.</p>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="card overflow-hidden">
          <div className="aspect-[4/5] bg-zinc-100 dark:bg-zinc-800"><ProductImage key={previewSrc} src={previewSrc} alt="Preview" /></div>
          <div className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">{f.brand || "Brand"}</p>
            <p className="font-medium">{f.name || "Product name"}</p>
            <p className="text-sm"><b>{money(Number(f.price) || 0)}</b> {off > 0 && <span className="text-zinc-400 line-through">{money(Number(f.mrp))}</span>}</p>
            <div className="flex gap-1.5 pt-1">{colors.map((x, i) => <button type="button" key={i} onClick={() => setSel(i)} aria-label={x.name} className={`size-5 rounded-full border border-black/10 ${i === sel ? "ring-2 ring-zinc-900 ring-offset-1 dark:ring-white" : ""}`} style={{ background: x.hex }} />)}</div>
          </div>
        </div>
        <label className="card flex items-center justify-between p-4 text-sm font-medium">Visible in store<input type="checkbox" checked={f.active} onChange={set("active")} className="size-5 accent-brand-500" /></label>
        <button disabled={pending} className="btn-brand w-full">{pending ? "Saving…" : p ? "Save changes" : "Create product"}</button>
      </aside>
    </form>
  );
}

function Thumb({ src, onRemove, isNew }: { src: string; onRemove: () => void; isNew?: boolean }) {
  return (
    <div className="relative h-20 w-16 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
      <ProductImage src={src} alt="" />
      {isNew && <span className="badge absolute bottom-1 left-1 bg-brand-500 text-white">new</span>}
      <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label="Remove image" className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-black/60 text-white"><X className="size-3" /></button>
    </div>
  );
}
