"use client";
import { useState } from "react";
import { Bell, Plus, Send, Trash2 } from "lucide-react";
import { useApp } from "@/components/Providers";
import { Modal, Money } from "@/components/ui";
import { adjustCoins, remindAbandonedCarts, saveRetentionSettings, sendSegmentOffer } from "@/lib/retention-admin";
import type { RetentionSettings } from "@/lib/types";
import { useAct } from "../_ui";
import type { Segment } from "./segments";

const PRESETS: Record<Segment, { title: string; body: string; type: "percent" | "flat"; value: number; minOrder: number; maxDiscount?: number }> = {
  new: { title: "Your next favourite is waiting ✨", body: "Thanks for your first order! Here's 10% off your second.", type: "percent", value: 10, minOrder: 999, maxDiscount: 300 },
  active: { title: "A little thank-you 💛", body: "You keep coming back — enjoy ₹250 off your next order.", type: "flat", value: 250, minOrder: 1999 },
  vip: { title: "VIP early access 👑", body: "As one of our best customers, take 15% off anything this week.", type: "percent", value: 15, minOrder: 0, maxDiscount: 1500 },
  at_risk: { title: "We miss you!", body: "It's been a while — here's 20% off to come back and see what's new.", type: "percent", value: 20, minOrder: 999, maxDiscount: 800 },
  churned: { title: "Come back for 25% off", body: "A lot has changed since your last visit. Here's 25% off on us.", type: "percent", value: 25, minOrder: 999, maxDiscount: 1000 },
  never: { title: "Your first order, on us 🎁", body: "Still browsing? Get ₹300 off your very first order.", type: "flat", value: 300, minOrder: 1499 },
};

export function SegmentCard({ segment, label, hint, count, share, avgSpend }: { segment: Segment; label: string; hint: string; count: number; share: number; avgSpend: number }) {
  const [open, setOpen] = useState(false);
  const { pending, act } = useAct();
  const { toast } = useApp();
  const p = PRESETS[segment];
  const [f, setF] = useState({ title: p.title, body: p.body, discountType: p.type, value: p.value, minOrder: p.minOrder, maxDiscount: p.maxDiscount ?? 0, validDays: 14 });
  const off = f.discountType === "percent" ? `${f.value}% off` : `₹${f.value} off`;
  return (
    <div className="card flex flex-col p-4">
      <div className="flex items-start justify-between"><div><p className="font-semibold">{label}</p><p className="text-xs text-zinc-500">{hint}</p></div><p className="text-2xl font-bold tabular-nums">{count}</p></div>
      <div className="my-3 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-brand-500" style={{ width: `${share * 100}%` }} /></div>
      <div className="mt-auto flex items-center justify-between text-xs text-zinc-500"><span>Avg spend <Money v={avgSpend} className="font-semibold text-zinc-900 dark:text-white" /></span>
        <button disabled={!count} onClick={() => setOpen(true)} className="btn-ghost px-3 py-1.5 text-xs"><Send className="size-3.5" />Send offer</button></div>
      <Modal open={open} onClose={() => setOpen(false)} title={`Offer to ${label} (${count})`}>
        <form onSubmit={(e) => { e.preventDefault(); act(() => sendSegmentOffer({ segment, ...f, maxDiscount: f.maxDiscount || undefined }), undefined, (r) => { setOpen(false); toast(`Sent to ${r.reach} customers · code ${r.code}`); }); }} className="space-y-3">
          <label className="block"><span className="label">Title</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} className="input" required /></label>
          <label className="block"><span className="label">Message</span><textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={240} rows={2} className="input" required /></label>
          <div className="grid grid-cols-2 gap-3">
            <label><span className="label">Type</span><select value={f.discountType} onChange={(e) => setF({ ...f, discountType: e.target.value as "percent" | "flat" })} className="input"><option value="percent">% off</option><option value="flat">₹ off</option></select></label>
            <label><span className="label">Value</span><input type="number" min={1} value={f.value} onChange={(e) => setF({ ...f, value: +e.target.value })} className="input" required /></label>
            <label><span className="label">Min order ₹</span><input type="number" min={0} value={f.minOrder} onChange={(e) => setF({ ...f, minOrder: +e.target.value })} className="input" /></label>
            {f.discountType === "percent" ? <label><span className="label">Max discount ₹</span><input type="number" min={0} value={f.maxDiscount} onChange={(e) => setF({ ...f, maxDiscount: +e.target.value })} className="input" /></label> : <span />}
            <label><span className="label">Valid days</span><input type="number" min={1} max={90} value={f.validDays} onChange={(e) => setF({ ...f, validDays: +e.target.value })} className="input" /></label>
          </div>
          <div className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
            <p className="label">Preview</p>
            <div className="flex gap-2"><Bell className="mt-0.5 size-4 text-brand-500" /><div><p className="text-sm font-medium">{f.title}</p><p className="text-xs text-zinc-500">{f.body} Use code WB-XXXXXX.</p><p className="mt-1 text-[11px] text-zinc-400">{off}{f.minOrder ? ` over ₹${f.minOrder}` : ""} · one use per customer · {f.validDays} days</p></div></div>
          </div>
          <button disabled={pending} className="btn-brand w-full">{pending ? "Sending…" : `Send to ${count} customers`}</button>
        </form>
      </Modal>
    </div>
  );
}

