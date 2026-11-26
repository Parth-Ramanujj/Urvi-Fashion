"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronRight, ImagePlus, Plus, Trash2 } from "lucide-react";
import ProductArt from "@/components/ProductArt";
import { useApp } from "@/components/Providers";
import { saveBanners } from "@/lib/brand-admin";
import { ART_KINDS, type Banner } from "@/lib/types";
import { Toggle } from "../retention/Retention";

const blank = (): Banner => ({ id: `b${Date.now().toString(36)}`, eyebrow: "New collection", title: "Your headline\nhere", subtitle: "", cta: "Shop now", href: "/shop", from: "#1f2a44", to: "#3d5a80", art: { kind: "tee", hex: "#f3f2ec" }, badge: "UP TO 50% OFF", active: true });

function Preview({ b, img }: { b: Banner; img?: string }) {
  return (
    <div className="relative flex h-40 items-center overflow-hidden rounded-2xl text-white" style={{ background: `linear-gradient(120deg, ${b.from}, ${b.to})` }}>
      <div className="absolute inset-y-0 left-0 w-1/2 [mask-image:linear-gradient(to_right,black_65%,transparent)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <ProductArt kind={b.art.kind} hex={b.art.hex} className="h-full w-full" />}
      </div>
      <div className="relative ml-auto flex w-1/2 flex-col items-center gap-1 px-2 text-center">
        {b.eyebrow && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider">{b.eyebrow}</span>}
        <p className="whitespace-pre-line font-display text-lg font-bold leading-tight">{b.title}</p>
        {b.badge && <p className="text-xl font-black leading-none">{b.badge}</p>}
        <span className="mt-1 inline-flex items-center gap-1 rounded bg-amber-300 px-2 py-0.5 text-[10px] font-bold text-zinc-900">{b.cta}<ChevronRight className="size-3" /></span>
      </div>
      {b.active === false && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold">Hidden</span>}
    </div>
  );
}

export default function BannerEditor({ initial }: { initial: Banner[] }) {
  const { toast } = useApp();
  const router = useRouter();
  const [list, setList] = useState<Banner[]>(initial);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [pending, start] = useTransition();
  const urls = useMemo(() => Object.fromEntries(Object.entries(files).map(([id, f]) => [id, URL.createObjectURL(f)])), [files]);
  useEffect(() => () => Object.values(urls).forEach(URL.revokeObjectURL), [urls]);

  const patch = (i: number, p: Partial<Banner>) => setList((l) => l.map((b, j) => (j === i ? { ...b, ...p } : b)));
  const move = (i: number, d: number) => setList((l) => { const n = [...l]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const remove = (i: number) => { const id = list[i].id; setList((l) => l.filter((_, j) => j !== i)); setFiles(({ [id]: _, ...rest }) => rest); };

  const save = () => start(async () => {
    const fd = new FormData();
    fd.set("data", JSON.stringify(list));
    for (const [id, f] of Object.entries(files)) fd.set(`image-${id}`, f);
    const r = await saveBanners(fd);
    if (!r.ok) return toast(r.error, "err");
    setList(r.data); setFiles({});
    toast("Banners saved");
    router.refresh();
  });

  const color = (label: string, v: string, on: (v: string) => void) => (
    <label className="block"><span className="label">{label}</span>
      <span className="flex gap-2"><input type="color" value={v} onChange={(e) => on(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-zinc-300 bg-transparent dark:border-zinc-700" aria-label={label} /><input className="input font-mono" value={v} maxLength={7} onChange={(e) => on(e.target.value)} /></span>
    </label>
  );

  return (
    <div className="space-y-4">
      {list.length === 0 && <p className="card p-6 text-center text-sm text-zinc-500">No banners — the home page will start with your categories.</p>}
      {list.map((b, i) => {
        const img = urls[b.id] ?? b.image;
        return (
          <section key={b.id} className="card grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Banner {i + 1}</p>
                <div className="flex items-center gap-1">
                  <Toggle label="Active" on={b.active !== false} onChange={(v) => patch(i, { active: v })} />
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="btn-ghost p-2 disabled:opacity-30" aria-label="Move up"><ArrowUp className="size-4" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} className="btn-ghost p-2 disabled:opacity-30" aria-label="Move down"><ArrowDown className="size-4" /></button>
                  <button type="button" onClick={() => remove(i)} className="btn-ghost p-2 text-red-600" aria-label="Delete banner"><Trash2 className="size-4" /></button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="label">Small label</span><input className="input" value={b.eyebrow} maxLength={40} onChange={(e) => patch(i, { eyebrow: e.target.value })} /></label>
                <label className="block"><span className="label">Badge (e.g. 50% OFF)</span><input className="input" value={b.badge ?? ""} maxLength={20} onChange={(e) => patch(i, { badge: e.target.value })} /></label>
                <label className="block sm:col-span-2"><span className="label">Headline (Enter for a new line)</span><textarea className="input" rows={2} value={b.title} maxLength={60} onChange={(e) => patch(i, { title: e.target.value })} /></label>
                <label className="block sm:col-span-2"><span className="label">Subtitle (desktop)</span><input className="input" value={b.subtitle} maxLength={140} onChange={(e) => patch(i, { subtitle: e.target.value })} /></label>
                <label className="block"><span className="label">Button text</span><input className="input" value={b.cta} maxLength={24} onChange={(e) => patch(i, { cta: e.target.value })} /></label>
                <label className="block"><span className="label">Link</span><input className="input font-mono" value={b.href} placeholder="/shop?category=women" onChange={(e) => patch(i, { href: e.target.value })} /></label>
                {color("Gradient start", b.from, (v) => patch(i, { from: v }))}
                {color("Gradient end", b.to, (v) => patch(i, { to: v }))}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="btn-ghost cursor-pointer py-2"><ImagePlus className="size-4" />{img ? "Replace photo" : "Upload photo"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setFiles((x) => ({ ...x, [b.id]: f })); e.target.value = ""; }} />
                </label>
                {img && <button type="button" onClick={() => { setFiles(({ [b.id]: _, ...rest }) => rest); patch(i, { image: undefined }); }} className="btn-ghost py-2 text-red-600">Use generated art</button>}
                {!img && (<>
                  <label className="block"><span className="label">Art style</span><select className="input w-auto capitalize" value={b.art.kind} onChange={(e) => patch(i, { art: { ...b.art, kind: e.target.value as Banner["art"]["kind"] } })}>{ART_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
                  <div className="w-44">{color("Art colour", b.art.hex, (v) => patch(i, { art: { ...b.art, hex: v } }))}</div>
                </>)}
              </div>
            </div>
            <div><p className="label">Preview</p><Preview b={b} img={img} /></div>
          </section>
        );
      })}
      <div className="sticky bottom-20 z-10 flex flex-wrap gap-2 md:bottom-4">
        <button type="button" onClick={() => setList((l) => [...l, blank()])} disabled={list.length >= 8} className="btn-ghost bg-white dark:bg-zinc-900"><Plus className="size-4" />Add banner</button>
        <button type="button" onClick={save} disabled={pending} className="btn-primary shadow-lg">{pending ? "Saving…" : "Save banners"}</button>
      </div>
    </div>
  );
}
