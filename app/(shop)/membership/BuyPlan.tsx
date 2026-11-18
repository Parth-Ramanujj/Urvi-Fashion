"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useApp } from "@/components/Providers";
import { Modal } from "@/components/ui";
import { buyMembership } from "@/lib/actions";
import type { PaymentMethod } from "@/lib/types";

const METHODS: [PaymentMethod, string][] = [["upi", "UPI"], ["card", "Card"], ["netbanking", "Net banking"], ["wallet", "Wallet"]];

export default function BuyPlan({ planId, price, name, renew, color }: { planId: string; price: number; name: string; renew: boolean; color: string }) {
  const { money, toast } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 1200)); // simulated gateway round-trip
    const r = await buyMembership(planId, method);
    setBusy(false);
    if (!r.ok) return toast(r.error, "err");
    setOpen(false);
    toast(renew ? "Membership extended 👑" : `Welcome to ${name}! 👑`);
    router.refresh();
  };
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn w-full py-3 text-white hover:opacity-90" style={{ background: color }}>{renew ? "Renew & extend" : `Join for ${money(price)}`}</button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={`${renew ? "Renew" : "Join"} ${name}`}>
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">Pay securely. Your perks start immediately.</p>
          <div className="grid grid-cols-2 gap-2">{METHODS.map(([k, l]) => <button key={k} onClick={() => setMethod(k)} className={`chip justify-center py-2.5 ${method === k ? "chip-on" : ""}`}>{l}</button>)}</div>
          <button onClick={pay} disabled={busy} className="btn-brand w-full py-3.5 text-base">{busy ? <><Loader2 className="size-4 animate-spin" />Processing…</> : `Pay ${money(price)}`}</button>
          <p className="text-center text-xs text-zinc-400">Demo payment — no money is charged.</p>
        </div>
      </Modal>
    </>
  );
}
