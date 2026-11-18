import Link from "next/link";
import { BellRing, Coins, Gift, Repeat, ShoppingBag, Users } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import { Money } from "@/components/ui";
import { db } from "@/lib/db";
import { PageTitle } from "../_ui";
import { AbandonedBags, AdjustCoins, SegmentCard, SettingsForm } from "./Retention";
import { segmentCustomers, SEGMENTS, type Segment } from "./segments";

export const dynamic = "force-dynamic";
export const metadata = { title: "Retention" };

const ago = (t: number) => { const h = Math.floor((Date.now() - t) / 3_600_000); return h < 1 ? "just now" : h < 48 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`; };

export default async function RetentionPage() {
  const d = db();
  const r = d.retention;
  const rows = segmentCustomers(d);
  const buyers = rows.filter((c) => c.orders > 0);
  const repeatRate = buyers.length ? Math.round((buyers.filter((c) => c.orders >= 2).length / buyers.length) * 100) : 0;
  const outstanding = d.users.reduce((s, u) => s + (u.coins ?? 0), 0);
  const since = Date.now() - 30 * 86_400_000;
  const redeemed30 = Math.abs(d.coinLedger.filter((e) => e.at >= since && e.reason === "Redeemed at checkout").reduce((s, e) => s + e.amount, 0));
  const referred = d.users.filter((u) => u.referredBy);
  const waiting = d.waitlist.filter((w) => !w.notifiedAt);
  const cutoff = Date.now() - r.abandonedCart.afterHours * 3_600_000;
  const bags = d.users.filter((u) => !u.blocked && u.cart?.items.length && u.cart.updatedAt <= cutoff)
    .map((u) => ({ id: u.id, name: u.name, contact: u.email ?? u.phone ?? "", items: u.cart!.items.map((i) => `${i.name} × ${i.qty}`), value: u.cart!.items.reduce((s, i) => s + i.price * i.qty, 0), age: ago(u.cart!.updatedAt), reminded: !!u.cart!.remindedAt && u.cart!.remindedAt >= u.cart!.updatedAt }))
    .sort((a, b) => b.value - a.value);
  const coupons = d.coupons.filter((c) => c.active && !c.userIds?.length && (!c.expiresAt || c.expiresAt > Date.now())).map((c) => c.code);

  // Back-in-stock demand grouped by variant.
  const demand = new Map<string, { productId: string; color: string; size: string; waiting: number }>();
  for (const w of waiting) {
    const k = `${w.productId}|${w.color}|${w.size}`;
    const e = demand.get(k) ?? { productId: w.productId, color: w.color, size: w.size, waiting: 0 };
    e.waiting++; demand.set(k, e);
  }
  const demandRows = [...demand.values()].sort((a, b) => b.waiting - a.waiting).map((e) => {
    const p = d.products.find((x) => x.id === e.productId);
    return { ...e, p, stock: p?.variants.find((v) => v.color === e.color && v.size === e.size)?.stock ?? 0, image: p?.colors.find((c) => c.name === e.color)?.images[0] ?? p?.colors[0].images[0] ?? "" };
  });

  const tierCounts = r.tiers.map((t) => ({ ...t, n: rows.filter((c) => c.tier.name === t.name).length }));
  const topHolders = [...rows].sort((a, b) => (b.user.coins ?? 0) - (a.user.coins ?? 0)).slice(0, 10);
  const kpis = [
    { label: "Repeat purchase rate", value: `${repeatRate}%`, sub: `${buyers.filter((c) => c.orders >= 2).length} of ${buyers.length} buyers`, icon: Repeat },
    { label: "Coins outstanding", value: <Money v={outstanding} />, sub: `${outstanding.toLocaleString("en-IN")} coins (liability)`, icon: Coins },
    { label: "Redeemed · 30 days", value: <Money v={redeemed30} />, sub: `${redeemed30.toLocaleString("en-IN")} coins`, icon: Gift },
    { label: "Referral sign-ups", value: referred.length, sub: `${referred.filter((u) => u.referralRewarded).length} converted to a delivered order`, icon: Users },
    { label: "Back-in-stock alerts", value: waiting.length, sub: `${d.waitlist.length - waiting.length} already notified`, icon: BellRing },
    { label: "Abandoned bags", value: bags.length, sub: <><Money v={bags.reduce((s, b) => s + b.value, 0)} /> waiting</>, icon: ShoppingBag },
  ];

  return (
    <div className="space-y-8">
      <PageTitle title="Retention" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {kpis.map(({ label, value, sub, icon: I }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-zinc-500">{label}<I className="size-4" /></div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Customer segments</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(SEGMENTS) as Segment[]).map((s) => {
            const mine = rows.filter((c) => c.segment === s);
            return <SegmentCard key={s} segment={s} label={SEGMENTS[s].label} hint={SEGMENTS[s].hint} count={mine.length} share={rows.length ? mine.length / rows.length : 0} avgSpend={mine.length ? Math.round(mine.reduce((a, c) => a + c.spend, 0) / mine.length) : 0} />;
          })}
        </div>
        <p className="mt-2 text-xs text-zinc-500">At risk = no order in {r.segments.atRiskDays}–{r.segments.churnDays} days · Churned = over {r.segments.churnDays} days · VIP = {r.segments.vipOrders}+ orders. Offers create a one-time personal coupon for everyone in the segment.</p>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Abandoned bags</h2>
        <p className="mb-3 text-sm text-zinc-500">Logged-in shoppers whose bag has been untouched for {r.abandonedCart.afterHours}h+.{!r.abandonedCart.enabled && " Reminders are switched off in settings."}</p>
        <AbandonedBags bags={bags} coupons={coupons} />
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Back-in-stock demand</h2>
        <p className="mb-3 text-sm text-zinc-500">Restocking a variant automatically notifies everyone waiting for it.</p>
        {demandRows.length === 0 ? <p className="card p-6 text-center text-sm text-zinc-500">No one is waiting on a sold-out size.</p> : (
          <div className="card divide-y divide-zinc-100 dark:divide-zinc-800">
            {demandRows.map((e) => (
              <div key={`${e.productId}${e.color}${e.size}`} className="flex items-center gap-3 p-3">
                <div className="h-14 w-11 shrink-0 overflow-hidden rounded-lg"><ProductImage src={e.image} alt="" /></div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{e.p?.name ?? "Deleted product"}</p><p className="text-xs text-zinc-500">{e.color} · {e.size} · stock {e.stock}</p></div>
                <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{e.waiting} waiting</span>
                {e.p && <Link href={`/admin/products/${e.productId}`} className="btn-ghost px-3 py-1.5 text-xs">Restock</Link>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Loyalty tiers</h2>
          <div className="space-y-3">
            {tierCounts.map((t) => (
              <div key={t.name}>
                <div className="flex justify-between text-sm"><span className="flex items-center gap-2 font-medium"><span className="size-3 rounded-full" style={{ background: t.color }} />{t.name} <span className="text-xs text-zinc-500">from <Money v={t.minSpend} /> · {t.multiplier}× coins</span></span><span className="tabular-nums">{t.n}</span></div>
                <div className="mt-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full" style={{ width: `${rows.length ? (t.n / rows.length) * 100 : 0}%`, background: t.color }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Top coin holders</h2>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {topHolders.map((c) => (
              <li key={c.user.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate"><b>{c.user.name}</b> <span className="text-xs" style={{ color: c.tier.color }}>{c.tier.name}</span></span>
                <span className="tabular-nums font-semibold">🪙 {(c.user.coins ?? 0).toLocaleString("en-IN")}</span>
                <AdjustCoins userId={c.user.id} name={c.user.name} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Program settings</h2>
        <SettingsForm initial={r} />
      </section>
    </div>
  );
}
