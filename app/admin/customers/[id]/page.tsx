import Link from "next/link";
import { notFound } from "next/navigation";
import ProductImage from "@/components/ProductImage";
import { Money } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { activePlan, lifetimeSpend, tierOf } from "@/lib/retention-core";
import { STATUS_LABEL } from "@/lib/server-utils";
import { AdjustCoins } from "../../retention/Retention";
import { segmentCustomers, SEGMENTS } from "../../retention/segments";
import { PageTitle, STATUS_TONE } from "../../_ui";
import UserControls from "../UserControls";
import CustomerCrm from "./CustomerCrm";
import PersonalCoupon from "./PersonalCoupon";

export const dynamic = "force-dynamic";
const DAY = 86_400_000;
const date = (t?: number | null) => (t ? new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

function Bars({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <section className="card p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-zinc-500">—</p> : rows.map(([k, v]) => (
        <div key={k} className="mb-2 text-sm">
          <div className="flex justify-between"><span className="capitalize">{k}</span><span className="tabular-nums text-zinc-500">{v}</span></div>
          <div className="mt-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${(v / max) * 100}%` }} /></div>
        </div>
      ))}
    </section>
  );
}

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = db();
  const u = d.users.find((x) => x.id === id);
  if (!u) notFound();
  const me = await currentUser();
  const all = d.orders.filter((o) => o.userId === u.id).sort((a, b) => b.createdAt - a.createdAt);
  const orders = all.filter((o) => o.status !== "cancelled");
  const spend = lifetimeSpend(d, u.id);
  const times = orders.map((o) => o.createdAt).sort((a, b) => a - b);
  const gaps = times.slice(1).map((t, i) => (t - times[i]) / DAY);
  const returned = orders.filter((o) => ["returned", "return_requested", "exchange_requested", "exchanged"].includes(o.status)).length;
  const { tier } = tierOf(spend, d.retention.tiers);
  const seg = segmentCustomers(d).find((c) => c.user.id === u.id)?.segment;
  const plan = activePlan(d, u);

  // Product purchase history: how many separate orders contained each product.
  const prod = new Map<string, { slug: string; name: string; image: string; times: number; qty: number; sizes: Set<string>; last: number; category?: string; brand: string }>();
  for (const o of orders) for (const [i, it] of o.items.entries()) {
    const p = prod.get(it.productId) ?? { slug: it.slug, name: it.name, image: it.image, times: 0, qty: 0, sizes: new Set<string>(), last: 0, category: d.products.find((x) => x.id === it.productId)?.category, brand: it.brand };
    if (o.items.findIndex((x) => x.productId === it.productId) === i) p.times++; // once per order
    p.qty += it.qty; p.sizes.add(it.size); p.last = Math.max(p.last, o.createdAt);
    prod.set(it.productId, p);
  }
  const products = [...prod.values()].sort((a, b) => b.times - a.times || b.qty - a.qty);
  const tally = (key: (p: (typeof products)[number]) => string | undefined) => {
    const m = new Map<string, number>();
    products.forEach((p) => { const k = key(p); if (k) m.set(k, (m.get(k) ?? 0) + p.qty); });
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 6);
  };
  const ledger = d.coinLedger.filter((e) => e.userId === u.id).sort((a, b) => b.at - a.at).slice(0, 20);
  const waits = d.waitlist.filter((w) => w.userId === u.id).map((w) => ({ ...w, p: d.products.find((p) => p.id === w.productId) }));

  const kpis: [string, React.ReactNode][] = [
    ["Orders", orders.length], ["Total spend", <Money key="s" v={spend} />], ["Avg order", <Money key="a" v={orders.length ? Math.round(orders.reduce((s, o) => s + o.totals.total, 0) / orders.length) : 0} />],
    ["First order", date(times[0])], ["Last order", date(times.at(-1))], ["Avg days between orders", gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : "—"],
    ["Return rate", orders.length ? `${Math.round((returned / orders.length) * 100)}%` : "—"], ["Coins", `🪙 ${(u.coins ?? 0).toLocaleString("en-IN")}`],
  ];

  return (
    <div>
      <Link href="/admin/customers" className="text-sm text-zinc-500 hover:underline">← Customers</Link>
      <PageTitle title={u.name}>
        <div className="flex flex-wrap items-center gap-2">
          {u.role === "customer" && <><PersonalCoupon userId={u.id} name={u.name} /><AdjustCoins userId={u.id} name={u.name} /></>}
          <UserControls id={u.id} role={u.role} blocked={u.blocked} self={u.id === me?.id} />
        </div>
      </PageTitle>
      <div className="-mt-4 mb-6 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
        <span>{[u.email, u.phone].filter(Boolean).join(" · ")}</span>
        <span>· Joined {date(u.createdAt)} · Last active {date(u.lastActiveAt)}</span>
        {u.blocked && <span className="badge bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Blocked</span>}
        <span className="badge bg-zinc-100 capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{u.role}</span>
        {u.role === "customer" && <span className="badge text-white" style={{ background: tier.color }}>{tier.name}</span>}
        {seg && <span className="badge bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">{SEGMENTS[seg].label}</span>}
        {plan ? <span className="badge text-white" style={{ background: plan.color }}>👑 {plan.name} · until {date(u.membership!.expiresAt)}</span> : u.membership && <span className="badge bg-zinc-100 text-zinc-500 dark:bg-zinc-800">Membership expired</span>}
        {u.dob && <span>· 🎂 {new Date(u.dob).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map(([l, v]) => <div key={l} className="card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{l}</p><p className="mt-1.5 text-xl font-bold tabular-nums">{v}</p></div>)}
      </div>

      <CustomerCrm userId={u.id} name={u.name} phone={u.phone} crm={u.crm} />

      <section className="card mt-6 overflow-x-auto">
        <h2 className="p-5 pb-3 font-semibold">Products bought <span className="text-sm font-normal text-zinc-500">({products.length})</span></h2>
        {products.length === 0 ? <p className="px-5 pb-5 text-sm text-zinc-500">No purchases yet.</p> : (
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-y border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800"><tr><th className="p-3">Product</th><th>Times bought</th><th>Total qty</th><th>Sizes</th><th className="p-3">Last bought</th></tr></thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {products.map((p) => (
                <tr key={p.slug}>
                  <td className="p-3"><Link href={`/product/${p.slug}`} target="_blank" className="flex items-center gap-3 hover:underline"><span className="h-12 w-10 shrink-0 overflow-hidden rounded-lg"><ProductImage src={p.image} alt={p.name} /></span><span><span className="block font-medium">{p.name}</span><span className="text-xs text-zinc-500">{p.brand}</span></span></Link></td>
                  <td><span className={`badge ${p.times > 1 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>{p.times}×</span></td>
                  <td className="tabular-nums">{p.qty}</td>
                  <td>{[...p.sizes].join(", ")}</td>
                  <td className="p-3 text-zinc-500">{date(p.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Bars title="Favourite categories (items)" rows={tally((p) => p.category)} />
        <Bars title="Favourite brands (items)" rows={tally((p) => p.brand)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="p-5 pb-3 font-semibold">Orders <span className="text-sm font-normal text-zinc-500">({all.length})</span></h2>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {all.slice(0, 25).map((o) => (
              <li key={o.id}><Link href={`/admin/orders?q=${o.ref}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <span><span className="font-mono font-semibold">{o.ref}</span><span className="block text-xs text-zinc-500">{date(o.createdAt)} · {o.items.reduce((s, i) => s + i.qty, 0)} items · {o.address.city}</span></span>
                <span className="text-right"><Money v={o.totals.total} className="block font-semibold" /><span className={`badge ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span></span>
              </Link></li>
            ))}
            {all.length === 0 && <li className="px-5 pb-5 text-sm text-zinc-500">No orders.</li>}
          </ul>
        </section>
        <div className="space-y-6">
          <section className="card">
            <h2 className="p-5 pb-3 font-semibold">Coin history</h2>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {ledger.map((e) => <li key={e.id} className="flex justify-between gap-3 px-5 py-2.5 text-sm"><span><span className="block">{e.reason}</span><span className="text-xs text-zinc-500">{date(e.at)}</span></span><span className={`shrink-0 font-semibold tabular-nums ${e.amount > 0 ? "text-emerald-600" : "text-red-600"}`}>{e.amount > 0 ? "+" : ""}{e.amount}</span></li>)}
              {ledger.length === 0 && <li className="px-5 pb-5 text-sm text-zinc-500">No coin activity.</li>}
            </ul>
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Waiting for restock</h2>
            {waits.length === 0 ? <p className="text-sm text-zinc-500">Nothing.</p> : (
              <ul className="space-y-1.5 text-sm">{waits.map((w) => <li key={w.id} className="flex justify-between gap-3"><span>{w.p?.name ?? "Removed product"} · {w.color} · {w.size}</span><span className={w.notifiedAt ? "text-emerald-600" : "text-amber-600"}>{w.notifiedAt ? "notified" : "waiting"}</span></li>)}</ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
