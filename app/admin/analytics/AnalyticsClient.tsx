"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, LogIn, Search, ShieldAlert, ShoppingBag, ShoppingCart, TrendingUp, UserCheck, UserPlus, X } from "lucide-react";
import type { AnalyticsEvent, AnalyticsKind } from "@/lib/types";

type OrderSummary = { id: string; status: string; total: number; createdAt: number; userId: string };
type RangeKey = "24h" | "7d" | "30d" | "all";
type GroupKey = "all" | "auth" | "browse" | "bag" | "orders";

const KIND_INFO: Record<AnalyticsKind, { label: string; group: Exclude<GroupKey, "all">; tone: string }> = {
  login: { label: "Logged in", group: "auth", tone: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300" },
  otp_login: { label: "OTP login", group: "auth", tone: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300" },
  login_failed: { label: "Failed login", group: "auth", tone: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  register: { label: "Signed up", group: "auth", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  logout: { label: "Logged out", group: "auth", tone: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  profile_update: { label: "Updated profile", group: "auth", tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  address_save: { label: "Saved address", group: "auth", tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  password_change: { label: "Changed password", group: "auth", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  page_view: { label: "Visited page", group: "browse", tone: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  product_view: { label: "Viewed product", group: "browse", tone: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  search: { label: "Searched", group: "browse", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  add_to_cart: { label: "Added to bag", group: "bag", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  remove_from_cart: { label: "Removed from bag", group: "bag", tone: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  wishlist_add: { label: "Saved to wishlist", group: "bag", tone: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
  wishlist_remove: { label: "Removed wishlist", group: "bag", tone: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  waitlist_join: { label: "Joined waitlist", group: "bag", tone: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  review_add: { label: "Posted review", group: "bag", tone: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  social_claim: { label: "Social reward", group: "bag", tone: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300" },
  checkout_start: { label: "Started checkout", group: "orders", tone: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300" },
  coupon_apply: { label: "Claimed coupon", group: "orders", tone: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300" },
  order_place: { label: "Placed order", group: "orders", tone: "bg-emerald-600 text-white" },
  order_cancel: { label: "Cancelled order", group: "orders", tone: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  return_request: { label: "Return / exchange", group: "orders", tone: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  membership_buy: { label: "Bought membership", group: "orders", tone: "bg-amber-500 text-white" },
  support_ticket: { label: "Support ticket", group: "orders", tone: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300" },
};

const RANGES: { key: RangeKey; label: string; ms: number }[] = [
  { key: "24h", label: "Last 24h", ms: 86_400_000 },
  { key: "7d", label: "7 Days", ms: 7 * 86_400_000 },
  { key: "30d", label: "30 Days", ms: 30 * 86_400_000 },
  { key: "all", label: "All Time", ms: Infinity },
];

const GROUPS: { key: GroupKey; label: string }[] = [
  { key: "all", label: "All activity" },
  { key: "auth", label: "Login & Account" },
  { key: "browse", label: "Views & Search" },
  { key: "bag", label: "Bag & Wishlist" },
  { key: "orders", label: "Checkout & Orders" },
];

const ago = (t: number) => {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};

export default function AnalyticsClient({ events, orders }: { events: AnalyticsEvent[]; orders: OrderSummary[] }) {
  const [range, setRange] = useState<RangeKey>("7d");
  const [group, setGroup] = useState<GroupKey>("all");
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ id?: string; name: string } | null>(null);

  const cutoff = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)!;
    return r.ms === Infinity ? 0 : Date.now() - r.ms;
  }, [range]);

  const inRange = useMemo(() => events.filter((e) => e.at >= cutoff), [events, cutoff]);
  const ordersInRange = useMemo(() => orders.filter((o) => o.createdAt >= cutoff && o.status !== "cancelled"), [orders, cutoff]);

  const stats = useMemo(() => {
    const logins = inRange.filter((e) => e.kind === "login" || e.kind === "otp_login").length;
    const failedLogins = inRange.filter((e) => e.kind === "login_failed").length;
    const signups = inRange.filter((e) => e.kind === "register").length;
    const pageViews = inRange.filter((e) => e.kind === "page_view").length;
    const productViews = inRange.filter((e) => e.kind === "product_view").length;
    const carts = inRange.filter((e) => e.kind === "add_to_cart").length;
    const checkouts = inRange.filter((e) => e.kind === "checkout_start").length;
    const activeUserIds = new Set(inRange.map((e) => e.userId).filter(Boolean));
    const revenue = ordersInRange.reduce((s, o) => s + o.total, 0);

    // Per-user journey summary
    const userMap = new Map<string, { key: string; userId?: string; name: string; logins: number; views: number; carts: number; orders: number; totalEvents: number; lastAt: number }>();
    for (const e of inRange) {
      const key = e.userId || `guest:${e.userName || "Guest"}`;
      const cur = userMap.get(key) ?? { key, userId: e.userId, name: e.userName || "Guest", logins: 0, views: 0, carts: 0, orders: 0, totalEvents: 0, lastAt: e.at };
      cur.totalEvents++;
      if (e.at > cur.lastAt) cur.lastAt = e.at;
      if (e.kind === "login" || e.kind === "otp_login" || e.kind === "register") cur.logins++;
      if (e.kind === "product_view") cur.views++;
      if (e.kind === "add_to_cart") cur.carts++;
      if (e.kind === "order_place") cur.orders++;
      userMap.set(key, cur);
    }
    const users = [...userMap.values()].sort((a, b) => b.lastAt - a.lastAt).slice(0, 20);

    // Per-product breakdown
    const prodMap = new Map<string, { id: string; name: string; slug: string; views: number; carts: number; wishes: number }>();
    for (const e of inRange) {
      if (!e.productId) continue;
      const cur = prodMap.get(e.productId) ?? { id: e.productId, name: e.productName || "Product", slug: e.slug || "", views: 0, carts: 0, wishes: 0 };
      if (e.kind === "product_view") cur.views++;
      if (e.kind === "add_to_cart") cur.carts++;
      if (e.kind === "wishlist_add") cur.wishes++;
      prodMap.set(e.productId, cur);
    }
    const topProducts = [...prodMap.values()].sort((a, b) => b.views - a.views || b.carts - a.carts).slice(0, 12);

    // Top searches & pages
    const searchMap = new Map<string, number>();
    const pageMap = new Map<string, number>();
    for (const e of inRange) {
      if (e.kind === "search" && e.meta) {
        const q = e.meta.toLowerCase().trim();
        if (q) searchMap.set(q, (searchMap.get(q) ?? 0) + 1);
      }
      if (e.kind === "page_view" && e.meta) {
        const p = e.meta.split("?")[0] || "/";
        pageMap.set(p, (pageMap.get(p) ?? 0) + 1);
      }
    }
    const topSearches = [...searchMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topPages = [...pageMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    return { logins, failedLogins, signups, pageViews, productViews, carts, checkouts, activeUsers: activeUserIds.size, ordersCount: ordersInRange.length, revenue, users, topProducts, topSearches, topPages };
  }, [inRange, ordersInRange]);

  const feed = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inRange.filter((e) => {
      if (group !== "all" && KIND_INFO[e.kind]?.group !== group) return false;
      if (selectedUser) {
        if (selectedUser.id ? e.userId !== selectedUser.id : e.userName !== selectedUser.name || !!e.userId) return false;
      }
      if (q) {
        const hay = `${e.userName ?? ""} ${e.productName ?? ""} ${e.meta ?? ""} ${KIND_INFO[e.kind]?.label ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).slice(0, 100);
  }, [inRange, group, selectedUser, query]);

  const kpis = [
    { label: "Logins", value: stats.logins.toLocaleString("en-IN"), sub: stats.failedLogins ? `${stats.failedLogins} failed` : "0 failed", icon: LogIn },
    { label: "New signups", value: stats.signups.toLocaleString("en-IN"), sub: `${stats.activeUsers} active users`, icon: UserPlus },
    { label: "Page views", value: stats.pageViews.toLocaleString("en-IN"), sub: `${stats.productViews} product views`, icon: Eye },
    { label: "Added to bag", value: stats.carts.toLocaleString("en-IN"), sub: stats.productViews ? `${Math.round((stats.carts / stats.productViews) * 100)}% view → bag` : "—", icon: ShoppingBag },
    { label: "Orders placed", value: stats.ordersCount.toLocaleString("en-IN"), sub: `₹${stats.revenue.toLocaleString("en-IN")}`, icon: ShoppingCart },
    { label: "Total events", value: inRange.length.toLocaleString("en-IN"), sub: `${stats.checkouts} checkouts started`, icon: TrendingUp },
  ];

  const funnel = [
    { label: "Page views", count: stats.pageViews, color: "bg-zinc-500" },
    { label: "Product views", count: stats.productViews, color: "bg-sky-500" },
    { label: "Added to bag", count: stats.carts, color: "bg-emerald-500" },
    { label: "Started checkout", count: stats.checkouts, color: "bg-violet-500" },
    { label: "Orders placed", count: stats.ordersCount, color: "bg-brand-500" },
  ];
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)} className={`chip ${range === r.key ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : ""}`}>
              {r.label}
            </button>
          ))}
        </div>
        {stats.failedLogins > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <ShieldAlert className="size-3.5" /> {stats.failedLogins} failed login attempt{stats.failedLogins > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center justify-between text-zinc-500"><span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span><Icon className="size-4" /></div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">User journeys <span className="text-xs font-normal text-zinc-500">(click a user to filter their full timeline)</span></h2>
          </div>
          {stats.users.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No user activity in this time range yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[540px] text-sm">
                <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
                  <tr><th className="py-2">User</th><th className="text-right">Logins</th><th className="text-right">Views</th><th className="text-right">Bag</th><th className="text-right">Orders</th><th className="text-right">Last seen</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {stats.users.map((u) => {
                    const active = selectedUser && (selectedUser.id ? selectedUser.id === u.userId : !u.userId && selectedUser.name === u.name);
                    return (
                      <tr key={u.key} className={active ? "bg-brand-50/60 dark:bg-brand-950/20" : ""}>
                        <td className="py-2.5 font-medium"><span className="inline-flex items-center gap-1.5"><UserCheck className="size-3.5 text-zinc-400" />{u.name}</span></td>
                        <td className="text-right tabular-nums">{u.logins}</td>
                        <td className="text-right tabular-nums">{u.views}</td>
                        <td className="text-right font-semibold text-emerald-600 tabular-nums">{u.carts}</td>
                        <td className="text-right font-semibold text-brand-600 tabular-nums">{u.orders}</td>
                        <td className="text-right text-xs text-zinc-500">{ago(u.lastAt)}</td>
                        <td className="text-right">
                          <button onClick={() => setSelectedUser(active ? null : { id: u.userId, name: u.name })} className="text-xs font-semibold text-brand-600 hover:underline">
                            {active ? "Clear" : "Timeline"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

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
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">Product interest (views vs. bag)</h2>
          {stats.topProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No product activity recorded in this period.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
                  <tr><th className="py-2">Product</th><th className="text-right">Views</th><th className="text-right">Add to bag</th><th className="text-right">Wishlist</th><th className="text-right">View → Bag</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {stats.topProducts.map((p) => (
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
            <h2 className="mb-3 font-semibold">Top searches</h2>
            {stats.topSearches.length === 0 ? <p className="text-sm text-zinc-500">No searches yet.</p> : (
              <div className="flex flex-wrap gap-2">
                {stats.topSearches.map(([term, count]) => (
                  <span key={term} className="chip text-xs">{term} <b className="ml-1 text-brand-600">{count}</b></span>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Most visited pages</h2>
            {stats.topPages.length === 0 ? <p className="text-sm text-zinc-500">No page views yet.</p> : (
              <ul className="space-y-1.5 text-sm">
                {stats.topPages.map(([path, count]) => (
                  <li key={path} className="flex justify-between"><span className="truncate font-mono text-xs text-zinc-600 dark:text-zinc-300">{path}</span><b className="tabular-nums">{count}</b></li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Live activity feed</h2>
            {selectedUser && (
              <button onClick={() => setSelectedUser(null)} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
                User: {selectedUser.name} <X className="size-3" />
              </button>
            )}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by user, product, page..." className="input pl-9 text-sm" />
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {GROUPS.map((g) => (
            <button key={g.key} onClick={() => setGroup(g.key)} className={`chip text-xs ${group === g.key ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : ""}`}>
              {g.label}
            </button>
          ))}
        </div>

        {feed.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No matching activity found.</p>
        ) : (
          <ul className="max-h-[460px] divide-y divide-zinc-100 overflow-y-auto text-sm dark:divide-zinc-800">
            {feed.map((e) => {
              const info = KIND_INFO[e.kind] ?? { label: e.kind, tone: "bg-zinc-100 text-zinc-700" };
              return (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${info.tone}`}>{info.label}</span>
                    <button onClick={() => setSelectedUser({ id: e.userId, name: e.userName || "Guest" })} className="font-semibold hover:underline">
                      {e.userName || "Guest"}
                    </button>
                    {e.productName && (e.slug ? <Link href={`/product/${e.slug}`} target="_blank" className="text-zinc-700 hover:underline dark:text-zinc-300">{e.productName}</Link> : <span className="text-zinc-700 dark:text-zinc-300">{e.productName}</span>)}
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
