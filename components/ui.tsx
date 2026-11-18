"use client";
import { useEffect, useRef, useState } from "react";
import { Star, X } from "lucide-react";
import { useApp } from "./Providers";

export function Money({ v, className }: { v: number; className?: string }) {
  return <span className={className}>{useApp().money(v)}</span>;
}

export function T({ k, vars }: { k: Parameters<ReturnType<typeof useApp>["t"]>[0]; vars?: Record<string, string | number> }) {
  return <>{useApp().t(k, vars)}</>;
}

export function Stars({ value, size = 14, className = "" }: { value: number; size?: number; className?: string }) {
  return (
    <span className={`inline-flex ${className}`} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-zinc-300 dark:text-zinc-600"} />
      ))}
    </span>
  );
}

export function useCountdown(endsAt: number) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = Math.max(0, endsAt - (now ?? endsAt));
  return { d: Math.floor(ms / 86_400_000), h: Math.floor(ms / 3_600_000) % 24, m: Math.floor(ms / 60_000) % 60, s: Math.floor(ms / 1000) % 60, done: now !== null && ms === 0 };
}

export function Countdown({ endsAt, className = "" }: { endsAt: number; className?: string }) {
  const { d, h, m, s } = useCountdown(endsAt);
  const cells = [[d, "d"], [h, "h"], [m, "m"], [s, "s"]] as const;
  return (
    <div className={`flex gap-1.5 font-mono tabular-nums ${className}`} role="timer">
      {cells.map(([v, l]) => (
        <span key={l} className="rounded-lg bg-zinc-900 px-2 py-1 text-sm font-bold text-white dark:bg-white dark:text-zinc-900">
          {String(v).padStart(2, "0")}<span className="ml-0.5 text-[10px] font-medium opacity-60">{l}</span>
        </span>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-3xl" : "max-w-lg"} rounded-3xl bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm open:animate-slide-up dark:bg-zinc-900 dark:text-zinc-100`}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-5 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close"><X className="size-5" /></button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-5">{open && children}</div>
    </dialog>
  );
}

export function Empty({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800">{icon}</div>
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </div>
  );
}
