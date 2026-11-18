"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Rotate3d, X, ZoomIn } from "lucide-react";
import ProductImage from "../ProductImage";

type Slide = { type: "img"; src: string } | { type: "spin"; src: string } | { type: "video"; src: string };

export default function Gallery({ images, video, name }: { images: string[]; video?: string; name: string }) {
  const slides: Slide[] = [...images.map((src) => ({ type: "img" as const, src })), { type: "spin", src: images[0] }, ...(video ? [{ type: "video" as const, src: video }] : [])];
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => { setI(0); track.current?.scrollTo({ left: 0 }); }, [images]);

  const render = (s: Slide, big = false) =>
    s.type === "video" ? <video src={s.src} controls playsInline className="h-full w-full object-cover" /> :
    s.type === "spin" ? <div className="h-full w-full animate-spin360 [transform-style:preserve-3d]"><ProductImage src={s.src} alt={`${name} 360° view`} /></div> :
    <ProductImage src={s.src} alt={name} className={big ? "object-contain" : ""} />;

  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row">
      <div className="no-scrollbar hidden gap-2 md:flex md:w-20 md:flex-col">
        {slides.map((s, k) => (
          <button key={k} onClick={() => setI(k)} className={`relative aspect-[4/5] w-full overflow-hidden rounded-xl border-2 transition ${k === i ? "border-zinc-900 dark:border-white" : "border-transparent opacity-70 hover:opacity-100"}`} aria-label={`View image ${k + 1}`}>
            {s.type === "img" ? <ProductImage src={s.src} alt="" /> : <span className="grid h-full place-items-center bg-zinc-100 text-zinc-600 dark:bg-zinc-800">{s.type === "spin" ? <Rotate3d className="size-5" /> : <Play className="size-5" />}</span>}
          </button>
        ))}
      </div>

      {/* Desktop: hover-zoom main image */}
      <div className="relative hidden aspect-[4/5] flex-1 cursor-zoom-in overflow-hidden rounded-3xl bg-zinc-100 md:block dark:bg-zinc-800"
        onMouseMove={(e) => { if (slides[i].type !== "img") return; const r = e.currentTarget.getBoundingClientRect(); setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }); }}
        onMouseLeave={() => setZoom(null)} onClick={() => slides[i].type === "img" && setLightbox(true)}>
        <div key={`${images[0]}-${i}`} className="h-full w-full animate-fade-in transition-transform duration-200" style={zoom ? { transform: "scale(2.2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}>{render(slides[i])}</div>
        <span className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-900 shadow"><ZoomIn className="size-3.5" />Hover to zoom · click to expand</span>
      </div>

      {/* Mobile: swipeable carousel */}
      <div className="relative -mx-4 md:hidden">
        <div ref={track} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto" onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
          {slides.map((s, k) => <button key={k} onClick={() => s.type === "img" && setLightbox(true)} className="aspect-[4/5] w-full shrink-0 snap-center overflow-hidden bg-zinc-100 dark:bg-zinc-800" aria-label="Open full screen">{render(s)}</button>)}
        </div>
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">{slides.map((_, k) => <span key={k} className={`h-1.5 rounded-full bg-zinc-900 transition-all dark:bg-white ${k === i ? "w-5" : "w-1.5 opacity-30"}`} />)}</div>
      </div>

      {lightbox && <Lightbox images={images} start={Math.min(i, images.length - 1)} name={name} onClose={() => setLightbox(false)} />}
    </div>
  );
}

/** Full-screen viewer with pinch-to-zoom, drag-to-pan, double-tap and wheel zoom. */
function Lightbox({ images, start, name, onClose }: { images: string[]; start: number; name: string; onClose: () => void }) {
  const [k, setK] = useState(start);
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const base = useRef({ dist: 0, s: 1, x: 0, y: 0, px: 0, py: 0 });
  const lastTap = useRef(0);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    document.body.style.overflow = "hidden"; addEventListener("keydown", key);
    return () => { document.body.style.overflow = ""; removeEventListener("keydown", key); };
  });
  const go = (dir: number) => { setK((x) => (x + dir + images.length) % images.length); setT({ s: 1, x: 0, y: 0 }); };
  const clamp = (s: number) => Math.min(4, Math.max(1, s));

  const down = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...pts.current.values()];
    base.current = { dist: p.length === 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0, s: t.s, x: t.x, y: t.y, px: e.clientX, py: e.clientY };
    if (p.length === 1) { const now = Date.now(); if (now - lastTap.current < 280) setT((v) => (v.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 })); lastTap.current = now; }
  };
  const move = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...pts.current.values()];
    if (p.length === 2 && base.current.dist) setT((v) => ({ ...v, s: clamp(base.current.s * (Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / base.current.dist)) }));
    else if (p.length === 1 && t.s > 1) setT((v) => ({ ...v, x: base.current.x + e.clientX - base.current.px, y: base.current.y + e.clientY - base.current.py }));
  };
  const up = (e: React.PointerEvent) => { pts.current.delete(e.pointerId); if (t.s <= 1) setT({ s: 1, x: 0, y: 0 }); const p = [...pts.current.values()]; if (p.length === 1) base.current = { ...base.current, x: t.x, y: t.y, px: p[0].x, py: p[0].y }; };

  return (
    <div className="fixed inset-0 z-[80] flex animate-fade-in flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={`${name} images`}>
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-sm">{k + 1} / {images.length} · pinch or scroll to zoom</span>
        <button onClick={onClose} aria-label="Close" className="rounded-full bg-white/10 p-2 hover:bg-white/20"><X className="size-5" /></button>
      </div>
      <div className="relative flex-1 touch-none overflow-hidden" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onWheel={(e) => setT((v) => { const s = clamp(v.s * (e.deltaY < 0 ? 1.15 : 0.87)); return s === 1 ? { s, x: 0, y: 0 } : { ...v, s }; })}>
        <div className="mx-auto h-full max-w-2xl transition-transform duration-75" style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})` }}>
          <ProductImage src={images[k]} alt={name} className="object-contain" />
        </div>
      </div>
      <div className="flex justify-center gap-2 p-4">
        {images.map((src, j) => <button key={j} onClick={() => { setK(j); setT({ s: 1, x: 0, y: 0 }); }} className={`h-16 w-12 overflow-hidden rounded-lg border-2 ${j === k ? "border-white" : "border-transparent opacity-60"}`} aria-label={`Image ${j + 1}`}><ProductImage src={src} alt="" /></button>)}
      </div>
    </div>
  );
}
