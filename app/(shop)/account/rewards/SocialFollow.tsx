"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { useApp } from "@/components/Providers";
import { claimSocial } from "@/lib/actions";
import type { SocialLink } from "@/lib/types";

const COLORS: Record<string, string> = { instagram: "from-pink-500 via-red-500 to-amber-400", facebook: "from-blue-600 to-blue-500", youtube: "from-red-600 to-red-500", x: "from-zinc-900 to-zinc-700", twitter: "from-sky-500 to-sky-400", whatsapp: "from-emerald-500 to-emerald-400" };

export default function SocialFollow({ links, coins, claimed }: { links: SocialLink[]; coins: number; claimed: string[] }) {
  const { toast } = useApp();
  const router = useRouter();
  const [done, setDone] = useState(claimed);
  const follow = async (l: SocialLink) => {
    window.open(l.url, "_blank", "noopener,noreferrer");
    if (done.includes(l.id)) return;
    const r = await claimSocial(l.id);
    if (!r.ok) return toast(r.error, "err");
    setDone((x) => [...x, l.id]);
    if (r.data) { toast(`+${r.data} coins — thanks for following on ${l.label}!`); router.refresh(); }
  };
  return (
    <section className="card p-5">
      <h2 className="font-semibold">Follow us, earn coins 📲</h2>
      <p className="mb-4 text-sm text-zinc-500">Get {coins} coins for each platform you follow — new drops, offers and styling tips first.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {links.map((l) => {
          const got = done.includes(l.id);
          return (
            <button key={l.id} onClick={() => follow(l)} className={`flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r px-4 py-3 text-left text-sm font-semibold text-white transition hover:opacity-90 ${COLORS[l.id] ?? "from-violet-600 to-fuchsia-600"}`}>
              <span>{l.label}</span>
              <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">{got ? <><Check className="size-3" />Followed</> : <>+{coins} 🪙 <ExternalLink className="size-3" /></>}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
