"use client";
import { useState } from "react";
import { CalendarPlus, Plus, XCircle } from "lucide-react";
import { cancelMembership, extendMembership, saveMembership } from "@/lib/admin-extra-actions";
import type { MembershipPlan } from "@/lib/types";
import { useAct } from "../_ui";
import { Num, Toggle } from "../retention/Retention";

export function PlansEditor({ enabled: e0, plans: p0, sold }: { enabled: boolean; plans: MembershipPlan[]; sold: string[] }) {
  const [enabled, setEnabled] = useState(e0);
  const [plans, setPlans] = useState(p0);
  const { pending, act } = useAct();
  const upd = (i: number, v: Partial<MembershipPlan>) => setPlans(plans.map((p, j) => (j === i ? { ...p, ...v } : p)));
  return (
    <form onSubmit={(e) => { e.preventDefault(); act(() => saveMembership(enabled, plans), "Membership saved"); }} className="space-y-4">
      <div className="card p-5"><Toggle label="Membership program" on={enabled} onChange={setEnabled} /><p className="mt-1 text-xs text-zinc-500">When off, the membership page is hidden and existing members lose perks until it's back on.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((p, i) => (
          <fieldset key={i} className="card space-y-3 border-t-4 p-5" style={{ borderTopColor: p.color }}>
            <div className="flex items-center justify-between gap-3">
              <Toggle label={p.active ? "Active" : "Inactive"} on={p.active} onChange={(v) => upd(i, { active: v })} />
              {!sold.includes(p.id) && <button type="button" onClick={() => setPlans(plans.filter((_, j) => j !== i))} className="text-xs font-semibold text-red-600">Remove</button>}
            </div>
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <label><span className="label">Plan name</span><input value={p.name} onChange={(e) => upd(i, { name: e.target.value })} className="input" /></label>
              <input type="color" value={p.color} onChange={(e) => upd(i, { color: e.target.value })} className="h-10 w-10 cursor-pointer rounded-lg" aria-label="Plan colour" />
            </div>
            <label className="block"><span className="label">Tagline</span><input value={p.tagline} onChange={(e) => upd(i, { tagline: e.target.value })} className="input" /></label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Num label="Price ₹" value={p.price} onChange={(v) => upd(i, { price: v })} />
              <Num label="Days" value={p.days} onChange={(v) => upd(i, { days: v })} />
              <Num label="Member % off" value={p.discountPct} onChange={(v) => upd(i, { discountPct: v })} />
              <Num label="Coin ×" step={0.25} value={p.coinMultiplier} onChange={(v) => upd(i, { coinMultiplier: v })} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.freeDelivery} onChange={(e) => upd(i, { freeDelivery: e.target.checked })} className="size-4 accent-brand-500" />Free delivery on every order (standard & express)</label>
            {sold.includes(p.id) && <p className="text-xs text-zinc-500">Has members — deactivate instead of removing. Price changes apply to new purchases only.</p>}
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={plans.length >= 6} onClick={() => setPlans([...plans, { id: "", name: "New plan", price: 199, days: 90, discountPct: 5, freeDelivery: true, coinMultiplier: 1.5, color: "#0ea5e9", active: false, tagline: "" }])} className="btn-ghost"><Plus className="size-4" />Add plan</button>
        <button disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save membership"}</button>
      </div>
    </form>
  );
}

export function MemberActions({ userId, active }: { userId: string; active: boolean }) {
  const { pending, act } = useAct();
  return (
    <div className="flex gap-1.5">
      <button disabled={pending} onClick={() => act(() => extendMembership(userId, 30), "Extended by 30 days")} className="btn-ghost px-2.5 py-1 text-xs"><CalendarPlus className="size-3.5" />+30 days</button>
      {active && <button disabled={pending} onClick={() => confirm("End this membership now?") && act(() => cancelMembership(userId), "Membership cancelled")} className="btn-ghost px-2.5 py-1 text-xs text-red-600"><XCircle className="size-3.5" />Cancel</button>}
    </div>
  );
}
