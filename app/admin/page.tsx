import Link from "next/link";
import { AlertTriangle, IndianRupee, ShoppingCart, TrendingUp, Users } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import { Money } from "@/components/ui";
import { db } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/server-utils";
import type { OrderStatus } from "@/lib/types";
import { PageTitle, STATUS_TONE } from "./_ui";
import QuickRestock from "./QuickRestock";

const DAY = 86_400_000;
const EXCLUDED = ["cancelled", "returned"];

export default function Dashboard() {
  const d = db();
  const now = Date.now();
  const counted = d.orders.filter((o) => !EXCLUDED.includes(o.status));
  const sales = counted.reduce((s, o) => s + o.totals.total, 0);
  const active = d.users.filter((u) => now - u.lastActiveAt < 30 * DAY).length;
  const prev = counted.filter((o) => now - o.createdAt >= 14 * DAY && now - o.createdAt < 28 * DAY).reduce((s, o) => s + o.totals.total, 0);

  const start = new Date(); start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 14 }, (_, i) => {
    const from = start.getTime() - (13 - i) * DAY;
    const os = counted.filter((o) => o.createdAt >= from && o.createdAt < from + DAY);
    return { from, revenue: os.reduce((s, o) => s + o.totals.total, 0), orders: os.length };
  });
  const last14 = days.reduce((s, x) => s + x.revenue, 0);
  const peak = Math.max(1, ...days.map((x) => x.revenue));
  const growth = prev ? Math.round(((last14 - prev) / prev) * 100) : 0;

  const byStatus = Object.entries(d.orders.reduce<Record<string, number>>((m, o) => ((m[o.status] = (m[o.status] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
  const low = d.products.filter((p) => p.active).flatMap((p) => p.variants.filter((v) => v.stock <= 3).map((v) => ({ p, v }))).sort((a, b) => a.v.stock - b.v.stock);
  const sold = new Map<string, { qty: number; revenue: number }>();
  for (const o of counted) for (const it of o.items) { const s = sold.get(it.productId) ?? { qty: 0, revenue: 0 }; s.qty += it.qty; s.revenue += it.price * it.qty; sold.set(it.productId, s); }
  const top = [...sold].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5).map(([id, s]) => ({ p: d.products.find((x) => x.id === id), ...s })).filter((x) => x.p);
  const today = d.orders.filter((o) => o.createdAt >= start.getTime());
  const recent = [...d.orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const userName = (id: string) => d.users.find((u) => u.id === id)?.name ?? "—";

  const kpis = [
    { label: "Total sales", value: <Money v={sales} />, icon: IndianRupee, sub: "Excl. cancelled & returned" },
    { label: "Total orders", value: d.orders.length.toLocaleString(), icon: ShoppingCart, sub: `${d.orders.filter((o) => o.status === "placed").length} awaiting packing` },
    { label: "Active users", value: active.toLocaleString(), icon: Users, sub: `of ${d.users.length} registered · 30 days` },
    { label: "Avg. order value", value: <Money v={counted.length ? Math.round(sales / counted.length) : 0} />, icon: TrendingUp, sub: `${growth >= 0 ? "+" : ""}${growth}% revenue vs prior 14d` },
  ];

  return (
    <div className="space-y-6">
      <PageTitle title="Overview" />
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Today">
        {[
          ["Orders today", today.length.toLocaleString("en-IN"), "/admin/orders"],
          ["Revenue today", <Money key="r" v={today.filter((o) => !EXCLUDED.includes(o.status)).reduce((s, o) => s + o.totals.total, 0)} />, "/admin/orders"],
          ["To pack", d.orders.filter((o) => o.status === "placed").length.toLocaleString("en-IN"), "/admin/orders?status=placed"],
          ["Returns to review", d.orders.filter((o) => ["return_requested", "exchange_requested"].includes(o.status)).length.toLocaleString("en-IN"), "/admin/orders?status=returns"],
        ].map(([l, v, href]) => (
          <Link key={l as string} href={href as string} className="min-w-36 flex-1 rounded-2xl bg-zinc-900 p-4 text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
            <p className="text-xs font-medium opacity-70">{l}</p><p className="mt-1 text-2xl font-bold tabular-nums">{v}</p>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, sub }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center justify-between text-zinc-500"><span className="text-xs font-semibold uppercase tracking-wide">{label}</span><Icon className="size-4" /></div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-zinc-500">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2" aria-labelledby="rev-h">
          <div className="flex items-baseline justify-between"><h2 id="rev-h" className="font-semibold">Revenue · last 14 days</h2><Money v={last14} className="text-sm font-semibold text-zinc-500" /></div>
          <div className="mt-6 flex h-56 items-end gap-1.5 sm:gap-2" role="list">
            {days.map((x) => {
              const label = new Date(x.from).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
              return (
                <div key={x.from} role="listitem" aria-label={`${label}: ${x.orders} orders`} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-zinc-900 px-2 py-1 text-[11px] text-white opacity-0 transition group-hover:opacity-100 dark:bg-white dark:text-zinc-900">
                    <Money v={x.revenue} /> · {x.orders} orders
                  </div>
                  <div className="w-full rounded-t-md bg-brand-500/80 transition group-hover:bg-brand-500" style={{ height: `${Math.max(2, (x.revenue / peak) * 100)}%` }} />
                  <span className="mt-1.5 text-center text-[10px] text-zinc-500">{new Date(x.from).getDate()}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card p-5" aria-labelledby="st-h">
          <h2 id="st-h" className="font-semibold">Orders by status</h2>
          <ul className="mt-4 space-y-3">
            {byStatus.map(([s, n]) => (
              <li key={s}>
                <div className="flex justify-between text-sm"><span>{STATUS_LABEL[s as OrderStatus]}</span><span className="tabular-nums text-zinc-500">{n}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-zinc-900 dark:bg-white" style={{ width: `${(n / d.orders.length) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5" aria-labelledby="low-h">
          <h2 id="low-h" className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-amber-500" />Quick restock <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{low.length}</span></h2>
          <p className="mt-1 text-xs text-zinc-500">Low-stock variants. Saving a restock also alerts customers waiting for it.</p>
          <ul className="mt-2 max-h-96 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
            {low.length === 0 && <li className="py-6 text-center text-sm text-zinc-500">All variants are well stocked.</li>}
            {low.map(({ p, v }) => <QuickRestock key={v.sku} productId={p.id} sku={v.sku} name={p.name} variant={`${v.color} · ${v.size}`} stock={v.stock} />)}
          </ul>
        </section>

        <section className="card p-5 lg:col-span-2" aria-labelledby="rec-h">
          <div className="flex items-center justify-between"><h2 id="rec-h" className="font-semibold">Recent orders</h2><Link href="/admin/orders" className="text-sm text-brand-600">View all</Link></div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500"><tr><th className="py-2 font-semibold">Order</th><th className="font-semibold">Customer</th><th className="font-semibold">Status</th><th className="text-right font-semibold">Total</th></tr></thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2.5"><Link href={`/admin/orders?q=${o.ref}`} className="font-mono text-xs font-semibold hover:text-brand-600">{o.ref}</Link><div className="text-xs text-zinc-500">{new Date(o.createdAt).toLocaleDateString("en-IN")}</div></td>
                    <td>{userName(o.userId)}</td>
                    <td><span className={`badge ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                    <td className="text-right font-semibold"><Money v={o.totals.total} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card p-5" aria-labelledby="top-h">
        <h2 id="top-h" className="font-semibold">Top products by revenue</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {top.map(({ p, qty, revenue }) => (
            <li key={p!.id}>
              <Link href={`/admin/products/${p!.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 lg:flex-col lg:items-start">
                <div className="size-14 shrink-0 overflow-hidden rounded-lg lg:aspect-[4/5] lg:size-auto lg:w-full"><ProductImage src={p!.colors[0].images[0]} alt={p!.name} /></div>
                <div className="min-w-0"><p className="truncate text-sm font-medium">{p!.name}</p><p className="text-xs text-zinc-500">{qty} sold · <Money v={revenue} /></p></div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
