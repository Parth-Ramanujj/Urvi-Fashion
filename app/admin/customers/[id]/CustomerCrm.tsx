"use client";
import { useState } from "react";
import { MessageCircle, Save, Send } from "lucide-react";
import { sendWhatsAppToCustomer, updateCrmProfile } from "@/lib/integration-actions";
import type { CrmProfile } from "@/lib/types";
import { useAct } from "../../_ui";

const when = (t?: number) => (t ? new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

export default function CustomerCrm({ userId, name, phone, crm }: { userId: string; name: string; phone?: string; crm?: CrmProfile }) {
  const { pending, act } = useAct();
  const [optIn, setOptIn] = useState(crm?.whatsappOptIn !== false);
  const [tags, setTags] = useState((crm?.tags ?? []).join(", "));
  const [note, setNote] = useState("");
  const [message, setMessage] = useState(`Hi ${name.split(" ")[0]}! `);

  return (
    <section className="card mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="flex items-center gap-2 font-semibold"><MessageCircle className="size-4 text-brand-500" />WhatsApp CRM</h2><p className="mt-0.5 text-xs text-zinc-500">{phone || "No phone number on this customer"}{crm?.lastContactedAt ? ` · last contacted ${when(crm.lastContactedAt)}` : ""}{crm?.lastInboundAt ? ` · last replied ${when(crm.lastInboundAt)}` : ""}</p></div>
        <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" role="switch" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="size-4 accent-brand-500" />WhatsApp opt-in</label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block"><span className="label">Tags (comma separated)</span><input value={tags} onChange={(e) => setTags(e.target.value)} className="input" placeholder="vip, wholesale, festive" /></label>
          <label className="block"><span className="label">Add an internal note</span><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} className="input" placeholder="Prefers XL, call before delivery…" /></label>
          <button disabled={pending} onClick={() => act(() => updateCrmProfile(userId, { whatsappOptIn: optIn, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), note }), "CRM profile saved", () => setNote(""))} className="btn-primary px-3 py-1.5 text-xs"><Save className="size-3.5" />Save profile</button>
        </div>
        <div>
          <span className="label">Send WhatsApp now</span>
          <div className="flex gap-2">
            <input value={message} onChange={(e) => setMessage(e.target.value)} className="input" placeholder="Type a message…" disabled={!phone || !optIn} />
            <button disabled={pending || !phone || !optIn} onClick={() => act(() => sendWhatsAppToCustomer(userId, message), "WhatsApp message queued", () => setMessage(""))} className="btn-brand px-3 py-2"><Send className="size-4" /></button>
          </div>
          {!optIn && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">This customer opted out — automatic and manual WhatsApp sends are blocked.</p>}
          {!phone && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Add a phone number to this customer before sending WhatsApp.</p>}
        </div>
      </div>

      {(crm?.notes ?? []).length > 0 && (
        <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Recent notes</p>
          <ul className="space-y-2">
            {(crm?.notes ?? []).slice(0, 5).map((n) => (
              <li key={n.id} className="rounded-xl bg-zinc-50 p-2.5 text-sm dark:bg-zinc-800/60"><p>{n.body}</p><p className="mt-0.5 text-[11px] text-zinc-500">{n.by} · {when(n.at)}</p></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
