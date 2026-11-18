import Link from "next/link";
import { Search } from "lucide-react";
import { Money } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lifetimeSpend, tierOf } from "@/lib/retention-core";
import { AdjustCoins } from "../retention/Retention";
import { PageTitle } from "../_ui";
import UserControls from "./UserControls";

export default async function Customers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { q = "", role = "" } = await searchParams;
  const me = await currentUser();
  const d = db();
  const stats = new Map<string, { orders: number; spend: number }>();
  for (const o of d.orders) {
    const s = stats.get(o.userId) ?? { orders: 0, spend: 0 };
    s.orders++; if (!["cancelled", "returned"].includes(o.status)) s.spend += o.totals.total;
    stats.set(o.userId, s);
  }
  const term = q.trim().toLowerCase();
  const users = d.users
    .filter((u) => (!role || (role === "blocked" ? u.blocked : u.role === role)) && (!term || `${u.name} ${u.email ?? ""} ${u.phone ?? ""}`.toLowerCase().includes(term)))
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div>
      <PageTitle title="Customers" />
      <form className="card mb-4 flex flex-wrap gap-2 p-3">
        <label className="relative min-w-48 flex-1"><span className="sr-only">Search users</span><Search className="absolute left-3 top-3 size-4 text-zinc-400" /><input name="q" defaultValue={q} placeholder="Name, email or phone" className="input pl-9" /></label>
        <select name="role" defaultValue={role} className="input w-auto" aria-label="Role"><option value="">All users</option><option value="customer">Customers</option><option value="delivery">Delivery partners</option><option value="admin">Admins</option><option value="blocked">Blocked</option></select>
        <button className="btn-primary">Filter</button>
      </form>
      <p className="mb-2 text-sm text-zinc-500">{users.length} users</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800"><tr><th className="p-3 font-semibold">User</th><th className="font-semibold">Joined</th><th className="font-semibold">Last active</th><th className="font-semibold">Orders</th><th className="font-semibold">Spend</th><th className="font-semibold">Coins & tier</th><th className="p-3 font-semibold">Role & access</th></tr></thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map((u) => {
              const s = stats.get(u.id) ?? { orders: 0, spend: 0 };
              return (
                <tr key={u.id} className={u.blocked ? "bg-red-50/60 dark:bg-red-950/20" : ""}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-200 font-semibold dark:bg-zinc-700">{u.name[0]?.toUpperCase()}</span>
                      <span className="min-w-0"><span className="block font-medium"><Link href={`/admin/customers/${u.id}`} className="hover:underline">{u.name}</Link> {u.blocked && <span className="badge bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Blocked</span>}</span><span className="block truncate text-xs text-zinc-500">{[u.email, u.phone].filter(Boolean).join(" · ")}</span></span>
                    </div>
                  </td>
                  <td className="text-zinc-500">{new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
                  <td className="text-zinc-500">{new Date(u.lastActiveAt).toLocaleDateString("en-IN")}</td>
                  <td className="tabular-nums">{s.orders}</td>
                  <td><Money v={s.spend} /></td>
                  <td>{u.role === "customer" ? (() => { const t = tierOf(lifetimeSpend(d, u.id), d.retention.tiers).tier; return <div className="flex items-center gap-2"><span className="tabular-nums">🪙 {(u.coins ?? 0).toLocaleString("en-IN")}</span><span className="badge text-white" style={{ background: t.color }}>{t.name}</span><AdjustCoins userId={u.id} name={u.name} /></div>; })() : <span className="text-zinc-400">—</span>}</td>
                  <td className="p-3"><UserControls id={u.id} role={u.role} blocked={u.blocked} self={u.id === me?.id} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
