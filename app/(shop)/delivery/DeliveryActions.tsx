"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, MapPinPlus, PackageCheck, PlusCircle, Truck } from "lucide-react";
import { useApp } from "@/components/Providers";
import { addTrackingCheckpoint, claimDeliveryOrder, deliveryUpdate } from "@/lib/admin-actions";

const FAIL_REASONS = ["Customer unreachable", "Door locked / nobody home", "Customer requested reschedule", "Wrong / incomplete address"];

export default function DeliveryActions({ id, status, cod, city }: { id: string; status: string; cod: boolean; city: string }) {
  const { toast } = useApp();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"none" | "fail" | "track">("none");
  const [reason, setReason] = useState(FAIL_REASONS[0]);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState(city);
  const [note, setNote] = useState("");

  const runAction = (action: "shipped" | "out_for_delivery" | "delivered" | "attempt_failed", actionNote?: string) => {
    if (action === "delivered" && !confirm(cod ? "Confirm cash collected and package handed over?" : "Confirm package handed over?")) return;
    start(async () => {
      const r = await deliveryUpdate(id, action, actionNote);
      if (!r.ok) return toast(r.error, "err");
      const msg = action === "delivered" ? "Marked delivered" : action === "out_for_delivery" ? "Customer notified — out for delivery" : action === "shipped" ? "Marked picked up & shipped" : "Failed attempt logged";
      toast(msg);
      setMode("none");
      router.refresh();
    });
  };

  const postCheckpoint = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await addTrackingCheckpoint(id, { title, location, note });
      if (!r.ok) return toast(r.error, "err");
      toast("Tracking update added");
      setTitle(""); setNote(""); setMode("none");
      router.refresh();
    });
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {(status === "placed" || status === "packed") && (
          <button disabled={pending} onClick={() => runAction("shipped")} className="btn-primary flex-1">
            <PackageCheck className="size-4" />Mark picked up (Shipped)
          </button>
        )}
        {status === "shipped" && (
          <button disabled={pending} onClick={() => runAction("out_for_delivery")} className="btn-primary flex-1">
            <Truck className="size-4" />Start — out for delivery
          </button>
        )}
        {status === "out_for_delivery" && (
          <>
            <button disabled={pending} onClick={() => runAction("delivered")} className="btn-brand flex-1">
              <CheckCircle2 className="size-4" />Mark delivered{cod && " · cash collected"}
            </button>
            <button type="button" disabled={pending} onClick={() => setMode(mode === "fail" ? "none" : "fail")} className="btn-ghost px-3 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4" />Failed attempt
            </button>
          </>
        )}
        <button type="button" disabled={pending} onClick={() => setMode(mode === "track" ? "none" : "track")} className="btn-ghost px-3 text-xs">
          <MapPinPlus className="size-4" />Tracking update
        </button>
      </div>

      {mode === "fail" && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs dark:border-amber-800 dark:bg-amber-950/30">
          <p className="font-semibold text-amber-900 dark:text-amber-200">Report failed delivery attempt</p>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="input bg-white py-1.5 text-xs dark:bg-zinc-900">
            {FAIL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <div className="flex gap-2">
            <button disabled={pending} onClick={() => runAction("attempt_failed", reason)} className="btn-primary py-1.5 text-xs">Save & notify customer</button>
            <button type="button" onClick={() => setMode("none")} className="btn-ghost py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      )}

      {mode === "track" && (
        <form onSubmit={postCheckpoint} className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="font-semibold">Add live tracking checkpoint</p>
          <input required minLength={2} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Status (e.g. Reached Surat Hub)" className="input py-1.5 text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location / area" className="input py-1.5 text-xs" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="input py-1.5 text-xs" />
          </div>
          <div className="flex gap-2">
            <button disabled={pending} className="btn-primary py-1.5 text-xs">Post update</button>
            <button type="button" onClick={() => setMode("none")} className="btn-ghost py-1.5 text-xs">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

export function ClaimOrderButton({ id }: { id: string }) {
  const { toast } = useApp();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => {
        const r = await claimDeliveryOrder(id);
        if (!r.ok) return toast(r.error, "err");
        toast("Order claimed — added to your active run");
        router.refresh();
      })}
      className="btn-primary px-3 py-1.5 text-xs"
    >
      <PlusCircle className="size-3.5" />{pending ? "Claiming…" : "Claim order"}
    </button>
  );
}
