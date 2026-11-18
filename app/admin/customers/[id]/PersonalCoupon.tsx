"use client";
import { useState } from "react";
import { Gift } from "lucide-react";
import { Modal } from "@/components/ui";
import { sendPersonalCoupon } from "@/lib/admin-extra-actions";
import { useAct } from "../../_ui";

export default function PersonalCoupon({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ type: "percent" as "percent" | "flat", value: 15, days: 14, minOrder: 0, message: "" });
  const { pending, act } = useAct();
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-brand px-3 py-1.5 text-xs"><Gift className="size-3.5" />Send coupon</button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Personal coupon for ${name.split(" ")[0]}`}>
        <form onSubmit={(e) => { e.preventDefault(); act(() => sendPersonalCoupon(userId, f), "Coupon sent", () => setOpen(false)); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label><span className="label">Type</span><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as "percent" | "flat" })} className="input"><option value="percent">% off</option><option value="flat">₹ off</option></select></label>
            <label><span className="label">{f.type === "percent" ? "Discount %" : "Discount ₹"}</span><input type="number" min={1} value={f.value} onChange={(e) => setF({ ...f, value: +e.target.value })} className="input" /></label>
            <label><span className="label">Valid days</span><input type="number" min={1} max={90} value={f.days} onChange={(e) => setF({ ...f, days: +e.target.value })} className="input" /></label>
            <label><span className="label">Min order ₹</span><input type="number" min={0} value={f.minOrder} onChange={(e) => setF({ ...f, minOrder: +e.target.value })} className="input" /></label>
          </div>
          <label className="block"><span className="label">Personal message (optional)</span><input value={f.message} maxLength={200} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Thanks for being a loyal customer!" className="input" /></label>
          <p className="text-xs text-zinc-500">Creates a one-time code only this customer can use and sends it to their notifications.</p>
          <button disabled={pending} className="btn-primary w-full">{pending ? "Sending…" : "Send coupon"}</button>
        </form>
      </Modal>
    </>
  );
}
