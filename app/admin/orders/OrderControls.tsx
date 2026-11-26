"use client";
import { useState } from "react";
import { Check, MapPinPlus, Truck, X } from "lucide-react";
import { addTrackingCheckpoint, resolveReturn, updateOrder } from "@/lib/admin-actions";
import { FLOW, type OrderStatus } from "@/lib/types";
import { useAct } from "../_ui";

const LABEL: Record<string, string> = { placed: "Placed", packed: "Packed", shipped: "Shipped", out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled" };
const CLOSED = ["cancelled", "returned", "exchanged", "return_rejected", "return_requested", "exchange_requested"];

export default function OrderControls({
  id, status, partnerId, partners, hasReturn, trackingCode, courierName, trackingUrl, city,
}: {
  id: string; status: OrderStatus; partnerId: string; partners: { id: string; name: string }[]; hasReturn: boolean;
  trackingCode?: string; courierName?: string; trackingUrl?: string; city: string;
}) {
  const { pending, act } = useAct();
  const [openTrack, setOpenTrack] = useState(false);
  const [trk, setTrk] = useState(trackingCode ?? "");
  const [courier, setCourier] = useState(courierName ?? "Store Delivery");
  const [url, setUrl] = useState(trackingUrl ?? "");
  const [cpTitle, setCpTitle] = useState("");
  const [cpLoc, setCpLoc] = useState(city);
  const [cpNote, setCpNote] = useState("");

  if (hasReturn) return (
    <div className="flex gap-2">
      <button disabled={pending} onClick={() => act(() => resolveReturn(id, true), "Request approved")} className="btn-primary px-3 py-1.5 text-xs"><Check className="size-3.5" />Approve</button>
      <button disabled={pending} onClick={() => confirm("Reject this request?") && act(() => resolveReturn(id, false), "Request rejected")} className="btn-ghost px-3 py-1.5 text-xs text-red-600"><X className="size-3.5" />Reject</button>
    </div>
  );
  if (CLOSED.includes(status) || status === "delivered") return null;

  return (
    <div className="w-full space-y-2 sm:w-auto">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-zinc-500">Status
          <select disabled={pending} value={status} onChange={(e) => { const s = e.target.value as OrderStatus; if (s !== "cancelled" || confirm("Cancel this order and refund the customer?")) act(() => updateOrder(id, { status: s }), "Status updated"); }} className="input w-auto py-1.5 text-xs">
            {[...FLOW, "cancelled"].map((s) => <option key={s} value={s} disabled={FLOW.indexOf(s as OrderStatus) >= 0 && FLOW.indexOf(s as OrderStatus) < FLOW.indexOf(status)}>{LABEL[s]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500">Rider
          <select disabled={pending} value={partnerId} onChange={(e) => act(() => updateOrder(id, { deliveryPartnerId: e.target.value }), e.target.value ? "Delivery partner assigned" : "Unassigned")} className="input w-auto py-1.5 text-xs">
            <option value="">Unassigned</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setOpenTrack(!openTrack)} className="btn-ghost px-2.5 py-1.5 text-xs">
          <Truck className="size-3.5" />Tracking
        </button>
      </div>

      {openTrack && (
        <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900/50">
          <form onSubmit={(e) => { e.preventDefault(); act(() => updateOrder(id, { trackingCode: trk, courierName: courier, trackingUrl: url }), "Tracking info saved", () => setOpenTrack(false)); }} className="space-y-2">
            <p className="font-semibold">Courier & tracking ID</p>
            <input value={trk} onChange={(e) => setTrk(e.target.value)} placeholder="Tracking code (e.g. TRK-123456)" className="input py-1.5 font-mono text-xs" />
            <input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="Courier name (e.g. Store Delivery / Delhivery)" className="input py-1.5 text-xs" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="External tracking URL (optional)" className="input py-1.5 text-xs" />
            <button disabled={pending} className="btn-primary py-1.5 text-xs">Save courier</button>
          </form>

          <form onSubmit={(e) => { e.preventDefault(); act(() => addTrackingCheckpoint(id, { title: cpTitle, location: cpLoc, note: cpNote }), "Tracking update posted", () => { setCpTitle(""); setCpNote(""); }); }} className="space-y-2">
            <p className="flex items-center gap-1 font-semibold"><MapPinPlus className="size-3.5" />Post live update</p>
            <input required minLength={2} value={cpTitle} onChange={(e) => setCpTitle(e.target.value)} placeholder="Checkpoint (e.g. Reached Ahmedabad Hub)" className="input py-1.5 text-xs" />
            <input value={cpLoc} onChange={(e) => setCpLoc(e.target.value)} placeholder="Location" className="input py-1.5 text-xs" />
            <input value={cpNote} onChange={(e) => setCpNote(e.target.value)} placeholder="Note for customer (optional)" className="input py-1.5 text-xs" />
            <button disabled={pending} className="btn-primary py-1.5 text-xs">Add checkpoint</button>
          </form>
        </div>
      )}
    </div>
  );
}
