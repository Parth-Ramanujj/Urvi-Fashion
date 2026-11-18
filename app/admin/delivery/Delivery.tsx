"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveDeliverySettings, setRiderCity } from "@/lib/admin-extra-actions";
import type { CityRule, DeliverySettings } from "@/lib/types";
import { useAct } from "../_ui";
import { Num, Toggle } from "../retention/Retention";

const n = (v: string) => (v === "" ? 0 : Number(v));

export function DeliveryForm({ initial }: { initial: DeliverySettings }) {
  const [s, setS] = useState(initial);
  const { pending, act } = useAct();
  const upd = (i: number, v: Partial<CityRule>) => setS({ ...s, cities: s.cities.map((c, j) => (j === i ? { ...c, ...v } : c)) });
  const range = (label: string, val: [number, number], on: (v: [number, number]) => void) => (
    <div><span className="label">{label}</span><div className="flex items-center gap-1">
      <input type="number" min={0} max={30} value={val[0]} onChange={(e) => on([n(e.target.value), val[1]])} className="input w-14 px-2" aria-label={`${label} min`} />–
      <input type="number" min={0} max={30} value={val[1]} onChange={(e) => on([val[0], n(e.target.value)])} className="input w-14 px-2" aria-label={`${label} max`} />
    </div></div>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); act(() => saveDeliverySettings(s), "Delivery settings saved"); }} className="space-y-4">
      <fieldset className="card space-y-3 p-5">
        <Toggle label="Only deliver to listed cities" on={s.restrictToCities} onChange={(v) => setS({ ...s, restrictToCities: v })} />
        <p className="text-xs text-zinc-500">{s.restrictToCities ? "Checkout blocks addresses outside the active cities below." : "Cities not listed below use these default fees and 4–6 day standard / 1–2 day express delivery."}</p>
        <div className="grid grid-cols-3 gap-3">
          <Num label="Default standard ₹" value={s.standardFee} onChange={(v) => setS({ ...s, standardFee: v })} />
          <Num label="Default express ₹" value={s.expressFee} onChange={(v) => setS({ ...s, expressFee: v })} />
          <Num label="Free standard over ₹" value={s.freeAbove} onChange={(v) => setS({ ...s, freeAbove: v })} />
        </div>
      </fieldset>
      <div className="space-y-3">
        {s.cities.map((c, i) => (
          <fieldset key={i} className={`card p-4 ${c.active ? "" : "opacity-70"}`}>
            <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4 lg:grid-cols-[1.4fr_repeat(4,auto)_auto]">
              <label className="col-span-2 sm:col-span-1"><span className="label">City</span><input value={c.name} onChange={(e) => upd(i, { name: e.target.value })} className="input" /></label>
              <label><span className="label">Standard ₹</span><input type="number" min={0} value={c.standardFee} onChange={(e) => upd(i, { standardFee: n(e.target.value) })} className="input w-24" /></label>
              {range("Std days", c.standardDays, (v) => upd(i, { standardDays: v }))}
              <label><span className="label">Express ₹</span><input type="number" min={0} value={c.expressFee} disabled={!c.express} onChange={(e) => upd(i, { expressFee: n(e.target.value) })} className="input w-24" /></label>
              {range("Exp days", c.expressDays, (v) => upd(i, { expressDays: v }))}
              <button type="button" onClick={() => setS({ ...s, cities: s.cities.filter((_, j) => j !== i) })} className="mb-1 justify-self-end rounded-full p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label={`Remove ${c.name}`}><Trash2 className="size-4" /></button>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              {([["active", "Active"], ["express", "Express available"], ["cod", "Cash on delivery"]] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={c[k]} onChange={(e) => upd(i, { [k]: e.target.checked })} className="size-4 accent-brand-500" />{l}</label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setS({ ...s, cities: [...s.cities, { id: "", name: "", active: true, standardFee: s.standardFee, expressFee: s.expressFee, standardDays: [2, 4], expressDays: [1, 2], express: true, cod: true }] })} className="btn-ghost"><Plus className="size-4" />Add city</button>
        <button disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save delivery settings"}</button>
      </div>
    </form>
  );
}

export function RiderCity({ id, city, cities }: { id: string; city: string; cities: string[] }) {
  const { pending, act } = useAct();
  return (
    <select disabled={pending} value={city} onChange={(e) => act(() => setRiderCity(id, e.target.value || null), "Rider city updated")} className="input w-auto py-1.5 text-xs" aria-label="Rider city">
      <option value="">Any city</option>
      {[...new Set([...cities, ...(city ? [city] : [])])].map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}
