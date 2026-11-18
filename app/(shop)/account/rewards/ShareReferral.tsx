"use client";
import { useEffect, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { useApp } from "@/components/Providers";

export default function ShareReferral({ code }: { code: string }) {
  const { toast, brand } = useApp();
  const [link, setLink] = useState("");
  useEffect(() => setLink(`${location.origin}/login?ref=${code}`), [code]);
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast("Copied"), () => toast("Couldn't copy", "err"));
  const share = async () => {
    const text = `Join me on ${brand.name} and get bonus ${brand.coinName} on sign-up! Use my code ${code}`;
    try { if (navigator.share) await navigator.share({ title: brand.name, text, url: link }); else copy(`${text} ${link}`); } catch { /* cancelled */ }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-1 items-center justify-between gap-2 rounded-xl border-2 border-dashed border-violet-400 px-4 py-2.5">
        <span className="font-mono text-lg font-bold tracking-widest">{code}</span>
        <button onClick={() => copy(code)} className="text-violet-600" aria-label="Copy referral code"><Copy className="size-4" /></button>
      </div>
      <button onClick={share} className="btn bg-violet-600 text-white hover:bg-violet-700"><Share2 className="size-4" />Invite friends</button>
      <a href={`https://wa.me/?text=${encodeURIComponent(`Join me on ${brand.name} and get bonus ${brand.coinName}! ${link}`)}`} target="_blank" rel="noopener noreferrer" className="btn bg-emerald-500 text-white hover:bg-emerald-600">WhatsApp</a>
    </div>
  );
}
