import Link from "next/link";
import { Coins, Crown, Percent, Truck } from "lucide-react";
import { Money } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { activePlan } from "@/lib/retention-core";
import BuyPlan from "./BuyPlan";
import { memberProgram } from "@/lib/brand";
import { getBrand } from "@/lib/server-utils";

export const dynamic = "force-dynamic";
export const generateMetadata = () => ({ title: `${memberProgram(getBrand())} membership` });

export default async function Membership() {
  const u = await currentUser();
  const d = db();
  const cfg = d.retention.membership;
  const plans = (cfg?.plans ?? []).filter((p) => p.active);
  const mine = activePlan(d, u);
  // What the shopper's last 90 days of orders would have saved them as a member (best plan).
  const since = Date.now() - 90 * 86_400_000;
  const recent = u ? d.orders.filter((o) => o.userId === u.id && o.createdAt >= since && o.status !== "cancelled") : [];
  const best = Math.max(0, ...plans.map((p) => p.discountPct));
  const couldSave = Math.round(recent.reduce((s, o) => s + (o.totals.mrp - o.totals.discount - o.totals.coupon) * (best / 100) + (o.totals.delivery || 0), 0));

  if (!cfg?.enabled || !plans.length) return <div className="mx-auto max-w-lg px-4 py-20 text-center"><Crown className="mx-auto size-10 text-zinc-400" /><h1 className="mt-4 text-2xl font-bold">Memberships are coming soon</h1></div>;

  return (
    <div className="pb-10">
      <section className="bg-gradient-to-br from-brand-800 via-brand-600 to-amber-500 px-4 py-12 text-center text-white md:py-16">
        <Crown className="mx-auto size-12 fill-amber-300 text-amber-300" />
        <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">{memberProgram(d.brand!)}</h1>
        <p className="mx-auto mt-3 max-w-md text-white/85">Members save on every single order — extra discount, free delivery and faster coins.</p>
        {mine && u?.membership && <p className="mx-auto mt-5 inline-block rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur">👑 You&apos;re a {mine.name} member until {new Date(u.membership.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>}
        {!mine && couldSave > 0 && <p className="mx-auto mt-5 inline-block rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur">You could have saved <Money v={couldSave} /> in the last 90 days</p>}
      </section>

      <div className="mx-auto max-w-5xl px-4">
        <div className="-mt-8 grid gap-3 sm:grid-cols-3">
          {[[Percent, `Up to ${best}% off`, "Member discount on top of sale prices and coupons"], [Truck, "Free delivery", "Standard and express, every order, no minimum"], [Coins, "Faster coins", "Earn up to " + Math.max(...plans.map((p) => p.coinMultiplier)) + "× coins on delivered orders"]].map(([I, t, s]) => {
            const Icon = I as typeof Crown;
            return <div key={t as string} className="card flex gap-3 p-4 shadow-lg"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"><Icon className="size-5" /></span><div><p className="font-semibold">{t as string}</p><p className="text-xs text-zinc-500">{s as string}</p></div></div>;
          })}
        </div>

        <h2 className="mt-12 text-center font-display text-3xl font-bold">Choose your plan</h2>
        <div className="mx-auto mt-6 grid max-w-3xl gap-4 md:grid-cols-2">
          {plans.map((p) => {
            const current = mine?.id === p.id;
            return (
              <div key={p.id} className={`card relative overflow-hidden p-6 ${current ? "ring-2" : ""}`} style={current ? { borderColor: p.color, ["--tw-ring-color" as string]: p.color } : undefined}>
                <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: p.color }} />
                <p className="text-sm font-semibold" style={{ color: p.color }}>{p.tagline}</p>
                <h3 className="mt-1 text-2xl font-bold">{p.name}</h3>
                <p className="mt-3"><Money v={p.price} className="text-4xl font-black" /><span className="text-zinc-500"> / {p.days >= 360 ? "year" : `${p.days} days`}</span></p>
                <ul className="mt-5 space-y-2 text-sm">
                  <li>✓ <b>{p.discountPct}% extra off</b> every order</li>
                  {p.freeDelivery && <li>✓ <b>Free delivery</b> — standard & express</li>}
                  <li>✓ <b>{p.coinMultiplier}× coins</b> on delivered orders</li>
                  <li>✓ Member-only offers in your notifications</li>
                </ul>
                <div className="mt-6">
                  {u ? <BuyPlan planId={p.id} price={p.price} name={p.name} renew={current} color={p.color} />
                    : <Link href="/login?next=/membership" className="btn-primary w-full">Log in to join</Link>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-xs text-zinc-500">Renewing the same plan extends it from your current expiry date. Member discount applies after coupons; coins can still be used.</p>
      </div>
    </div>
  );
}
