"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkle } from "lucide-react";
import ProductArt from "./ProductArt";
import type { Banner } from "@/lib/types";

export default function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const n = banners.length;
  useEffect(() => {
    if (paused || n < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 5000);
    return () => clearInterval(t);
  }, [paused, n]);
  if (!n) return null;
  const go = (d: number) => setI((x) => (x + d + n) % n);

  return (
    <section aria-roledescription="carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative overflow-hidden rounded-2xl md:rounded-3xl"
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; setPaused(true); }}
        onTouchEnd={(e) => { if (touch.current !== null) { const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); } touch.current = null; setPaused(false); }}>
        <div className="flex transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ transform: `translateX(-${i * 100}%)` }}>
          {banners.map((b, k) => {
            const on = k === i;
            return (
              <Link key={b.id} href={b.href} tabIndex={on ? 0 : -1} aria-hidden={!on} aria-label={`${b.eyebrow}: ${b.title.replace("\n", " ")}`}
                className="relative block h-[230px] w-full shrink-0 overflow-hidden border-[3px] sm:h-[340px] md:h-[460px] md:border-0" style={{ background: `linear-gradient(120deg, ${b.from}, ${b.to})`, borderColor: b.to }}>
                {b.fullImage && b.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.image} alt={b.title || b.eyebrow || "Banner"} className="h-full w-full object-cover" />
                ) : (
                  <>
                    {/* Product art: left on mobile, right on desktop */}
                    <div className="absolute inset-y-0 left-0 w-[52%] md:left-auto md:right-0 md:w-[46%]">
                      <div className={`h-full w-full [mask-image:linear-gradient(to_right,black_65%,transparent)] md:rounded-l-[48px] md:[mask-image:linear-gradient(to_left,black_70%,transparent)] ${on ? "animate-fade-in" : ""}`}>
                        {b.image
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={b.image} alt="" className="h-full w-full object-cover" />
                          : <ProductArt kind={b.art.kind} hex={b.art.hex} className="h-full w-full" />}
                      </div>
                    </div>
                    {/* Gold corner ornaments (mobile banner frame) */}
                    {["left-1.5 top-1.5", "right-1.5 top-1.5", "bottom-1.5 left-1.5", "bottom-1.5 right-1.5"].map((p) => <Sparkle key={p} className={`absolute ${p} size-4 fill-amber-300 text-amber-300 md:hidden`} />)}

                    <div className="relative z-10 ml-auto flex h-full w-[50%] flex-col items-center justify-center gap-1.5 px-2 text-center text-white md:ml-0 md:w-auto md:max-w-xl md:items-start md:gap-0 md:px-14 md:text-left">
                      <span className={`rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ring-1 ring-white/25 backdrop-blur md:bg-transparent md:p-0 md:text-xs md:ring-0 md:text-white/70 ${on ? "animate-slide-up" : ""}`}>{b.eyebrow}</span>
                      <h2 className={`whitespace-pre-line font-display text-[22px] font-bold leading-[1.05] sm:text-4xl md:mt-3 md:text-6xl ${on ? "animate-slide-up [animation-delay:80ms]" : ""}`}>{b.title}</h2>
                      {b.badge && <p className={`font-sans text-[26px] font-black leading-none tracking-tight drop-shadow sm:text-4xl md:mt-4 md:text-5xl ${on ? "animate-pop [animation-delay:200ms]" : ""}`}>{b.badge}</p>}
                      <p className="mt-3 hidden max-w-sm text-white/80 md:block">{b.subtitle}</p>
                      <span className={`mt-1 inline-flex items-center gap-1 rounded-md bg-amber-300 px-3 py-1 text-xs font-bold text-zinc-900 md:mt-7 md:rounded-full md:bg-white md:px-5 md:py-2.5 md:text-sm ${on ? "animate-slide-up [animation-delay:280ms]" : ""}`}>
                        {b.cta}<span className="grid size-4 place-items-center rounded-full bg-brand-600 text-white md:bg-transparent md:text-zinc-900"><ChevronRight className="size-3 md:size-4" /></span>
                      </span>
                    </div>
                  </>
                )}
              </Link>
            );
          })}
        </div>
        <div className="absolute bottom-4 right-4 z-10 hidden gap-2 md:flex">
          <button onClick={() => go(-1)} className="grid size-10 place-items-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/30" aria-label="Previous slide"><ChevronLeft className="size-5" /></button>
          <button onClick={() => go(1)} className="grid size-10 place-items-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/30" aria-label="Next slide"><ChevronRight className="size-5" /></button>
        </div>
      </div>
      <div className="mt-3 flex justify-center gap-2">
        {banners.map((b, k) => <button key={b.id} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} aria-current={k === i} className={`size-2 rounded-full transition-all ${k === i ? "w-5 bg-zinc-800 dark:bg-zinc-200" : "bg-zinc-300 dark:bg-zinc-700"}`} />)}
      </div>
    </section>
  );
}
