import Link from "next/link";
import { FileText, Search } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import { Money } from "@/components/ui";
import { db } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/server-utils";
import type { OrderStatus } from "@/lib/types";
import { PageTitle, STATUS_TONE } from "../_ui";
import OrderControls from "./OrderControls";

const TABS: [string, string, OrderStatus[] | null][] = [
  ["", "All", null], ["placed", "New", ["placed"]], ["packed", "Packed", ["packed"]], ["shipped", "Shipped", ["shipped", "out_for_delivery"]],
  ["delivered", "Delivered", ["delivered", "exchanged"]], ["returns", "Returns", ["return_requested", "exchange_requested", "returned", "return_rejected"]], ["cancelled", "Cancelled", ["cancelled"]],
];

export default async function Orders({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { status = "", q = "" } = await searchParams;
  const d = db();
  const users = new Map(d.users.map((u) => [u.id, u]));
  const riders = d.users.filter((u) => u.role === "delivery");
  // Riders serving the order's city come first, labelled with the city; otherwise everyone is listed.
  const partnersFor = (city: string) => {
    const local = riders.filter((r) => r.city && r.city.trim().toLowerCase() === city.trim().toLowerCase());
    return [...local.map((r) => ({ id: r.id, name: `${r.name} (${r.city})` })), ...riders.filter((r) => !local.includes(r)).map((r) => ({ id: r.id, name: r.name }))];
  };
  const tab = TABS.find((t) => t[0] === status) ?? TABS[0];
  const term = q.trim().toLowerCase();
  const orders = d.orders
    .filter((o) => (!tab[2] || tab[2].includes(o.status)) && (!term || `${o.ref} ${users.get(o.userId)?.name} ${o.address.phone}`.toLowerCase().includes(term)))
    .sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);
  const count = (s: OrderStatus[] | null) => (s ? d.orders.filter((o) => s.includes(o.status)).length : d.orders.length);

  return (
    <div>
      <PageTitle title="Orders">
        <form className="relative w-full sm:w-72"><input type="hidden" name="status" value={status} /><Search className="absolute left-3 top-3 size-4 text-zinc-400" /><input name="q" defaultValue={q} placeholder="Order ref, customer, phone" aria-label="Search orders" className="input pl-9" /></form>
      </PageTitle>
      <nav className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto" aria-label="Order status">
        {TABS.map(([k, label, s]) => (
          <Link key={k} href={`/admin/orders${k ? `?status=${k}` : ""}`} className={`chip shrink-0 text-sm ${k === status ? "chip-on" : ""}`}>{label} <span className="opacity-60">{count(s)}</span></Link>
        ))}
      </nav>
      {orders.length === 0 && <p className="card p-10 text-center text-sm text-zinc-500">No orders here.</p>}
      <ul className="space-y-3">
        {orders.map((o) => {
          const u = users.get(o.userId);
          return (
            <li key={o.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold">{o.ref}</span><span className={`badge ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span>{o.deliverySpeed === "express" && <span className="badge bg-brand-100 text-brand-700">Express</span>}</div>
                  <p className="mt-1 text-xs text-zinc-500">{new Date(o.createdAt).toLocaleString("en-IN")} · {u?.name ?? "Deleted user"} · {o.address.city}, {o.address.pincode}</p>
                </div>
                <div className="text-right">
                  <Money v={o.totals.total} className="font-bold" />
                  <p className="text-xs uppercase text-zinc-500">{o.payment.method} · <span className={o.payment.status === "paid" ? "text-emerald-600" : o.payment.status === "refunded" ? "text-sky-600" : "text-amber-600"}>{o.payment.status}</span></p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {o.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl bg-zinc-50 p-1.5 pr-3 text-xs dark:bg-zinc-800/60">
                    <div className="h-10 w-8 overflow-hidden rounded-md"><ProductImage src={it.image} alt={it.name} /></div>
                    <span><span className="block max-w-40 truncate font-medium">{it.name}</span><span className="text-zinc-500">{it.color} · {it.size} · ×{it.qty}</span></span>
                  </div>
                ))}
              </div>
              {o.returnRequest && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><b className="capitalize">{o.returnRequest.type}</b>{o.returnRequest.exchangeSize && ` → size ${o.returnRequest.exchangeSize}`}: “{o.returnRequest.reason}”</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <OrderControls id={o.id} status={o.status} partnerId={o.deliveryPartnerId ?? ""} partners={partnersFor(o.address.city)} hasReturn={["return_requested", "exchange_requested"].includes(o.status)} />
                <Link href={`/invoice/${o.id}`} target="_blank" className="btn-ghost ml-auto px-3 py-1.5 text-xs"><FileText className="size-3.5" />Invoice</Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
