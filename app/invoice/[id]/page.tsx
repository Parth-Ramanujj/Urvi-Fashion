import { notFound } from "next/navigation";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/i18n";
import PrintButton from "./PrintButton";
import Logo from "@/components/Logo";
import { getBrand } from "@/lib/server-utils";

export const metadata = { title: "Invoice" };

// Tax invoice; "Download PDF" uses the browser's print-to-PDF so no PDF library is needed.
export default async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await pageUser(`/invoice/${id}`);
  const o = db().orders.find((x) => x.id === id && (x.userId === u.id || u.role === "admin"));
  if (!o) notFound();
  const m = (v: number) => formatMoney(v, "INR");
  const b = getBrand();
  const t = o.totals;
  return (
    <div className="min-h-dvh bg-zinc-100 py-8 print:bg-white print:py-0 dark:bg-zinc-950">
      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-end gap-2 px-4"><PrintButton /></div>
      <article className="mx-auto max-w-3xl bg-white p-8 text-sm text-zinc-900 shadow-sm print:shadow-none md:p-12">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-zinc-200 pb-6">
          <div>
            <Logo className="text-3xl" />
            <p className="mt-2 whitespace-pre-line text-zinc-500">{b.legal.company || b.name}{b.legal.address && <><br />{b.legal.address}</>}{b.legal.gstin && <><br />GSTIN: {b.legal.gstin}</>}</p>
          </div>
          <div className="text-right">
            <h1 className="text-xl font-bold uppercase tracking-wide">Tax invoice</h1>
            <p className="mt-2 text-zinc-500">Invoice # INV-{o.ref}<br />Order # {o.ref}<br />Date: {new Date(o.createdAt).toLocaleDateString("en-IN")}</p>
          </div>
        </header>
        <section className="grid gap-6 border-b border-zinc-200 py-6 sm:grid-cols-2">
          <div><p className="label">Bill & ship to</p><p className="font-semibold">{o.address.name}</p><p className="text-zinc-600">{o.address.line1}{o.address.line2 ? `, ${o.address.line2}` : ""}<br />{o.address.city}, {o.address.state} – {o.address.pincode}<br />Phone: {o.address.phone}</p></div>
          <div className="sm:text-right"><p className="label">Payment</p><p className="uppercase">{o.payment.method} · {o.payment.status}</p>{o.payment.txnId && <p className="text-zinc-500">Txn: {o.payment.txnId}</p>}<p className="mt-2 capitalize text-zinc-500">{o.deliverySpeed} delivery</p></div>
        </section>
        <table className="mt-6 w-full">
          <thead><tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500"><th className="pb-2">Item</th><th className="pb-2 text-center">Qty</th><th className="pb-2 text-right">MRP</th><th className="pb-2 text-right">Price</th><th className="pb-2 text-right">Amount</th></tr></thead>
          <tbody>
            {o.items.map((i, k) => (
              <tr key={k} className="border-b border-zinc-100">
                <td className="py-3"><p className="font-medium">{i.name}</p><p className="text-xs text-zinc-500">{i.brand} · {i.color} · {i.size} · SKU {i.sku}</p></td>
                <td className="py-3 text-center">{i.qty}</td>
                <td className="py-3 text-right text-zinc-500">{m(i.mrp)}</td>
                <td className="py-3 text-right">{m(i.price)}</td>
                <td className="py-3 text-right font-medium">{m(i.price * i.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-6 max-w-xs space-y-1.5">
          {([["Total MRP", t.mrp], ["Discount", -t.discount], ...(t.coupon ? [[`Coupon (${o.couponCode})`, -t.coupon]] : []), ...(t.member ? [["Member discount", -t.member]] : []), ...(t.coins ? [["Coins redeemed", -t.coins]] : []), ["Taxable value", t.mrp - t.discount - t.coupon - (t.member ?? 0) - (t.coins ?? 0)], ["CGST 2.5%", t.tax / 2], ["SGST 2.5%", t.tax / 2], ["Delivery", t.delivery]] as [string, number][]).map(([l, v]) => (
            <div key={l} className="flex justify-between"><span className="text-zinc-500">{l}</span><span>{v < 0 ? `−${m(-v)}` : m(v)}</span></div>
          ))}
          <div className="flex justify-between border-t border-zinc-300 pt-2 text-base font-bold"><span>Grand total</span><span>{m(t.total)}</span></div>
        </div>
        <footer className="mt-10 border-t border-zinc-200 pt-6 text-xs text-zinc-500">{b.legal.invoiceNote} Returns accepted within 14 days of delivery.{b.contact.email && <> Questions? {b.contact.email}</>}{b.contact.phone && <> · {b.contact.phone}</>}</footer>
      </article>
    </div>
  );
}
