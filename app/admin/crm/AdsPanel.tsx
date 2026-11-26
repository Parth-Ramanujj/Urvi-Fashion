"use client";
import { useState } from "react";
import { BarChart3, ExternalLink, Megaphone, Plus } from "lucide-react";
import { createMetaCampaignAction, testMetaConnection } from "@/lib/integration-actions";
import { useAct } from "../_ui";
import type { CrmData } from "./types";

const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-IN") : typeof v === "string" && v ? v : "—");
const row = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const pick = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  return undefined;
};

export function AdsPanel({ data }: { data: CrmData }) {
  const [open, setOpen] = useState(false);
  const { pending, act } = useAct();
  const insight = data.meta.insight;
  const ads = Array.isArray(data.waAds) ? data.waAds.map(row) : [];
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="text-lg font-semibold">Meta Ads</h2><p className="text-xs text-zinc-500">Pixel + Conversions API + paused campaign creation. Nothing spends until you review it in Ads Manager.</p></div>
          <button disabled={pending} onClick={() => act(testMetaConnection, "Meta connection OK")} className="btn-ghost px-3 py-1.5 text-xs">Test Meta connection</button>
        </div>
        {!data.meta.configured ? (
          <div className="card p-5 text-sm text-zinc-500">
            <p className="font-medium text-zinc-900 dark:text-white">Meta is not configured</p>
            <p className="mt-1">Add the Pixel id, Conversions API token, ads token and ad account id in the Settings tab. The storefront starts sending Purchase events once tracking is enabled.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                ["Spend", insight?.spend ? `₹${insight.spend}` : "—"],
                ["Impressions", n(insight?.impressions)],
                ["Clicks", n(insight?.clicks)],
                ["CTR", insight?.ctr ? `${insight.ctr}%` : "—"],
                ["CPC", insight?.cpc ? `₹${insight.cpc}` : "—"],
              ].map(([label, value]) => (
                <div key={label} className="card p-4"><p className="text-xs font-semibold uppercase text-zinc-500">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{value}</p></div>
              ))}
            </div>

            <div className="mt-4 card overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
                <h3 className="font-semibold">Campaigns</h3>
                <button onClick={() => setOpen(true)} className="btn-primary px-3 py-1.5 text-xs"><Plus className="size-3.5" />New paused campaign</button>
              </div>
              {data.meta.campaigns.length === 0 ? <p className="p-6 text-center text-sm text-zinc-500">No campaigns yet.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="text-left text-xs uppercase text-zinc-500"><tr><th className="p-3">Campaign</th><th>Objective</th><th>Status</th><th>Daily budget</th></tr></thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {data.meta.campaigns.map((c) => (
                        <tr key={c.id}><td className="p-3 font-medium">{c.name || c.id}</td><td className="capitalize text-zinc-500">{c.objective?.toLowerCase().replace(/_/g, " ") || "—"}</td><td><span className={`badge ${c.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}>{c.status || "—"}</span></td><td>{c.daily_budget ? `₹${(Number(c.daily_budget) / 100).toLocaleString("en-IN")}` : "—"}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Click-to-WhatsApp ads</h2>
        <p className="mb-3 text-xs text-zinc-500">Conversations that started from WhatsApp ads, grouped by ad (from Artha).</p>
        {ads.length === 0 ? <p className="card p-6 text-center text-sm text-zinc-500">No ad conversations found.</p> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ads.slice(0, 12).map((a, i) => {
              const title = pick(a, ["adName", "name", "title", "ad_name", "campaignName"]);
              const chats = pick(a, ["chats", "conversations", "leads", "count"]);
              const spend = pick(a, ["spend", "cost", "amount"]);
              return (
                <div key={String(pick(a, ["id", "adId"]) ?? i)} className="card p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Megaphone className="size-4 text-brand-500" />{title ? String(title) : `Ad ${i + 1}`}</div>
                  <div className="mt-2 flex gap-4 text-xs text-zinc-500"><span>{chats !== undefined ? `${String(chats)} chats` : "—"}</span><span>{spend !== undefined ? `₹${String(spend)} spend` : "—"}</span></div>
                  <details className="mt-2"><summary className="cursor-pointer text-[11px] text-zinc-400">Raw data</summary><pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-zinc-50 p-2 text-[10px] dark:bg-zinc-800/60">{JSON.stringify(a, null, 1)}</pre></details>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {open && <CampaignModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function CampaignModal({ onClose }: { onClose: () => void }) {
  const { pending, act } = useAct();
  const [f, setF] = useState({ name: "", objective: "OUTCOME_SALES", dailyBudget: 500 });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">New Meta campaign</h2><button onClick={onClose} className="btn-ghost px-2 py-1 text-xs">Close</button></div>
        <form onSubmit={(e) => { e.preventDefault(); act(() => createMetaCampaignAction(f), "Paused campaign created", onClose); }} className="space-y-3">
          <p className="rounded-2xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><BarChart3 className="mb-1 inline size-4" /> The campaign is created with status <b>PAUSED</b>. Add the ad set, creative and targeting in Meta Ads Manager, then publish.</p>
          <label className="block"><span className="label">Campaign name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="input" required placeholder="Threadly · Festive sale" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="label">Objective</span><select value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} className="input"><option value="OUTCOME_SALES">Sales</option><option value="OUTCOME_TRAFFIC">Traffic</option><option value="OUTCOME_ENGAGEMENT">Engagement</option><option value="OUTCOME_AWARENESS">Awareness</option></select></label>
            <label><span className="label">Daily budget ₹</span><input type="number" min={0} value={f.dailyBudget} onChange={(e) => setF({ ...f, dailyBudget: +e.target.value })} className="input" /></label>
          </div>
          <button disabled={pending} className="btn-brand w-full">{pending ? "Creating…" : "Create paused campaign"}</button>
          <a href="https://adsmanager.facebook.com/" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 text-xs text-zinc-500 hover:underline">Open Meta Ads Manager <ExternalLink className="size-3" /></a>
        </form>
      </div>
    </div>
  );
}
