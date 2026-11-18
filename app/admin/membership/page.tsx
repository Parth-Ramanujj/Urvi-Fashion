import Link from "next/link";
import { Crown, IndianRupee, Repeat, Users } from "lucide-react";
import { Money } from "@/components/ui";
import { db } from "@/lib/db";
import { PageTitle } from "../_ui";
import { MemberActions, PlansEditor } from "./Membership";

export const dynamic = "force-dynamic";
export const metadata = { title: "Membership" };
const DAY = 86_400_000;

export default async function MembershipAdmin() {
  const d = db();
  const now = Date.now();
  const m = d.retention.membership ?? { enabled: false, plans: [] };
  const buys = d.memberships ?? [];
  const members = d.users.filter((u) => u.membership).map((u) => ({ u, plan: m.plans.find((p) => p.id === u.membership!.planId), paid: buys.filter((b) => b.userId === u.id).reduce((s, b) => s + b.price, 0), active: u.membership!.expiresAt > now }))
    .sort((a, b) => Number(b.active) - Number(a.active) || b.u.membership!.expiresAt - a.u.membership!.expiresAt);
  const active = members.filter((x) => x.active);
  const perUser = new Map<string, number>();
  buys.forEach((b) => perUser.set(b.userId, (perUser.get(b.userId) ?? 0) + 1));
  const tiles = [
    { label: "Active members", value: active.length.toLocaleString("en-IN"), sub: m.plans.map((p) => `${p.name}: ${active.filter((x) => x.plan?.id === p.id).length}`).join(" · ") || "No plans", icon: Users },
    { label: "Revenue · all time", value: <Money v={buys.reduce((s, b) => s + b.price, 0)} />, sub: `${buys.length} purchases`, icon: IndianRupee },
    { label: "Revenue · 30 days", value: <Money v={buys.filter((b) => b.at >= now - 30 * DAY).reduce((s, b) => s + b.price, 0)} />, sub: `${buys.filter((b) => b.at >= now - 30 * DAY).length} purchases`, icon: Crown },
    { label: "Renewals", value: [...perUser.values()].filter((n) => n > 1).length.toLocaleString("en-IN"), sub: "members who bought more than once", icon: Repeat },
  ];

  return (
    <div>
      <PageTitle title="Membership"><Link href="/membership" target="_blank" className="btn-ghost text-sm">View customer page</Link></PageTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-zinc-500">{t.label}<t.icon className="size-4" /></div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{t.value}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{t.sub}</p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Plans & perks</h2>
        <PlansEditor enabled={m.enabled} plans={m.plans} sold={m.plans.filter((p) => buys.some((b) => b.planId === p.id) || d.users.some((u) => u.membership?.planId === p.id)).map((p) => p.id)} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Members <span className="text-sm font-normal text-zinc-500">({members.length})</span></h2>
        {members.length === 0 ? <p className="card p-8 text-center text-sm text-zinc-500">No members yet.</p> : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800"><tr><th className="p-3">Customer</th><th>Plan</th><th>Since</th><th>Expires</th><th>Days left</th><th>Total paid</th><th className="p-3" /></tr></thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {members.map(({ u, plan, paid, active: on }) => (
                  <tr key={u.id} className={on ? "" : "opacity-60"}>
                    <td className="p-3"><Link href={`/admin/customers/${u.id}`} className="font-medium hover:underline">{u.name}</Link><span className="block text-xs text-zinc-500">{u.email ?? u.phone}</span></td>
                    <td><span className="badge text-white" style={{ background: plan?.color ?? "#71717a" }}>{plan?.name ?? u.membership!.planId}</span></td>
                    <td className="text-zinc-500">{new Date(u.membership!.since).toLocaleDateString("en-IN")}</td>
                    <td className="text-zinc-500">{new Date(u.membership!.expiresAt).toLocaleDateString("en-IN")}</td>
                    <td className="tabular-nums">{on ? Math.ceil((u.membership!.expiresAt - now) / DAY) : <span className="text-red-600">Expired</span>}</td>
                    <td><Money v={paid} /></td>
                    <td className="p-3"><MemberActions userId={u.id} active={on} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
