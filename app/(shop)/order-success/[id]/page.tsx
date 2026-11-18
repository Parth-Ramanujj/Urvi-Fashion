import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy } from "lucide-react";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Money } from "@/components/ui";
import CopyButton from "./CopyButton";

export const metadata = { title: "Order confirmed" };

export default async function Success({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await pageUser(`/order-success/${id}`);
  const o = db().orders.find((x) => x.id === id && x.userId === u.id);
  if (!o) notFound();
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="relative mx-auto size-28">
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30 [animation-iteration-count:2]" />
        <svg viewBox="0 0 52 52" className="relative size-28 animate-pop" aria-hidden>
          <circle cx="26" cy="26" r="25" className="fill-emerald-500" />
          <path d="M14 27 l8 8 l16 -17" fill="none" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" className="check-draw" />
        </svg>
      </div>
      <h1 className="mt-8 animate-slide-up font-display text-3xl font-bold [animation-delay:300ms]">Order confirmed!</h1>
      <p className="mt-2 animate-slide-up text-zinc-500 [animation-delay:400ms]">Thanks, {u.name.split(" ")[0]}. We&apos;ve sent the details to your notifications.</p>
      <div className="card mt-8 animate-slide-up p-5 text-left [animation-delay:500ms]">
        <div className="flex items-center justify-between">
          <div><p className="label mb-0">Order reference</p><p className="font-mono text-lg font-bold">{o.ref}</p></div>
          <CopyButton text={o.ref}><Copy className="size-4" /></CopyButton>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
          <div><p className="text-zinc-500">Amount</p><Money v={o.totals.total} className="font-semibold" /></div>
          <div><p className="text-zinc-500">Payment</p><p className="font-semibold uppercase">{o.payment.method} · {o.payment.status}</p></div>
          <div><p className="text-zinc-500">Items</p><p className="font-semibold">{o.items.reduce((s, i) => s + i.qty, 0)}</p></div>
          <div><p className="text-zinc-500">Estimated delivery</p><p className="font-semibold">{new Date(o.eta).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</p></div>
        </div>
      </div>
      <div className="mt-6 flex animate-slide-up flex-col gap-2 [animation-delay:600ms] sm:flex-row sm:justify-center">
        <Link href={`/account/orders/${o.id}`} className="btn-primary">Track order</Link>
        <Link href="/shop" className="btn-ghost">Continue shopping</Link>
      </div>
    </div>
  );
}
