import { MapPin, Phone, Package, Wallet } from "lucide-react";
import { Money } from "@/components/ui";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/server-utils";
import DeliveryActions from "./DeliveryActions";

export const metadata = { title: "My deliveries" };

export default async function Delivery() {
  const me = await pageUser("/delivery", "delivery");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const mine = db().orders.filter((o) => o.deliveryPartnerId === me.id);
  const active = mine.filter((o) => o.status === "shipped" || o.status === "out_for_delivery").sort((a, b) => (a.status === "out_for_delivery" ? -1 : 1) - (b.status === "out_for_delivery" ? -1 : 1) || a.eta - b.eta);
  const done = mine.filter((o) => o.status === "delivered" && (o.timeline.findLast((t) => t.status === "delivered")?.at ?? 0) >= today.getTime());
  const cod = active.filter((o) => o.payment.method === "cod" && o.payment.status === "pending").reduce((s, o) => s + o.totals.total, 0);
  const customers = new Map(db().users.map((u) => [u.id, u.name]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Hi {me.name.split(" ")[0]} 👋</h1>
      <p className="text-zinc-500">Your delivery run for today.</p>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[["To deliver", active.length, Package], ["Delivered today", done.length, MapPin], ["COD to collect", <Money key="c" v={cod} />, Wallet]].map(([l, v, I]) => {
          const Icon = I as typeof Package;
          return <div key={l as string} className="card p-4"><Icon className="size-4 text-zinc-400" /><p className="mt-2 text-xl font-bold">{v as React.ReactNode}</p><p className="text-xs text-zinc-500">{l as string}</p></div>;
        })}
      </div>

      <h2 className="mt-8 font-semibold">Assigned orders</h2>
      {active.length === 0 && <p className="card mt-3 p-8 text-center text-sm text-zinc-500">No pending deliveries. Nice work!</p>}
      <ul className="mt-3 space-y-3">
        {active.map((o) => {
          const a = o.address;
          const codDue = o.payment.method === "cod" && o.payment.status === "pending";
          return (
            <li key={o.id} className={`card p-4 ${o.status === "out_for_delivery" ? "border-amber-300 dark:border-amber-700" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-mono text-sm font-bold">{o.ref}</p><p className="text-xs text-zinc-500">{STATUS_LABEL[o.status]} · {o.items.reduce((s, i) => s + i.qty, 0)} items · {o.deliverySpeed === "express" ? "Express" : "Standard"} · ETA {new Date(o.eta).toLocaleDateString("en-IN")}</p></div>
                {codDue ? <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Collect <Money v={o.totals.total} className="ml-1" /></span> : <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Prepaid</span>}
              </div>
              <div className="mt-3 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/60">
                <p className="font-medium">{a.name} <span className="text-xs font-normal text-zinc-500">({customers.get(o.userId) ?? "Customer"})</span></p>
                <p className="text-zinc-600 dark:text-zinc-300">{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={`tel:+91${a.phone}`} className="btn-ghost px-3 py-1.5 text-xs"><Phone className="size-3.5" />{a.phone}</a>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a.line1} ${a.city} ${a.pincode}`)}`} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1.5 text-xs"><MapPin className="size-3.5" />Directions</a>
                </div>
              </div>
              <DeliveryActions id={o.id} status={o.status} cod={codDue} />
            </li>
          );
        })}
      </ul>

      {done.length > 0 && (
        <>
          <h2 className="mt-8 font-semibold">Delivered today</h2>
          <ul className="mt-3 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {done.map((o) => <li key={o.id} className="flex justify-between p-3 text-sm"><span className="font-mono">{o.ref}</span><span className="text-zinc-500">{o.address.city} · <Money v={o.totals.total} /></span></li>)}
          </ul>
        </>
      )}
    </div>
  );
}
