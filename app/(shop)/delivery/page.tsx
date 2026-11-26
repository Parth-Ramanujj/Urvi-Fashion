import { MapPin, Phone, Package, Truck, Wallet } from "lucide-react";
import { Money } from "@/components/ui";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/server-utils";
import LiveRefresh from "../account/orders/[id]/LiveRefresh";
import DeliveryActions, { ClaimOrderButton } from "./DeliveryActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "My deliveries" };

export default async function Delivery() {
  const me = await pageUser("/delivery", "delivery");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const allOrders = db().orders;
  const mine = allOrders.filter((o) => o.deliveryPartnerId === me.id);
  const activeStatuses = new Set(["placed", "packed", "shipped", "out_for_delivery"]);
  const rank = (s: string) => (s === "out_for_delivery" ? 0 : s === "shipped" ? 1 : s === "packed" ? 2 : 3);
  const active = mine.filter((o) => activeStatuses.has(o.status)).sort((a, b) => rank(a.status) - rank(b.status) || a.eta - b.eta);
  const pickupCount = active.filter((o) => o.status === "placed" || o.status === "packed").length;
  const roadCount = active.filter((o) => o.status === "shipped" || o.status === "out_for_delivery").length;
  const doneAll = mine.filter((o) => o.status === "delivered").sort((a, b) => b.createdAt - a.createdAt);
  const doneToday = doneAll.filter((o) => (o.timeline.findLast((t) => t.status === "delivered")?.at ?? 0) >= today.getTime());
  const codDueTotal = active.filter((o) => o.payment.method === "cod" && o.payment.status === "pending").reduce((s, o) => s + o.totals.total, 0);
  const codCollectedToday = doneToday.filter((o) => o.payment.method === "cod").reduce((s, o) => s + o.totals.total, 0);
  const available = allOrders
    .filter((o) => !o.deliveryPartnerId && ["packed", "shipped"].includes(o.status) && (!me.city || o.address.city.trim().toLowerCase() === me.city.trim().toLowerCase()))
    .sort((a, b) => a.eta - b.eta)
    .slice(0, 10);
  const customers = new Map(db().users.map((u) => [u.id, u.name]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <LiveRefresh active />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl font-bold">Hi {me.name.split(" ")[0]} 👋</h1>
          <p className="text-sm text-zinc-500">Your delivery run{me.city ? ` · ${me.city}` : ""} (auto-refreshes live)</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4"><Package className="size-4 text-zinc-400" /><p className="mt-2 text-xl font-bold">{pickupCount}</p><p className="text-xs text-zinc-500">Ready for pickup</p></div>
        <div className="card p-4"><Truck className="size-4 text-zinc-400" /><p className="mt-2 text-xl font-bold">{roadCount}</p><p className="text-xs text-zinc-500">On the road</p></div>
        <div className="card p-4"><MapPin className="size-4 text-zinc-400" /><p className="mt-2 text-xl font-bold">{doneToday.length}</p><p className="text-xs text-zinc-500">Delivered today</p></div>
        <div className="card p-4"><Wallet className="size-4 text-zinc-400" /><p className="mt-2 text-xl font-bold"><Money v={codDueTotal} /></p><p className="text-xs text-zinc-500">COD to collect · <Money v={codCollectedToday} /> collected</p></div>
      </div>

      <h2 className="mt-8 font-semibold">Assigned orders ({active.length})</h2>
      {active.length === 0 && <p className="card mt-3 p-8 text-center text-sm text-zinc-500">No pending deliveries assigned right now.</p>}
      <ul className="mt-3 space-y-3">
        {active.map((o) => {
          const a = o.address;
          const codDue = o.payment.method === "cod" && o.payment.status === "pending";
          const logs = (o.trackingLogs ?? []).slice(-3).reverse();
          return (
            <li key={o.id} className={`card p-4 ${o.status === "out_for_delivery" ? "border-amber-300 dark:border-amber-700" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-bold">{o.ref}</p>
                    {o.trackingCode && <span className="badge bg-zinc-100 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{o.trackingCode}</span>}
                    <span className="badge bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">{STATUS_LABEL[o.status]}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">{o.items.reduce((s, i) => s + i.qty, 0)} items · {o.deliverySpeed === "express" ? "Express" : "Standard"} · ETA {new Date(o.eta).toLocaleDateString("en-IN")}</p>
                </div>
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

              <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                {o.items.map((it, idx) => (
                  <span key={idx} className="rounded-lg bg-zinc-100 px-2 py-1 dark:bg-zinc-800">{it.name} ({it.color}, {it.size} × {it.qty})</span>
                ))}
              </div>

              {logs.length > 0 && (
                <div className="mt-2.5 space-y-1 border-t border-zinc-100 pt-2 text-xs text-zinc-500 dark:border-zinc-800">
                  {logs.map((l) => (
                    <p key={l.id}><b>{l.title}</b>{l.location ? ` · ${l.location}` : ""}{l.note ? ` — ${l.note}` : ""} <span className="opacity-70">({new Date(l.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })})</span></p>
                  ))}
                </div>
              )}

              <DeliveryActions id={o.id} status={o.status} cod={codDue} city={a.city} />
            </li>
          );
        })}
      </ul>

      {available.length > 0 && (
        <>
          <h2 className="mt-8 font-semibold">Available to claim{me.city ? ` in ${me.city}` : ""}</h2>
          <ul className="mt-3 space-y-2">
            {available.map((o) => (
              <li key={o.id} className="card flex flex-wrap items-center justify-between gap-3 p-3.5 text-sm">
                <div>
                  <p className="font-mono font-semibold">{o.ref} <span className="ml-1 font-sans text-xs font-normal text-zinc-500">· {STATUS_LABEL[o.status]}</span></p>
                  <p className="text-xs text-zinc-500">{o.address.city}, {o.address.pincode} · {o.items.reduce((s, i) => s + i.qty, 0)} items · {o.payment.method === "cod" ? `COD ₹${o.totals.total}` : "Prepaid"}</p>
                </div>
                <ClaimOrderButton id={o.id} />
              </li>
            ))}
          </ul>
        </>
      )}

      {doneAll.length > 0 && (
        <>
          <h2 className="mt-8 font-semibold">Completed deliveries ({doneAll.length})</h2>
          <ul className="mt-3 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {doneAll.slice(0, 15).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span><span className="font-mono font-medium">{o.ref}</span> <span className="text-xs text-zinc-500">· {o.address.name}, {o.address.city}</span></span>
                <span className="text-xs text-zinc-500">{o.payment.method === "cod" ? "COD" : "Prepaid"} · <Money v={o.totals.total} /></span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
