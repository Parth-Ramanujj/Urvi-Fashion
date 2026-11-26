"use client";
import Link from "next/link";
import { useState } from "react";
import { Bot, Clock, Camera, LayoutDashboard, ThumbsUp, Megaphone, MessageCircle, RefreshCw, Send, Settings as SettingsIcon, ShoppingBag, Sparkles, Users, Webhook, Zap } from "lucide-react";
import { Modal } from "@/components/ui";
import { useApp } from "@/components/Providers";
import {
  broadcastSocialMessages,
  registerArthaWebhook,
  replySocialMessage,
  retryIntegrationMessage,
  runCronNow,
  sendSegmentWhatsApp,
  sendWhatsAppChat,
  sendWhatsAppToCustomer,
  syncArthaNow,
  testArthaConnection,
  updateCrmProfile,
} from "@/lib/integration-actions";
import type { IntegrationMessage } from "@/lib/types";
import { useAct } from "../_ui";
import { AdsPanel } from "./AdsPanel";
import { AutomationPanel } from "./AutomationPanel";
import { SettingsPanel } from "./SettingsPanel";
import { SocialPanel } from "./SocialPanel";
import type { CrmCustomer, CrmData } from "./types";

type Tab = "overview" | "customers" | "inbox" | "automations" | "social" | "ads" | "settings";
const TABS: [Tab, string, typeof LayoutDashboard][] = [
  ["overview", "Overview", LayoutDashboard],
  ["customers", "Customers", Users],
  ["inbox", "Inbox", MessageCircle],
  ["automations", "Automations", Zap],
  ["social", "Social", Camera],
  ["ads", "Ads", Megaphone],
  ["settings", "Settings", SettingsIcon],
];

