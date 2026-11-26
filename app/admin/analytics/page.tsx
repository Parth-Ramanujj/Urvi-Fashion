import Link from "next/link";
import { Eye, Heart, Search, ShoppingBag, ShoppingCart, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import type { AnalyticsKind } from "@/lib/types";
import { PageTitle } from "../_ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

const KIND_INFO: Record<AnalyticsKind, { label: string; tone: string }> = {
  product_view: { label: "Viewed product", tone: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  add_to_cart: { label: "Added to bag", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  wishlist_add: { label: "Saved to wishlist", tone: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
  search: { label: "Searched", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  checkout_start: { label: "Started checkout", tone: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300" },
};

const ago = (t: number) => {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};

export default function AnalyticsPage() {
  const d = db();
  const events = d.analytics ?? [];
  const views = events.filter((e) => e.kind === "product_view");
  const carts = events.filter((e) => e.kind === "add_to_cart");
  const wishes = events.filter((e) => e.kind === "wishlist_add");
  const searches = events.filter((e) => e.kind === "search");
  const checkouts = events.filter((e) => e.kind === "checkout_start");
  const ordersCount = d.orders.filter((o) => o.status !== "cancelled").length;

  // Per-product breakdown: views, add-to-carts, wishlist adds
  const prodMap = new Map<string, { id: string; name: string; slug: string; views: number; carts: number; wishes: number }>();
  for (const e of events) {
    if (!e.productId) continue;
    const cur = prodMap.get(e.productId) ?? { id: e.productId, name: e.productName || "Product", slug: e.slug || "", views: 0, carts: 0, wishes: 0 };
    if (e.kind === "product_view") cur.views++;
    if (e.kind === "add_to_cart") cur.carts++;
    if (e.kind === "wishlist_add") cur.wishes++;
    prodMap.set(e.productId, cur);
  }
  const topProducts = [...prodMap.values()].sort((a, b) => b.views - a.views || b.carts - a.carts).slice(0, 15);

  // Top search terms
  const searchMap = new Map<string, number>();
  for (const e of searches) {
    const q = (e.meta ?? "").toLowerCase().trim();
    if (q) searchMap.set(q, (searchMap.get(q) ?? 0) + 1);
  }
  const topSearches = [...searchMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  const kpis = [
    { label: "Product views", value: views.length.toLocaleString("en-IN"), icon: Eye },
    { label: "Added to bag", value: carts.length.toLocaleString("en-IN"), icon: ShoppingBag },
    { label: "Wishlist saves", value: wishes.length.toLocaleString("en-IN"), icon: Heart },
    { label: "Searches", value: searches.length.toLocaleString("en-IN"), icon: Search },
    { label: "Checkout starts", value: checkouts.length.toLocaleString("en-IN"), icon: ShoppingCart },
    { label: "View → Bag rate", value: views.length ? `${Math.round((carts.length / views.length) * 100)}%` : "0%", icon: TrendingUp },
  ];

  const funnel = [
    { label: "Product views", count: views.length, color: "bg-sky-500" },
    { label: "Added to bag", count: carts.length, color: "bg-emerald-500" },
    { label: "Started checkout", count: checkouts.length, color: "bg-violet-500" },
    { label: "Total orders", count: ordersCount, color: "bg-brand-500" },
  ];
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));

  return (
    <div className="space-y-6">
      <PageTitle title="Live Analytics">
        <p className="w-full text-sm text-zinc-500">Track what shoppers view, search, add to bag, and buy in real time.</p>
      </PageTitle>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map(({ label, value, icon: Icon }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center justify-between text-zinc-500"><span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span><Icon className="size-4" /></div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">Product interest (views vs. bag)</h2>
          {topProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No product activity recorded yet. Visit a product or add to bag to see live stats.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[500px] text-sm">
                <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
                  <tr><th className="py-2">Product</th><th className="text-right">Views</th><th className="text-right">Add to bag</th><th className="text-right">Wishlist</th><th className="text-right">View → Bag</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {topProducts.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 font-medium">{p.slug ? <Link href={`/product/${p.slug}`} target="_blank" className="hover:underline">{p.name}</Link> : p.name}</td>
                      <td className="text-right tabular-nums">{p.views}</td>
                      <td className="text-right font-semibold text-emerald-600 tabular-nums">{p.carts}</td>
                      <td className="text-right text-rose-600 tabular-nums">{p.wishes}</td>
                      <td className="text-right text-zinc-500 tabular-nums">{p.views ? `${Math.round((p.carts / p.views) * 100)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-4 font-semibold">Shopping funnel</h2>
            <div className="space-y-3">
              {funnel.map((f) => (
                <div key={f.label}>
                  <div className="flex justify-between text-sm"><span>{f.label}</span><span className="font-semibold tabular-nums">{f.count}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800"><div className={`h-full rounded-full ${f.color}`} style={{ width: `${(f.count / maxFunnel) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Top searches</h2>
            {topSearches.length === 0 ? <p className="text-sm text-zinc-500">No searches yet.</p> : (
              <div className="flex flex-wrap gap-2">
                {topSearches.map(([term, count]) => (
                  <span key={term} className="chip text-xs">{term} <b className="ml-1 text-brand-600">{count}</b></span>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Recent user activity <span className="text-sm font-normal text-zinc-500">(latest {Math.min(50, events.length)})</span></h2>
        {events.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">No user activity yet.</p>
        ) : (
          <ul className="max-h-96 divide-y divide-zinc-100 overflow-y-auto text-sm dark:divide-zinc-800">
            {events.slice(0, 50).map((e) => {
              const info = KIND_INFO[e.kind];
              return (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${info.tone}`}>{info.label}</span>
                    <b>{e.userName || "Guest"}</b>
                    {e.productName && <span className="text-zinc-700 dark:text-zinc-300">{e.productName}</span>}
                    {e.meta && <span className="text-xs text-zinc-500">({e.meta})</span>}
                  </div>
                  <span className="text-xs text-zinc-400">{ago(e.at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
