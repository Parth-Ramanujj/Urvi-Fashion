import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, CircleDot, Download, Home, MapPin, Package, PackageCheck, RotateCcw, Truck, XCircle } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import { Money } from "@/components/ui";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { RETURN_WINDOW_DAYS } from "@/lib/pricing";
import { STATUS_LABEL } from "@/lib/server-utils";
import { FLOW } from "@/lib/types";
import { statusTone } from "../tone";
import LiveRefresh from "./LiveRefresh";
import OrderActions from "./OrderActions";

const ICONS = { placed: CircleDot, packed: Package, shipped: Truck, out_for_delivery: PackageCheck, delivered: Home } as const;
const fmt = (t: number) => new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await pageUser(`/account/orders/${id}`);
  const o = db().orders.find((x) => x.id === id && x.userId === u.id);
  if (!o) notFound();
  const rider = o.deliveryPartnerId ? db().users.find((x) => x.id === o.deliveryPartnerId) : undefined;
  const at = (s: string) => [...o.timeline].reverse().find((t) => t.status === s)?.at;
  const reached = FLOW.indexOf(o.status) >= 0 ? FLOW.indexOf(o.status) : o.timeline.some((t) => t.status === "delivered") ? 4 : 0;
  const deliveredAt = at("delivered");
  const returnable = o.status === "delivered" && !!deliveredAt && Date.now() - deliveredAt < RETURN_WINDOW_DAYS * 86_400_000;
  const extra = o.timeline.filter((t) => !FLOW.includes(t.status) && t.status !== "cancelled");
  const t = o.totals;
  const rows: [string, number][] = [["Total MRP", t.mrp], ["Discount", -t.discount], ...(t.coupon ? [[`Coupon ${o.couponCode ?? ""}`, -t.coupon] as [string, number]] : []), ...(t.member ? [["Plus member discount", -t.member] as [string, number]] : []), ...(t.coins ? [["Coins redeemed", -t.coins] as [string, number]] : []), ["Delivery", t.delivery], ["GST (5%)", t.tax]];

  return (
    <div className="space-y-5">
      <LiveRefresh active={!["delivered", "cancelled", "returned", "exchanged", "return_rejected"].includes(o.status)} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/account/orders" className="text-sm text-zinc-500 hover:underline">← All orders</Link>
          <h2 className="mt-1 text-xl font-semibold">Order {o.ref}</h2>
          <p className="text-sm text-zinc-500">Placed {fmt(o.createdAt)} · <span className={`badge ${statusTone(o.status)}`}>{STATUS_LABEL[o.status]}</span></p>
        </div>
        <a href={`/invoice/${o.id}`} target="_blank" className="btn-ghost"><Download className="size-4" />Invoice (PDF)</a>
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Live tracking</h3>
            {(o.trackingCode || o.courierName) && (
              <p className="text-xs text-zinc-500">
                {o.trackingCode && <>Tracking ID: <b className="font-mono">{o.trackingCode}</b> · </>}
                {o.courierName || "Store Delivery"}
                {o.trackingUrl && <> · <a href={o.trackingUrl} target="_blank" rel="noreferrer" className="text-brand-600 underline">Track on courier site</a></>}
              </p>
            )}
          </div>
          {o.status !== "cancelled" && reached < 4 && <p className="text-sm text-zinc-500">Arriving by <b className="text-zinc-900 dark:text-white">{new Date(o.eta).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</b></p>}
        </div>
        {o.status === "cancelled" ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-red-600"><XCircle className="size-5 shrink-0" />Cancelled on {fmt(at("cancelled") ?? o.createdAt)}. {o.payment.status === "refunded" && "Your refund has been initiated (5–7 business days)."}</p>
        ) : (
          <ol className="mt-6 grid sm:grid-cols-5">
            {FLOW.map((s, i) => {
              const done = i <= reached, current = i === reached;
              const I = ICONS[s as keyof typeof ICONS];
              return (
                <li key={s} className="relative flex gap-3 pb-6 sm:flex-col sm:items-center sm:pb-0 sm:text-center">
                  {i < FLOW.length - 1 && <span className={`absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-0.5 sm:left-[calc(50%+20px)] sm:top-[19px] sm:h-0.5 sm:w-[calc(100%-40px)] ${i < reached ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"}`} />}
                  <span className={`relative z-10 grid size-10 shrink-0 place-items-center rounded-full ${done ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"} ${current && s !== "delivered" ? "ring-4 ring-emerald-500/25" : ""}`}>
                    {done && !current ? <Check className="size-5" /> : <I className={`size-5 ${current && s !== "delivered" ? "animate-pulse" : ""}`} />}
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
        {extra.map((e, i) => (
          <p key={i} className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"><RotateCcw className="size-4 shrink-0" /><span><b>{STATUS_LABEL[e.status]}</b> · {fmt(e.at)}{e.note && ` — ${e.note}`}</span></p>
        ))}
        {rider && ["shipped", "out_for_delivery"].includes(o.status) && <p className="mt-4 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/50">Delivery partner: <b>{rider.name}</b>{rider.phone && <> · <a href={`tel:${rider.phone}`} className="underline">{rider.phone}</a></>}</p>}
        {o.trackingLogs && o.trackingLogs.length > 0 && (
          <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Tracking history</h4>
            <ul className="space-y-2.5 text-sm">
              {[...o.trackingLogs].reverse().map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{l.title}{l.location ? <span className="font-normal text-zinc-500"> · {l.location}</span> : null}</p>
                    {l.note && <p className="text-xs text-zinc-500">{l.note}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-zinc-400">{fmt(l.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <OrderActions id={o.id} status={o.status} returnable={returnable} sizes={[...new Set(o.items.map((i) => i.size))]} windowDays={RETURN_WINDOW_DAYS} />

      <section className="card divide-y divide-zinc-200 dark:divide-zinc-800">
        {o.items.map((i, k) => (
          <div key={k} className="flex gap-4 p-4">
            <Link href={`/product/${i.slug}`} className="h-24 w-20 shrink-0 overflow-hidden rounded-xl"><ProductImage src={i.image} alt={i.name} /></Link>
            <div className="flex-1 text-sm">
              <p className="text-xs font-semibold uppercase text-zinc-500">{i.brand}</p>
              <Link href={`/product/${i.slug}`} className="font-medium hover:underline">{i.name}</Link>
              <p className="text-zinc-500">{i.color} · Size {i.size} · Qty {i.qty}</p>
              {o.status === "delivered" && <Link href={`/product/${i.slug}#reviews`} className="mt-1 inline-block text-xs font-semibold text-brand-600">Rate & review</Link>}
            </div>
            <Money v={i.price * i.qty} className="text-sm font-semibold" />
          </div>
        ))}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="card p-5 text-sm">
          <h3 className="mb-2 flex items-center gap-2 font-semibold"><MapPin className="size-4" />Shipping to</h3>
          <p className="font-medium">{o.address.name}</p>
          <p className="text-zinc-600 dark:text-zinc-400">{o.address.line1}{o.address.line2 ? `, ${o.address.line2}` : ""}<br />{o.address.city}, {o.address.state} – {o.address.pincode}<br />{o.address.phone}</p>
          <p className="mt-3 text-zinc-500">{o.deliverySpeed === "express" ? "Express" : "Standard"} delivery · <span className="uppercase">{o.payment.method}</span> ({o.payment.status})</p>
        </section>
        <section className="card space-y-2 p-5 text-sm">
          <h3 className="mb-2 font-semibold">Payment summary</h3>
          {rows.map(([l, v]) => <div key={l} className="flex justify-between"><span className="text-zinc-500">{l}</span><span className={v < 0 ? "text-emerald-600" : ""}>{v < 0 && "−"}<Money v={Math.abs(v)} /></span></div>)}
          <div className="flex justify-between border-t border-zinc-200 pt-2 font-bold dark:border-zinc-800"><span>Total</span><Money v={t.total} /></div>
          {o.coinsEarned ? <p className="rounded-xl bg-amber-50 p-2.5 text-center text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">🪙 You earned <b>{o.coinsEarned}</b> coins on this order</p>
            : !["cancelled", "returned"].includes(o.status) && <p className="rounded-xl bg-amber-50 p-2.5 text-center text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">🪙 Coins are credited once this order is delivered</p>}
        </section>
      </div>
    </div>
  );
}
