"use client";
import { useState } from "react";
import { Plus, Save, Trash2, Zap } from "lucide-react";
import { Modal } from "@/components/ui";
import { removeAutoReplyRule, saveAutomation, saveAutoReplyRule } from "@/lib/integration-actions";
import type { Automation, WhatsAppAutoReplyRule } from "@/lib/types";
import { useAct } from "../_ui";

export function AutomationPanel({ automations, rules }: { automations: Automation[]; rules: WhatsAppAutoReplyRule[] }) {
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold">WhatsApp automations</h2>
          <p className="text-xs text-zinc-500">All automations are off by default — test one before enabling.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {automations.map((a) => <AutomationCard key={a.key} automation={a} />)}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="text-lg font-semibold">WhatsApp auto-reply rules</h2><p className="text-xs text-zinc-500">Inbound WhatsApp messages matching a keyword get an instant reply (once per customer per day when enabled).</p></div>
          <div className="flex flex-wrap gap-2">
            <QuickWaPreset />
            <NewRule />
          </div>
        </div>
        {rules.length === 0 ? <p className="card p-6 text-center text-sm text-zinc-500">No rules yet. Add a keyword rule to answer price, delivery or size questions automatically.</p> : (
          <div className="card divide-y divide-zinc-100 dark:divide-zinc-800">
            {rules.map((r) => <RuleRow key={r.id} rule={r} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function AutomationCard({ automation }: { automation: Automation }) {
  const [a, setA] = useState(automation);
  const { pending, act } = useAct();
  const dirty = a.enabled !== automation.enabled || a.template !== automation.template || a.delayMinutes !== automation.delayMinutes;
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/40"><Zap className="size-4" /></span>
          <div><p className="font-semibold">{a.name}</p><p className="text-xs text-zinc-500">{a.key.replace(/_/g, " ")}{a.sent ? ` · ${a.sent} sent` : ""}</p></div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium"><input type="checkbox" role="switch" checked={a.enabled} onChange={(e) => setA({ ...a, enabled: e.target.checked })} className="size-5 accent-brand-500" />{a.enabled ? "On" : "Off"}</label>
      </div>
      <label className="mt-3 block"><span className="label">Template</span><textarea value={a.template} onChange={(e) => setA({ ...a, template: e.target.value })} rows={3} maxLength={1500} className="input text-sm" /></label>
      <div className="mt-2 flex items-end gap-2">
        <label className="w-28"><span className="label">Delay (min)</span><input type="number" min={0} max={10080} value={a.delayMinutes} onChange={(e) => setA({ ...a, delayMinutes: +e.target.value })} className="input py-1.5 text-sm" /></label>
        <p className="flex-1 text-[11px] text-zinc-500">Placeholders: {"{{first}}"}, {"{{name}}"}, {"{{brand}}"}, {"{{orderRef}}"}, {"{{orderTotal}}"}, {"{{status}}"}, {"{{product}}"}, {"{{size}}"}, {"{{color}}"}, {"{{link}}"}</p>
        <button disabled={pending || !dirty} onClick={() => act(() => saveAutomation({ key: a.key, enabled: a.enabled, delayMinutes: a.delayMinutes, template: a.template }), "Automation saved")} className="btn-primary px-3 py-1.5 text-xs"><Save className="size-3.5" />Save</button>
      </div>
    </div>
  );
}

function RuleRow({ rule }: { rule: WhatsAppAutoReplyRule }) {
  const [open, setOpen] = useState(false);
  const { pending, act } = useAct();
  return (
    <div className="flex flex-wrap items-center gap-3 p-3">
      <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" role="switch" checked={rule.enabled} disabled={pending} onChange={(e) => act(() => saveAutoReplyRule({ ...rule, enabled: e.target.checked }), e.target.checked ? "Rule enabled" : "Rule disabled")} className="size-5 accent-brand-500" /></label>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{rule.name}</p>
        <p className="truncate text-xs text-zinc-500">{(rule.keywords ?? []).join(", ")} → {rule.reply}</p>
      </div>
      <button onClick={() => setOpen(true)} className="btn-ghost px-2.5 py-1 text-xs">Edit</button>
      <button disabled={pending} onClick={() => act(() => removeAutoReplyRule(rule.id), "Rule deleted")} className="btn-ghost px-2 py-1 text-xs text-rose-600"><Trash2 className="size-3.5" /></button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Edit · ${rule.name}`}>
        <RuleForm rule={rule} onDone={() => setOpen(false)} />
      </Modal>
    </div>
  );
}

function QuickWaPreset() {
  const { pending, act } = useAct();
  return (
    <button
      disabled={pending}
      onClick={() => act(() => saveAutoReplyRule({
        id: "price-catalogue",
        name: "Price & Catalogue",
        enabled: true,
        keywords: ["price", "rate", "cost", "catalog", "catalogue", "link"],
        reply: "Hi {{first}}! Check out our latest collection & prices here: {{link}} ✨",
        oncePerDay: true,
      }), "Price auto-reply added")}
      className="btn-ghost px-3 py-1.5 text-xs"
    >
      + Price preset
    </button>
  );
}

function NewRule() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary px-3 py-1.5 text-xs"><Plus className="size-3.5" />New rule</button>
      <Modal open={open} onClose={() => setOpen(false)} title="New auto-reply rule">
        <RuleForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function RuleForm({ rule, onDone }: { rule?: WhatsAppAutoReplyRule; onDone: () => void }) {
  const { pending, act } = useAct();
  const [f, setF] = useState<WhatsAppAutoReplyRule>(rule ?? { id: "", name: "", enabled: true, keywords: [], reply: "", oncePerDay: true });
  const [keywords, setKeywords] = useState((rule?.keywords ?? []).join(", "));
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const id = f.id || f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 30);
      act(() => saveAutoReplyRule({ ...f, id, keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean) }), "Rule saved", onDone);
    }} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">Name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={50} className="input" required placeholder="Price enquiry" /></label>
        <label><span className="label">Rule id</span><input value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} maxLength={30} className="input" placeholder="auto from name" /></label>
      </div>
      <label className="block"><span className="label">Keywords (comma separated)</span><input value={keywords} onChange={(e) => setKeywords(e.target.value)} className="input" placeholder="price, rate, kitna" required /></label>
      <label className="block"><span className="label">Reply</span><textarea value={f.reply} onChange={(e) => setF({ ...f, reply: e.target.value })} rows={4} maxLength={1200} className="input" required placeholder="Hi {{first}}! …" /></label>
      <div className="flex flex-wrap gap-4 text-xs">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />Enabled</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.oncePerDay} onChange={(e) => setF({ ...f, oncePerDay: e.target.checked })} />Once per customer per day</label>
      </div>
      <button disabled={pending} className="btn-brand w-full">{pending ? "Saving…" : "Save rule"}</button>
    </form>
  );
}
