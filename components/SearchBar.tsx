"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Mic, Search, X } from "lucide-react";
import { suggest } from "@/lib/actions";
import ProductImage from "./ProductImage";
import { useApp } from "./Providers";
import { Money } from "./ui";

type Sugg = Awaited<ReturnType<typeof suggest>>;
type SpeechRec = { lang: string; interimResults: boolean; start(): void; stop(): void; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; onerror: () => void };

export default function SearchBar({ autoFocus, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const { t, toast, lang } = useApp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Sugg | null>(null);
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [active, setActive] = useState(-1);
  const recRef = useRef<SpeechRec | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    let live = true;
    const id = setTimeout(() => suggest(q).then((r) => live && setRes(r)), 160);
    return () => { live = false; clearTimeout(id); };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (term: string) => {
    if (!term.trim()) return;
    setOpen(false); onDone?.();
    router.push(`/shop?q=${encodeURIComponent(term.trim())}`);
  };

  const voice = () => {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Rec = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Rec) return toast("Voice search isn't supported in this browser", "err");
    if (listening) return recRef.current?.stop();
    const r = new Rec();
    r.lang = lang === "hi" ? "hi-IN" : "en-IN";
    r.interimResults = true;
    r.onresult = (e) => { const text = Array.from(e.results).map((x) => x[0].transcript).join(""); setQ(text); setOpen(true); };
    r.onend = () => { setListening(false); setQ((cur) => { if (cur.trim()) go(cur); return cur; }); };
    r.onerror = () => { setListening(false); toast("Couldn't hear that — try again", "err"); };
    recRef.current = r; setListening(true); r.start();
  };

  const prods = res?.products ?? [];
  return (
    <div ref={boxRef} className="relative w-full">
      <form onSubmit={(e) => { e.preventDefault(); if (active >= 0 && prods[active]) { setOpen(false); onDone?.(); router.push(`/product/${prods[active].slug}`); } else go(q); }} role="search"
        className={`flex items-center gap-2 rounded-full border bg-zinc-100 px-4 transition dark:bg-zinc-900 ${listening ? "border-brand-500 ring-4 ring-brand-500/20" : "border-transparent focus-within:border-zinc-300 focus-within:bg-white dark:focus-within:border-zinc-700"}`}>
        <Search className="size-4 shrink-0 text-zinc-400" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }} onFocus={() => setOpen(true)} autoFocus={autoFocus}
          onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(prods.length - 1, a + 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); } if (e.key === "Escape") setOpen(false); }}
          placeholder={listening ? t("search.listening") : t("search.placeholder")} aria-label="Search products" role="combobox" aria-expanded={open && !!res} aria-controls="search-suggestions"
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-zinc-400" />
        {q && <button type="button" onClick={() => { setQ(""); setRes(null); }} aria-label="Clear search"><X className="size-4 text-zinc-400" /></button>}
        <button type="button" onClick={voice} aria-label="Search by voice" className={`rounded-full p-1.5 transition ${listening ? "animate-pulse bg-brand-500 text-white" : "text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"}`}><Mic className="size-4" /></button>
      </form>
      {open && res && (prods.length > 0 || res.terms.length > 0) && (
        <div id="search-suggestions" className="absolute inset-x-0 top-12 z-50 max-h-[70vh] animate-fade-in overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
          {res.terms.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2">
              {res.terms.map((term) => <button key={term} onClick={() => go(term)} className="chip text-xs capitalize"><Search className="size-3" />{term}</button>)}
            </div>
          )}
          {prods.map((p, i) => (
            <Link key={p.id} href={`/product/${p.slug}`} onClick={() => { setOpen(false); onDone?.(); }}
              className={`flex items-center gap-3 rounded-xl p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 ${i === active ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}>
              <div className="size-12 shrink-0 overflow-hidden rounded-lg"><ProductImage src={p.image} alt={p.name} /></div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.name}</p><p className="text-xs text-zinc-500">{p.brand}</p></div>
              <Money v={p.price} className="text-sm font-semibold" />
            </Link>
          ))}
          <button onClick={() => go(q)} className="mt-1 w-full rounded-xl p-2 text-left text-sm font-medium text-brand-600 hover:bg-zinc-100 dark:hover:bg-zinc-800">See all results for “{q}” →</button>
        </div>
      )}
    </div>
  );
}
