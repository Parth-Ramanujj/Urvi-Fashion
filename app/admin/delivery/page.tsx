import { db } from "@/lib/db";
import { DEFAULT_DELIVERY } from "@/lib/retention-core";
import { PageTitle } from "../_ui";
import { AddDeliveryPartner, DeliveryForm, RiderCity } from "./Delivery";

export const dynamic = "force-dynamic";
export const metadata = { title: "Delivery" };
const OPEN = ["placed", "packed", "shipped", "out_for_delivery"];

export default async function DeliveryAdmin() {
  const d = db();
  const s = d.delivery ?? DEFAULT_DELIVERY;
  const since = Date.now() - 30 * 86_400_000;
  const key = (c: string) => c.trim().toLowerCase();
  const stats = new Map<string, { name: string; recent: number; open: number }>();
  for (const o of d.orders) {
    const k = key(o.address.city);
    const st = stats.get(k) ?? { name: o.address.city.trim(), recent: 0, open: 0 };
    if (o.createdAt >= since && o.status !== "cancelled") st.recent++;
    if (OPEN.includes(o.status)) st.open++;
    stats.set(k, st);
  }
  const listed = new Set(s.cities.map((c) => key(c.name)));
  const rows = [...stats.values()].sort((a, b) => b.recent - a.recent);
  const riders = d.users.filter((u) => u.role === "delivery");
  const cityNames = s.cities.map((c) => c.name);

  return (
    <div>
      <PageTitle title="Delivery & cities" />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Cities & fees</h2>
          <DeliveryForm initial={s} />
        </section>
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Orders by city</h2>
            {rows.length === 0 ? <p className="text-sm text-zinc-500">No orders yet.</p> : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-zinc-500"><tr><th className="pb-2">City</th><th className="pb-2 text-right">30 days</th><th className="pb-2 text-right">Open</th></tr></thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {rows.slice(0, 15).map((r) => (
                    <tr key={r.name}><td className="py-2">{r.name} {!listed.has(key(r.name)) && <span className="badge ml-1 bg-zinc-100 text-zinc-500 dark:bg-zinc-800">default</span>}</td><td className="py-2 text-right tabular-nums">{r.recent}</td><td className="py-2 text-right tabular-nums">{r.open}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section className="card p-5">
            <h2 className="mb-1 font-semibold">Delivery partners</h2>
            <p className="mb-3 text-xs text-zinc-500">Riders are suggested first on orders going to their city.</p>
            {riders.length === 0 ? <p className="text-sm text-zinc-500">No delivery partners yet.</p> : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {riders.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0"><span className="block font-medium">{r.name}</span><span className="text-xs text-zinc-500">{r.phone ? `${r.phone} · ` : ""}{d.orders.filter((o) => o.deliveryPartnerId === r.id && OPEN.includes(o.status)).length} open orders</span></span>
                    <RiderCity id={r.id} city={r.city ?? ""} cities={cityNames} />
                  </li>
                ))}
              </ul>
            )}
            <AddDeliveryPartner cities={cityNames} />
          </section>
        </div>
      </div>
    </div>
  );
}