type Bag = { id: string; name: string; contact: string; items: string[]; value: number; age: string; reminded: boolean };
export function AbandonedBags({ bags, coupons }: { bags: Bag[]; coupons: string[] }) {
  const { pending, act } = useAct();
  const { toast } = useApp();
  const [sel, setSel] = useState<string[]>([]);
  const [code, setCode] = useState("");
  if (!bags.length) return <p className="card p-6 text-center text-sm text-zinc-500">No abandoned bags right now.</p>;
  const remind = (ids: string[]) => act(() => remindAbandonedCarts(ids, code || undefined), undefined, (r) => { setSel([]); toast(`Reminder sent to ${r.count} shopper${r.count === 1 ? "" : "s"}`); });
  const open = bags.filter((b) => !b.reminded).map((b) => b.id);
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
        <select value={code} onChange={(e) => setCode(e.target.value)} className="input w-auto py-1.5 text-xs" aria-label="Coupon to include"><option value="">No coupon</option>{coupons.map((c) => <option key={c}>{c}</option>)}</select>
        <button disabled={pending || !sel.length} onClick={() => remind(sel)} className="btn-primary px-3 py-1.5 text-xs"><Send className="size-3.5" />Remind selected ({sel.length})</button>
        <button disabled={pending || !open.length} onClick={() => remind(open)} className="btn-ghost px-3 py-1.5 text-xs">Remind all not yet reminded ({open.length})</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500"><tr><th className="w-10 p-3"><input type="checkbox" aria-label="Select all" checked={sel.length === bags.length} onChange={(e) => setSel(e.target.checked ? bags.map((b) => b.id) : [])} /></th><th>Customer</th><th>Items</th><th>Value</th><th>Idle</th><th className="p-3" /></tr></thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {bags.map((b) => (
              <tr key={b.id}>
                <td className="p-3"><input type="checkbox" aria-label={`Select ${b.name}`} checked={sel.includes(b.id)} onChange={(e) => setSel(e.target.checked ? [...sel, b.id] : sel.filter((x) => x !== b.id))} /></td>
                <td><p className="font-medium">{b.name}</p><p className="text-xs text-zinc-500">{b.contact}</p></td>
                <td className="max-w-60 text-xs text-zinc-600 dark:text-zinc-400">{b.items.join(", ")}</td>
                <td><Money v={b.value} className="font-semibold" /></td>
                <td className="text-zinc-500">{b.age}</td>
                <td className="p-3 text-right">{b.reminded ? <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Reminded</span> : <button disabled={pending} onClick={() => remind([b.id])} className="btn-ghost px-3 py-1 text-xs">Remind</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdjustCoins({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState("Goodwill credit");
  const { pending, act } = useAct();
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost px-2.5 py-1 text-xs">Adjust</button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Adjust coins · ${name}`}>
        <form onSubmit={(e) => { e.preventDefault(); act(() => adjustCoins(userId, amount, reason), "Coins updated", () => setOpen(false)); }} className="space-y-3">
          <label className="block"><span className="label">Coins (negative to deduct)</span><input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} className="input" required /></label>
          <label className="block"><span className="label">Reason (visible to customer)</span><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} className="input" required /></label>
          <button disabled={pending || !amount} className="btn-primary w-full">{amount >= 0 ? `Add ${amount} coins` : `Deduct ${-amount} coins`}</button>
        </form>
      </Modal>
    </>
  );
}

