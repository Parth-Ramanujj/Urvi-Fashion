"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LifeBuoy, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { useApp } from "@/components/Providers";
import { Modal } from "@/components/ui";
import { cancelOrder, requestReturn } from "@/lib/actions";
import { SIZES, type OrderStatus, type Size } from "@/lib/types";

const CANCEL_REASONS = ["Ordered by mistake", "Found a better price", "Delivery is too slow", "Want to change size/colour", "Other"];
const RETURN_REASONS = ["Size doesn't fit", "Quality not as expected", "Colour differs from photos", "Received damaged/defective item", "Received wrong item"];

export default function OrderActions({ id, status, returnable, sizes, windowDays }: { id: string; status: OrderStatus; returnable: boolean; sizes: string[]; windowDays: number }) {
  const { toast } = useApp();
  const router = useRouter();
  const [modal, setModal] = useState<null | "cancel" | "return" | "exchange">(null);
  const [reason, setReason] = useState("");
  const [size, setSize] = useState<Size | "">("");
  const [pending, start] = useTransition();
  const canCancel = status === "placed" || status === "packed";

  const submit = () => start(async () => {
    const r = modal === "cancel" ? await cancelOrder(id, reason) : await requestReturn(id, modal as "return" | "exchange", reason, size || undefined);
    if (!r.ok) return toast(r.error, "err");
    toast(modal === "cancel" ? "Order cancelled" : "Request submitted — we'll schedule a pickup");
    setModal(null); router.refresh();
  });

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canCancel && <button onClick={() => { setReason(CANCEL_REASONS[0]); setModal("cancel"); }} className="btn-ghost text-red-600"><XCircle className="size-4" />Cancel order</button>}
        {returnable && <button onClick={() => { setReason(RETURN_REASONS[0]); setModal("return"); }} className="btn-ghost"><RotateCcw className="size-4" />Return</button>}
        {returnable && <button onClick={() => { setReason(RETURN_REASONS[0]); setModal("exchange"); }} className="btn-ghost"><RefreshCw className="size-4" />Exchange size</button>}
        <Link href="/account/support" className="btn-ghost"><LifeBuoy className="size-4" />Need help?</Link>
      </div>
      {status === "delivered" && !returnable && <p className="text-xs text-zinc-500">The {windowDays}-day return window for this order has closed.</p>}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "cancel" ? "Cancel order" : modal === "return" ? "Return items" : "Exchange for another size"}>
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="label">Reason</legend>
            {(modal === "cancel" ? CANCEL_REASONS : RETURN_REASONS).map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm"><input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-zinc-900" />{r}</label>
            ))}
          </fieldset>
          {modal === "exchange" && (
            <div><p className="label">New size (currently {sizes.join(", ")})</p><div className="flex flex-wrap gap-2">{SIZES.map((s) => <button key={s} onClick={() => setSize(s)} className={`chip text-xs ${size === s ? "chip-on" : ""}`}>{s}</button>)}</div></div>
          )}
          {modal !== "cancel" && <p className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-800/50">Free pickup from your delivery address. Refunds go to your original payment method within 5–7 days of pickup.</p>}
          <button onClick={submit} disabled={pending || (modal === "exchange" && !size)} className={modal === "cancel" ? "btn w-full bg-red-600 text-white hover:bg-red-700" : "btn-primary w-full"}>{pending ? "Submitting…" : modal === "cancel" ? "Confirm cancellation" : "Submit request"}</button>
        </div>
      </Modal>
    </>
  );
}
