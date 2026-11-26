import Link from "next/link";
import { Check, CircleDot, Home, MapPin, Package, PackageCheck, Search, Truck, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/server-utils";
import { FLOW } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Track order" };

const ICONS = { placed: CircleDot, packed: Package, shipped: Truck, out_for_delivery: PackageCheck, delivered: Home } as const;
const fmt = (t: number) => new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default async function TrackOrderPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { q = "" } = await searchParams;
  const code = q.trim().toLowerCase();
  const d = db();
  const order = code
    ? d.orders.find((o) => o.ref.toLowerCase() === code || (o.trackingCode ?? "").toLowerCase() === code)
    : undefined;
  const rider = order?.deliveryPartnerId ? d.users.find((u) => u.id === order.deliveryPartnerId) : undefined;
  const reached = order ? (FLOW.indexOf(order.status) >= 0 ? FLOW.indexOf(order.status) : order.timeline.some((t) => t.status === "delivered") ? 4 : 0) : 0;
  const at = (s: string) => (order ? [...order.timeline].reverse().find((t) => t.status === s)?.at : undefined);
  const logs = [...(order?.trackingLogs ?? [])].reverse();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Track your order</h1>
      <p className="mt-1 text-sm text-zinc-500">Enter your Order Reference (e.g. TH-...) or Tracking Code (e.g. TRK-...).</p>

      <form className="mt-5 flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Order reference or tracking code</span>
          <Search className="absolute left-3.5 top-3.5 size-4 text-zinc-400" />
          <input name="q" defaultValue={q} placeholder="Order ref or TRK-XXXXXX" className="input pl-10" required />
        </label>
        <button className="btn-primary px-6">Track</button>
      </form>

      {code && !order && (
        <div className="card mt-6 p-8 text-center">
          <p className="font-semibold">No order found for “{q.trim()}”</p>
          <p className="mt-1 text-sm text-zinc-500">Check the reference or tracking code in your order confirmation or <Link href="/account/orders" className="underline">view your orders</Link>.</p>
        </div>
      )}

      {order && (
        <div className="card mt-6 space-y-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-lg font-bold">{order.ref}</p>
              <p className="text-xs text-zinc-500">
                {order.trackingCode && <>Tracking ID: <b className="font-mono">{order.trackingCode}</b> · </>}
                {order.courierName || "Store Delivery"} · Destination: {order.address.city}
              </p>
            </div>
            <div className="text-right">
              <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">{STATUS_LABEL[order.status]}</span>
              {order.status !== "cancelled" && reached < 4 && (
                <p className="mt-1 text-xs text-zinc-500">ETA {new Date(order.eta).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</p>
              )}
            </div>
          </div>

          {order.status === "cancelled" ? (
            <p className="flex items-center gap-2 text-sm text-red-600"><XCircle className="size-5" />Cancelled on {fmt(at("cancelled") ?? order.createdAt)}.</p>
          ) : (
            <ol className="grid sm:grid-cols-5">
              {FLOW.map((s, i) => {
                const done = i <= reached, current = i === reached;
                const I = ICONS[s as keyof typeof ICONS];
                return (
                  <li key={s} className="relative flex gap-3 pb-5 sm:flex-col sm:items-center sm:pb-0 sm:text-center">
                    {i < FLOW.length - 1 && <span className={`absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-0.5 sm:left-[calc(50%+20px)] sm:top-[19px] sm:h-0.5 sm:w-[calc(100%-40px)] ${i < reached ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"}`} />}
                    <span className={`relative z-10 grid size-10 shrink-0 place-items-center rounded-full ${done ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"}`}>
                      {done && !current ? <Check className="size-5" /> : <I className="size-5" />}
                    </span>
                    <div className="sm:mt-2">
                      <p className={`text-sm font-semibold ${done ? "" : "text-zinc-400"}`}>{STATUS_LABEL[s]}</p>
                      <p className="text-xs text-zinc-500">{at(s) ? fmt(at(s)!) : "—"}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {rider && ["shipped", "out_for_delivery"].includes(order.status) && (
            <p className="rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/60">Delivery partner: <b>{rider.name}</b></p>
          )}

          {order.trackingUrl && (
            <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="btn-ghost inline-flex text-xs">Open external courier tracking →</a>
          )}

          {logs.length > 0 && (
            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <h2 className="mb-3 text-sm font-semibold">Tracking history</h2>
              <ul className="space-y-3 text-sm">
                {logs.map((l) => (
                  <li key={l.id} className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <div className="flex-1">
                      <p className="font-medium">{l.title}{l.location ? <span className="font-normal text-zinc-500"> · {l.location}</span> : null}</p>
                      {l.note && <p className="text-xs text-zinc-500">{l.note}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-zinc-400">{fmt(l.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