const n = (v: string) => (v === "" ? 0 : Number(v));
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <label className="flex cursor-pointer items-center justify-between gap-3 font-semibold">{label}<input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-brand-500" /></label>;
}
export function Num({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return <label><span className="label">{label}</span><input type="number" step={step} value={value} onChange={(e) => onChange(n(e.target.value))} className="input" /></label>;
}

export function SettingsForm({ initial }: { initial: RetentionSettings }) {
  const [s, setS] = useState(initial);
  const { pending, act } = useAct();
  const set = <K extends keyof RetentionSettings>(k: K, v: Partial<RetentionSettings[K]>) => setS({ ...s, [k]: { ...s[k], ...v } });
  const n = (v: string) => (v === "" ? 0 : Number(v));
  return (
    <form onSubmit={(e) => { e.preventDefault(); act(() => saveRetentionSettings(s), "Retention settings saved"); }} className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <fieldset className="card space-y-3 p-5">
          <Toggle label="Loyalty coins" on={s.loyalty.enabled} onChange={(v) => set("loyalty", { enabled: v })} />
          <div className="grid grid-cols-3 gap-3">
            <Num label="Coins / ₹100" step={0.5} value={s.loyalty.earnPer100} onChange={(v) => set("loyalty", { earnPer100: v })} />
            <Num label="Max redeem %" value={s.loyalty.maxRedeemPct} onChange={(v) => set("loyalty", { maxRedeemPct: v })} />
            <Num label="Welcome coins" value={s.loyalty.welcomeCoins} onChange={(v) => set("loyalty", { welcomeCoins: v })} />
          </div>
          <p className="text-xs text-zinc-500">1 coin = ₹1. Coins are credited when an order is delivered and taken back if it's returned.</p>
        </fieldset>
        <fieldset className="card space-y-3 p-5">
          <Toggle label="Refer & earn" on={s.referral.enabled} onChange={(v) => set("referral", { enabled: v })} />
          <label><span className="label">Referrer reward type</span>
            <select value={s.referral.rewardType ?? "coins"} onChange={(e) => set("referral", { rewardType: e.target.value as "coins" | "coupon" })} className="input"><option value="coins">Coins</option><option value="coupon">₹ coupon</option></select></label>
          <div className="grid grid-cols-2 gap-3">
            <Num label={s.referral.rewardType === "coupon" ? "Referrer coupon ₹" : "Referrer gets (coins)"} value={s.referral.referrerCoins} onChange={(v) => set("referral", { referrerCoins: v })} />
            <Num label="New member gets (coins)" value={s.referral.refereeCoins} onChange={(v) => set("referral", { refereeCoins: v })} />
          </div>
          <p className="text-xs text-zinc-500">The referrer is rewarded once their friend's first order is delivered{s.referral.rewardType === "coupon" ? " — as a personal one-time ₹ coupon valid 60 days." : "."}</p>
        </fieldset>
        {s.birthday && (
          <fieldset className="card space-y-3 p-5">
            <Toggle label="Birthday reward 🎂" on={s.birthday.enabled} onChange={(v) => set("birthday", { enabled: v })} />
            <div className="grid grid-cols-3 gap-3">
              <label><span className="label">Type</span><select value={s.birthday.type} onChange={(e) => set("birthday", { type: e.target.value as "percent" | "flat" })} className="input"><option value="percent">% off</option><option value="flat">₹ off</option></select></label>
              <Num label={s.birthday.type === "percent" ? "Discount %" : "Discount ₹"} value={s.birthday.value} onChange={(v) => set("birthday", { value: v })} />
              <Num label="Valid days" value={s.birthday.validDays} onChange={(v) => set("birthday", { validDays: v })} />
            </div>
            <p className="text-xs text-zinc-500">Customers who saved a date of birth get a personal coupon once a year, in their birthday month.</p>
          </fieldset>
        )}
        {s.social && (
          <fieldset className="card space-y-3 p-5 lg:col-span-2">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1"><Toggle label="Social follow reward" on={s.social.enabled} onChange={(v) => set("social", { enabled: v })} /></div>
              <div className="w-40"><Num label="Coins per platform" value={s.social.coins} onChange={(v) => set("social", { coins: v })} /></div>
            </div>
            {s.social.links.map((l, i) => {
              const upd = (v: Partial<typeof l>) => set("social", { links: s.social!.links.map((x, j) => (j === i ? { ...x, ...v } : x)) });
              return (
                <div key={i} className="grid grid-cols-[1fr_1fr_2fr_auto] items-end gap-2">
                  <label><span className="label">Id</span><input value={l.id} onChange={(e) => upd({ id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} className="input" /></label>
                  <label><span className="label">Label</span><input value={l.label} onChange={(e) => upd({ label: e.target.value })} className="input" /></label>
                  <label><span className="label">URL</span><input type="url" value={l.url} onChange={(e) => upd({ url: e.target.value })} placeholder="https://instagram.com/yourshop" className="input" /></label>
                  <button type="button" onClick={() => set("social", { links: s.social!.links.filter((_, j) => j !== i) })} className="mb-1 rounded-full p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label={`Remove ${l.label}`}><Trash2 className="size-4" /></button>
                </div>
              );
            })}
            <button type="button" disabled={s.social.links.length >= 8} onClick={() => set("social", { links: [...s.social!.links, { id: "", label: "", url: "https://" }] })} className="btn-ghost px-3 py-1.5 text-xs"><Plus className="size-3.5" />Add platform</button>
            <p className="text-xs text-zinc-500">Customers tap Follow in Rewards and get the coins once per platform. Follows can't be verified, so keep the reward small.</p>
          </fieldset>
        )}
        <fieldset className="card space-y-3 p-5">
          <Toggle label="Back-in-stock alerts" on={s.backInStock.enabled} onChange={(v) => set("backInStock", { enabled: v })} />
          <Toggle label="Abandoned-bag reminders" on={s.abandonedCart.enabled} onChange={(v) => set("abandonedCart", { enabled: v })} />
          <Num label="Bag counts as abandoned after (hours)" value={s.abandonedCart.afterHours} onChange={(v) => set("abandonedCart", { afterHours: v })} />
        </fieldset>
        <fieldset className="card space-y-3 p-5">
          <p className="font-semibold">Segment thresholds</p>
          <div className="grid grid-cols-3 gap-3">
            <Num label="At risk after (days)" value={s.segments.atRiskDays} onChange={(v) => set("segments", { atRiskDays: v })} />
            <Num label="Churned after (days)" value={s.segments.churnDays} onChange={(v) => set("segments", { churnDays: v })} />
            <Num label="VIP from (orders)" value={s.segments.vipOrders} onChange={(v) => set("segments", { vipOrders: v })} />
          </div>
        </fieldset>
      </div>
      <fieldset className="card p-5">
        <div className="mb-3 flex items-center justify-between"><p className="font-semibold">Tiers</p>
          <button type="button" disabled={s.tiers.length >= 6} onClick={() => setS({ ...s, tiers: [...s.tiers, { name: "New tier", minSpend: (s.tiers.at(-1)?.minSpend ?? 0) + 10000, multiplier: 1, color: "#71717a" }] })} className="btn-ghost px-3 py-1.5 text-xs"><Plus className="size-3.5" />Add tier</button></div>
        <div className="space-y-2">
          {s.tiers.map((t, i) => {
            const upd = (v: Partial<typeof t>) => setS({ ...s, tiers: s.tiers.map((x, j) => (j === i ? { ...x, ...v } : x)) });
            return (
              <div key={i} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] items-end gap-2">
                <input type="color" value={t.color} onChange={(e) => upd({ color: e.target.value })} className="h-10 w-10 cursor-pointer rounded-lg" aria-label={`${t.name} colour`} />
                <label><span className="label">Name</span><input value={t.name} onChange={(e) => upd({ name: e.target.value })} className="input" /></label>
                <label><span className="label">Min spend ₹</span><input type="number" value={i === 0 ? 0 : t.minSpend} disabled={i === 0} onChange={(e) => upd({ minSpend: n(e.target.value) })} className="input" /></label>
                <label><span className="label">Coin ×</span><input type="number" step={0.25} value={t.multiplier} onChange={(e) => upd({ multiplier: n(e.target.value) })} className="input" /></label>
                <button type="button" disabled={s.tiers.length <= 1} onClick={() => setS({ ...s, tiers: s.tiers.filter((_, j) => j !== i) })} className="mb-1 rounded-full p-2 text-red-600 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-900/20" aria-label={`Remove ${t.name}`}><Trash2 className="size-4" /></button>
              </div>
            );
          })}
        </div>
      </fieldset>
      <button disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
