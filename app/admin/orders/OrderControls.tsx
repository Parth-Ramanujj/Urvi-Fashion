"use client";
import { Check, X } from "lucide-react";
import { resolveReturn, updateOrder } from "@/lib/admin-actions";
import { FLOW, type OrderStatus } from "@/lib/types";
import { useAct } from "../_ui";

const LABEL: Record<string, string> = { placed: "Placed", packed: "Packed", shipped: "Shipped", out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled" };
const CLOSED = ["cancelled", "returned", "exchanged", "return_rejected", "return_requested", "exchange_requested"];

export default function OrderControls({ id, status, partnerId, partners, hasReturn }: { id: string; status: OrderStatus; partnerId: string; partners: { id: string; name: string }[]; hasReturn: boolean }) {
  const { pending, act } = useAct();
  if (hasReturn) return (
    <div className="flex gap-2">
      <button disabled={pending} onClick={() => act(() => resolveReturn(id, true), "Request approved")} className="btn-primary px-3 py-1.5 text-xs"><Check className="size-3.5" />Approve</button>
      <button disabled={pending} onClick={() => confirm("Reject this request?") && act(() => resolveReturn(id, false), "Request rejected")} className="btn-ghost px-3 py-1.5 text-xs text-red-600"><X className="size-3.5" />Reject</button>
    </div>
  );
  if (CLOSED.includes(status) || status === "delivered") return null;
  return (
    <div className="flex flex-wrap gap-2">
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
    </div>
  );
}
