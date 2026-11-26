import { Gift, ShoppingBag, Star, Users } from "lucide-react";
import { Money } from "@/components/ui";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lifetimeSpend, tierOf } from "@/lib/retention-core";
import ShareReferral from "./ShareReferral";
import SocialFollow from "./SocialFollow";

export const metadata = { title: "Rewards" };

export default async function Rewards() {
  const u = await pageUser("/account/rewards");
  const d = db();
  const r = d.retention;
  const spend = lifetimeSpend(d, u.id);
  const { tier, next } = tierOf(spend, r.tiers);
  const pct = next ? Math.min(100, ((spend - tier.minSpend) / (next.minSpend - tier.minSpend)) * 100) : 100;
  const ledger = d.coinLedger.filter((e) => e.userId === u.id).sort((a, b) => b.at - a.at).slice(0, 30);
  const invited = d.users.filter((x) => x.referredBy === u.id);
  const refReward = r.referral.rewardType === "coupon" ? `a ₹${r.referral.referrerCoins} coupon` : `${r.referral.referrerCoins} coins`;
  const myCoupons = d.coupons.filter((c) => c.active && c.userIds?.includes(u.id) && (!c.expiresAt || c.expiresAt > Date.now()) && !d.orders.some((o) => o.userId === u.id && o.couponCode === c.code && o.status !== "cancelled"));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 p-6 text-white shadow-lg">
          <span className="absolute -right-6 -top-6 text-[120px] leading-none opacity-20" aria-hidden>🪙</span>
          <p className="text-sm font-medium capitalize text-white/85">{d.brand!.coinName} balance</p>
          <p className="mt-1 text-5xl font-black tabular-nums">{(u.coins ?? 0).toLocaleString("en-IN")}</p>
          <p className="mt-1 text-sm text-white/90">Worth <Money v={u.coins ?? 0} className="font-semibold" /> · 1 = ₹1</p>
          {r.loyalty.enabled ? <p className="mt-4 text-xs text-white/85">Use up to {r.loyalty.maxRedeemPct}% of any order at checkout.</p> : <p className="mt-4 text-xs">Coin rewards are paused right now.</p>}
        </section>

        <section className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="label mb-0">Your tier</p>
              <p className="text-2xl font-bold" style={{ color: tier.color }}>{tier.name}</p>
            </div>
            <span className="grid size-14 place-items-center rounded-full text-white shadow-inner" style={{ background: tier.color }}><Star className="size-7 fill-white" /></span>
          </div>
          <p className="mt-2 text-sm text-zinc-500">You earn <b className="text-zinc-900 dark:text-white">{tier.multiplier}×</b> coins on every order.</p>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: next?.color ?? tier.color }} /></div>
          <p className="mt-2 text-xs text-zinc-500">{next ? <>Spend <Money v={next.minSpend - spend} className="font-semibold text-zinc-900 dark:text-white" /> more to reach <b style={{ color: next.color }}>{next.name}</b> ({next.multiplier}× coins)</> : "You're at our highest tier — thank you! 💛"}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {r.tiers.map((t) => <span key={t.name} className={`badge ring-1 ${t.name === tier.name ? "text-white" : "text-zinc-600 ring-zinc-200 dark:text-zinc-300 dark:ring-zinc-700"}`} style={t.name === tier.name ? { background: t.color } : undefined}>{t.name} · {t.multiplier}×</span>)}
          </div>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">How to earn</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [ShoppingBag, "Shop", r.loyalty.enabled ? `${r.loyalty.earnPer100} coins per ₹100 on delivered orders` : "Paused"],
            [Users, "Refer friends", r.referral.enabled ? `${refReward} when a friend gets their first order` : "Paused"],
            [Gift, "Friends get", r.referral.enabled ? `${r.referral.refereeCoins} bonus coins when they join` : "Paused"],
          ].map(([I, t, s]) => {
            const Icon = I as typeof Gift;
            return <div key={t as string} className="flex gap-3 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/50"><Icon className="size-5 shrink-0 text-brand-500" /><div><p className="text-sm font-semibold">{t as string}</p><p className="text-xs text-zinc-500">{s as string}</p></div></div>;
          })}
        </div>
      </section>

      {r.referral.enabled && u.referralCode && (
        <section className="card overflow-hidden">
          <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 p-5 text-white">
            <h2 className="text-lg font-bold">Refer & earn 🎁</h2>
            <p className="text-sm text-white/85">Refer a friend &amp; earn {refReward}! Your friend gets {r.referral.refereeCoins} coins on joining; you get {refReward} when their first order arrives.</p>
          </div>
          <div className="p-5">
            <ShareReferral code={u.referralCode} />
            <p className="mt-3 text-sm text-zinc-500">{invited.length} friends joined · {invited.filter((x) => x.referralRewarded).length} rewarded</p>
          </div>
        </section>
      )}

      {myCoupons.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Your personal coupons 🎟️</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {myCoupons.map((c) => <li key={c.code} className="rounded-xl border-2 border-dashed border-violet-300 p-3 dark:border-violet-800"><p className="font-mono font-bold">{c.code}</p><p className="text-xs text-zinc-500">{c.description}{c.expiresAt ? ` · valid till ${new Date(c.expiresAt).toLocaleDateString("en-IN")}` : ""}</p></li>)}
          </ul>
        </section>
      )}

      {r.social?.enabled && r.social.links.length > 0 && <SocialFollow links={r.social.links} coins={r.social.coins} claimed={u.socialClaimed ?? []} />}

      <section className="card">
        <h2 className="border-b border-zinc-200 p-5 font-semibold dark:border-zinc-800">Coin history</h2>
        {ledger.length === 0 ? <p className="p-5 text-sm text-zinc-500">No coin activity yet.</p> : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {ledger.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div><p>{e.reason}</p><p className="text-xs text-zinc-500">{new Date(e.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p></div>
                <span className={`shrink-0 font-semibold tabular-nums ${e.amount > 0 ? "text-emerald-600" : "text-red-600"}`}>{e.amount > 0 ? "+" : ""}{e.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
