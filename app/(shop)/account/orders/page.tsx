import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import { Empty, Money } from "@/components/ui";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/server-utils";
import { statusTone } from "./tone";

export const metadata = { title: "My orders" };

export default async function Orders() {
  const u = await pageUser("/account/orders");
  const orders = db().orders.filter((o) => o.userId === u.id).sort((a, b) => b.createdAt - a.createdAt);
  if (!orders.length) return <Empty icon={<Package className="size-7" />} title="No orders yet"><Link href="/shop" className="btn-primary">Start shopping</Link></Empty>;
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/account/orders/${o.id}`} className="card flex items-center gap-4 p-4 transition hover:shadow-md">
            <div className="flex -space-x-6">{o.items.slice(0, 3).map((i, k) => <div key={k} className="h-20 w-16 overflow-hidden rounded-xl border-2 border-white dark:border-zinc-900"><ProductImage src={i.image} alt={i.name} /></div>)}</div>
            <div className="min-w-0 flex-1">
              <span className={`badge ${statusTone(o.status)}`}>{STATUS_LABEL[o.status]}</span>
              <p className="mt-1 truncate text-sm font-medium">{o.items.map((i) => i.name).join(", ")}</p>
              <p className="text-xs text-zinc-500">{o.ref} · {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · <Money v={o.totals.total} /></p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-zinc-400" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