const ago = (t?: number) => {
  if (!t) return "—";
  const m = Math.floor((Date.now() - t) / 60_000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
};
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const display = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-IN") : typeof v === "string" && v ? v : "—");

function StatusBadge({ status }: { status: IntegrationMessage["status"] }) {
  const tone =
    status === "sent" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
    : status === "failed" ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
    : status === "queued" || status === "sending" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  return <span className={`badge ${tone}`}>{status}</span>;
}

export function CrmUI({ data }: { data: CrmData }) {
  const [tab, setTab] = useState<Tab>("overview");
  const { settings } = data;
  return (
    <div className="space-y-6">
      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${tab === id ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </div>

      {data.errors.length > 0 && (
        <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-semibold">Some live data could not be loaded</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">{data.errors.slice(0, 6).map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      {tab === "overview" && <Overview data={data} onTab={setTab} />}
      {tab === "customers" && <CustomersView data={data} />}
      {tab === "inbox" && <InboxView data={data} />}
      {tab === "automations" && <AutomationPanel automations={settings.automations} rules={settings.whatsapp.rules} />}
      {tab === "social" && <SocialPanel data={data} />}
      {tab === "ads" && <AdsPanel data={data} />}
      {tab === "settings" && <SettingsPanel data={data} />}
    </div>
  );
}

function Overview({ data, onTab }: { data: CrmData; onTab: (t: Tab) => void }) {
  const { pending, act } = useAct();
  const { toast } = useApp();
  const out = data.messages.filter((m) => m.direction === "out");
  const since = Date.now() - 30 * 86_400_000;
  const sent30 = out.filter((m) => m.status === "sent" && m.createdAt >= since).length;
  const queued = out.filter((m) => m.status === "queued" || m.status === "sending").length;
  const failed = out.filter((m) => m.status === "failed").length;
  const optedIn = data.customers.filter((c) => c.whatsappOptIn).length;
  const ready = data.sessions.find((s) => s.status === "ready");
  const wallet = obj(data.wallet);
  const metaSpend = data.meta.insight?.spend;
  const kpis = [
    { label: "WhatsApp", value: ready?.status ?? data.sessions[0]?.status ?? "not connected", sub: ready?.phone ? `+${ready.phone}` : settingsLine(data), icon: MessageCircle },
    { label: "Customers", value: data.customers.length, sub: `${optedIn} opted in to WhatsApp`, icon: Users },
    { label: "Messages sent · 30d", value: sent30, sub: `${queued} queued · ${failed} failed`, icon: Send },
    { label: "Social accounts", value: data.accounts.length, sub: `${data.rules.length} automation rules`, icon: Camera },
    { label: "Wallet", value: display(wallet.balance ?? wallet.balanceInr ?? wallet.amount), sub: "Artha message wallet", icon: ShoppingBag },
    { label: "Meta spend", value: metaSpend ? `₹${metaSpend}` : data.meta.configured ? "—" : "not configured", sub: data.meta.configured ? `${data.meta.campaigns.length} campaigns` : "Add ads credentials in Settings", icon: Megaphone },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {kpis.map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-zinc-500">{label}<Icon className="size-4" /></div>
            <p className="mt-2 truncate text-2xl font-bold capitalize tabular-nums">{value}</p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">{sub}</p>
          </div>
        ))}
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <button disabled={pending} className="btn-ghost px-3 py-1.5 text-xs" onClick={() => act(testArthaConnection, undefined, (r) => toast(`${r.count} Artha session${r.count === 1 ? "" : "s"} found`))}><RefreshCw className={`size-3.5 ${pending ? "animate-spin" : ""}`} />Test connection</button>
        <button disabled={pending} className="btn-ghost px-3 py-1.5 text-xs" onClick={() => act(syncArthaNow, undefined, (r) => toast(`Synced: ${r.accounts} accounts · ${r.rules} rules · ${r.threads} chats`))}><RefreshCw className="size-3.5" />Sync now</button>
        <button disabled={pending} className="btn-ghost px-3 py-1.5 text-xs" onClick={() => act(registerArthaWebhook, "Webhook registered")}><Webhook className="size-3.5" />Register webhook</button>
        <button disabled={pending} className="btn-ghost px-3 py-1.5 text-xs" onClick={() => act(runCronNow, undefined, (r) => toast(`Cron: ${r.sent} sent · ${r.failed} failed · ${r.abandoned} reminders queued`))}><Clock className="size-3.5" />Run cron now</button>
        <button onClick={() => onTab("settings")} className="btn-ghost ml-auto px-3 py-1.5 text-xs"><SettingsIcon className="size-3.5" />Settings</button>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Sessions</h2><span className="text-xs text-zinc-500">WhatsApp engine</span></div>
          {data.sessions.length === 0 ? <p className="text-sm text-zinc-500">No sessions loaded. Check the API key in Settings.</p> : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className={`size-2.5 rounded-full ${s.status === "ready" ? "bg-emerald-500" : "bg-amber-500"}`} />
                  <span className="min-w-0 flex-1"><b className="block truncate">{s.name ?? s.id}</b><span className="text-xs text-zinc-500">{s.phone ? `+${s.phone}` : s.engineType ?? "WhatsApp"}</span></span>
                  <span className="badge bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{s.status ?? "unknown"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Webhooks</h2><span className="text-xs text-zinc-500">Inbound triggers</span></div>
          {data.webhooks.length === 0 ? <p className="text-sm text-zinc-500">No webhook registered yet. Use “Register webhook” above (needs APP_URL).</p> : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.webhooks.map((w) => (
                <li key={w.id} className="py-2 text-sm">
                  <p className="truncate font-medium">{w.url}</p>
                  <p className="text-xs text-zinc-500">{(w.events ?? []).join(", ") || "all events"} · {w.active === false ? "inactive" : "active"}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Recent messages</h2><span className="text-xs text-zinc-500">Last {Math.min(8, data.messages.length)} of {data.messages.length}</span></div>
        {data.messages.length === 0 ? <p className="card p-6 text-center text-sm text-zinc-500">No CRM messages yet. Enable an automation or send a test message.</p> : (
          <div className="card divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.messages.slice(0, 8).map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                <span className="badge bg-zinc-100 capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{m.channel}</span>
                <span className="text-xs font-medium text-zinc-500">{m.direction === "in" ? "from" : "to"} {m.to || m.from || "—"}</span>
                <p className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">{m.body}</p>
                <span className="text-xs text-zinc-400">{ago(m.createdAt)}</span>
                <StatusBadge status={m.status} />
                {m.status === "failed" && <button onClick={() => act(() => retryIntegrationMessage(m.id), "Queued for retry")} className="btn-ghost px-2 py-1 text-xs">Retry</button>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const settingsLine = (data: CrmData) =>
  data.settings.whatsapp.configured ? `session ${data.settings.whatsapp.sessionId.slice(0, 8)}…` : "add API key + session";

function CustomersView({ data }: { data: CrmData }) {
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState("all");
  const [composer, setComposer] = useState<CrmCustomer | null>(null);
  const [text, setText] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [b, setB] = useState({ segment: "vip", message: "Hi {{first}}! A little something from {{brand}}: use code STYLE20 for 20% off your next order. {{link}}", confirm: false });
  const { pending, act } = useAct();
  const { toast } = useApp();
  const filtered = data.customers.filter((c) => {
    if (segment !== "all" && c.segment !== segment) return false;
    const hay = `${c.name} ${c.email ?? ""} ${c.phone ?? ""} ${c.tags.join(" ")}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });
  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email or tag" className="input min-w-48 flex-1 py-1.5 text-sm" />
        <select value={segment} onChange={(e) => setSegment(e.target.value)} className="input w-auto py-1.5 text-sm" aria-label="Segment">
          <option value="all">All segments</option>
          {["new", "active", "vip", "at_risk", "churned", "never"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <button onClick={() => setBroadcastOpen(true)} className="btn-brand px-3 py-1.5 text-xs"><Send className="size-3.5" />Segment WhatsApp</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500">
            <tr><th className="p-3">Customer</th><th>Segment</th><th>Orders</th><th>Spend</th><th>Tags</th><th>Opt-in</th><th className="p-3" /></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map((c) => (
              <tr key={c.id}>
                <td className="p-3">
                  <Link href={`/admin/customers/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                  <p className="text-xs text-zinc-500">{c.phone ? `+91 ${c.phone}` : c.email ?? "No contact"}{c.noteCount ? ` · ${c.noteCount} note${c.noteCount === 1 ? "" : "s"}` : ""}</p>
                </td>
                <td><span className="badge bg-zinc-100 capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{c.segment.replace("_", " ")}</span></td>
                <td className="tabular-nums">{c.orders}</td>
                <td className="tabular-nums">₹{c.spend.toLocaleString("en-IN")}</td>
                <td className="max-w-40"><span className="block truncate text-xs text-zinc-500">{c.tags.join(", ") || "—"}</span></td>
                <td>
                  <button disabled={pending} onClick={() => act(() => updateCrmProfile(c.id, { whatsappOptIn: !c.whatsappOptIn }), c.whatsappOptIn ? "WhatsApp opted out" : "WhatsApp opted in")}
                    className={`badge ${c.whatsappOptIn ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                    {c.whatsappOptIn ? "opted in" : "opted out"}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <button disabled={pending || !c.phone} onClick={() => { setComposer(c); setText(""); }} className="btn-ghost px-3 py-1 text-xs"><MessageCircle className="size-3.5" />WhatsApp</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-6 text-center text-sm text-zinc-500">No customers match this filter.</p>}
      </div>

      <Modal open={!!composer} onClose={() => setComposer(null)} title={composer ? `WhatsApp · ${composer.name}` : "WhatsApp"}>
        <form onSubmit={(e) => { e.preventDefault(); if (!composer) return; act(() => sendWhatsAppToCustomer(composer.id, text), "Message queued", () => { setComposer(null); setText(""); }); }} className="space-y-3">
          <p className="text-xs text-zinc-500">Sends from your connected WhatsApp session. The customer must be opted in. Use {"{{first}}"} or {"{{brand}}"} for personalisation.</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={1200} className="input" placeholder={`Hi ${composer?.name.split(" ")[0] ?? "there"}! …`} required />
          <button disabled={pending || !text.trim()} className="btn-brand w-full">{pending ? "Queueing…" : "Queue WhatsApp message"}</button>
        </form>
      </Modal>

      <Modal open={broadcastOpen} onClose={() => setBroadcastOpen(false)} title="WhatsApp campaign by segment" wide>
        <form onSubmit={(e) => { e.preventDefault(); act(() => sendSegmentWhatsApp({ segment: b.segment as never, message: b.message, confirm: b.confirm }), undefined, (r) => { setBroadcastOpen(false); toast(`Queued for ${r.sent} customers`); }); }} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="label">Segment</span><select value={b.segment} onChange={(e) => setB({ ...b, segment: e.target.value })} className="input">{["new", "active", "vip", "at_risk", "churned", "never"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></label>
            <div className="rounded-2xl bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-800/50"><Sparkles className="mb-1 size-4 text-brand-500" />Only customers with a phone number and WhatsApp opt-in receive it. Max 500 per send.</div>
          </div>
          <label><span className="label">Message</span><textarea value={b.message} onChange={(e) => setB({ ...b, message: e.target.value })} rows={4} maxLength={1200} className="input" required /></label>
          <p className="text-xs text-zinc-500">Placeholders: {"{{first}}"}, {"{{name}}"}, {"{{brand}}"}, {"{{link}}"}</p>
          <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={b.confirm} onChange={(e) => setB({ ...b, confirm: e.target.checked })} className="mt-0.5" />I understand this sends a real WhatsApp message to every opted-in customer in this segment.</label>
          <button disabled={pending || !b.confirm} className="btn-brand w-full">{pending ? "Queueing…" : "Queue campaign"}</button>
        </form>
      </Modal>
    </div>
  );
}

function InboxView({ data }: { data: CrmData }) {
  const [wa, setWa] = useState<{ to: string; name: string } | null>(null);
  const [social, setSocial] = useState<{ accountId: string; threadId: string; platform: "instagram" | "facebook"; name: string } | null>(null);
  const [text, setText] = useState("");
  const { pending, act } = useAct();
  const { toast } = useApp();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800"><h2 className="font-semibold">WhatsApp conversations</h2><span className="text-xs text-zinc-500">{data.conversations.length}</span></div>
        {data.conversations.length === 0 ? <p className="p-6 text-center text-sm text-zinc-500">No conversations loaded. Check Artha → Conversations.</p> : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.conversations.map((c) => {
              const to = c.chatId || c.phone || "";
              return (
                <li key={c.id} className="flex items-center gap-3 p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"><MessageCircle className="size-4" /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{c.contactName || c.phone || c.chatId || "Unknown"}</p><p className="truncate text-xs text-zinc-500">{c.lastMessage || c.status || "—"}</p></div>
                  <button disabled={!to} onClick={() => { setWa({ to, name: c.contactName || c.phone || to }); setText(""); }} className="btn-ghost px-2.5 py-1 text-xs">Reply</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800"><h2 className="font-semibold">Instagram / Facebook inbox</h2><span className="text-xs text-zinc-500">{data.threads.length}</span></div>
        {data.threads.length === 0 ? <p className="p-6 text-center text-sm text-zinc-500">No social threads. Connect an account in the Social tab.</p> : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.threads.map((t, i) => {
              const accountId = t.accountId ?? "";
              const threadId = t.threadId ?? t.id ?? "";
              const platform = (t.platform === "facebook" ? "facebook" : "instagram") as "instagram" | "facebook";
              const Icon = platform === "facebook" ? ThumbsUp : Camera;
              return (
                <li key={`${accountId}-${threadId}-${i}`} className="flex items-center gap-3 p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300"><Icon className="size-4" /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{t.name || t.username || threadId || "Thread"}</p><p className="truncate text-xs text-zinc-500">{t.lastMessage || t.platform || "—"}</p></div>
                  <button disabled={!accountId || !threadId} onClick={() => { setSocial({ accountId, threadId, platform, name: t.name || t.username || threadId }); setText(""); }} className="btn-ghost px-2.5 py-1 text-xs">Reply</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal open={!!wa} onClose={() => setWa(null)} title={`WhatsApp · ${wa?.name ?? ""}`}>
        <form onSubmit={(e) => { e.preventDefault(); if (!wa) return; act(() => sendWhatsAppChat(wa.to, text), "Message sent", () => { setWa(null); setText(""); }); }} className="space-y-3">
          <p className="text-xs text-zinc-500">To: {wa?.to}</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="input" required placeholder="Write a reply…" />
          <button disabled={pending || !text.trim()} className="btn-brand w-full">{pending ? "Sending…" : "Send WhatsApp"}</button>
        </form>
      </Modal>

      <Modal open={!!social} onClose={() => setSocial(null)} title={`${social?.platform === "facebook" ? "Facebook" : "Instagram"} · ${social?.name ?? ""}`}>
        <form onSubmit={(e) => { e.preventDefault(); if (!social) return; act(() => replySocialMessage({ ...social, text }), "Reply sent", () => { setSocial(null); setText(""); }); }} className="space-y-3">
          <p className="text-xs text-zinc-500">Replying inside Meta’s 24-hour messaging window.</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="input" required placeholder="Write a reply…" />
          <button disabled={pending || !text.trim()} className="btn-brand w-full">{pending ? "Sending…" : "Send reply"}</button>
        </form>
      </Modal>

      <div className="card p-4 lg:col-span-2">
        <h2 className="mb-1 font-semibold">Broadcast to social inbox</h2>
        <p className="mb-3 text-xs text-zinc-500">Message every Instagram or Facebook customer inside Meta’s 24-hour window. Artha enforces the window.</p>
        <BroadcastForm onDone={(n) => toast(n)} />
      </div>
    </div>
  );
}

function BroadcastForm({ onDone }: { onDone: (msg: string) => void }) {
  const { pending, act } = useAct();
  const [platform, setPlatform] = useState<"instagram" | "facebook">("instagram");
  const [text, setText] = useState("");
  const [confirm, setConfirm] = useState(false);
  return (
    <form onSubmit={(e) => { e.preventDefault(); act(() => broadcastSocialMessages({ platform, text, confirm }), "Broadcast queued", () => { setText(""); setConfirm(false); onDone("Broadcast sent"); }); }} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={platform} onChange={(e) => setPlatform(e.target.value as "instagram" | "facebook")} className="input w-auto py-1.5 text-sm"><option value="instagram">Instagram</option><option value="facebook">Facebook</option></select>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Diwali offer: 20% off today only!" className="input min-w-48 flex-1 py-1.5 text-sm" required />
        <button disabled={pending || !confirm} className="btn-brand px-3 py-1.5 text-xs">Broadcast</button>
      </div>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />I understand this messages every eligible social contact.</label>
    </form>
  );
}

export { ago, obj, display };
