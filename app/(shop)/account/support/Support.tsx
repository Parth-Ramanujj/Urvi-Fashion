"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MessageCircle, Plus, Send } from "lucide-react";
import { useApp } from "@/components/Providers";
import { createTicket, replyTicket } from "@/lib/actions";
import type { Ticket } from "@/lib/types";

const FAQ = [
  ["How do I return an item?", "Open the order under Orders and tap Return or Exchange size within 14 days of delivery. We'll pick it up for free."],
  ["When will I get my refund?", "Refunds reach your original payment method within 5–7 business days after pickup. COD orders are refunded to your bank/UPI."],
  ["Can I change my delivery address?", "You can cancel an order before it ships and place it again with the new address."],
];

export default function Support({ tickets, orderRefs }: { tickets: Ticket[]; orderRefs: string[] }) {
  const { toast, brand } = useApp();
  const router = useRouter();
  const [creating, setCreating] = useState(tickets.length === 0);
  const [openId, setOpenId] = useState<string | null>(tickets[0]?.id ?? null);
  const [reply, setReply] = useState("");
  const [pending, start] = useTransition();

  const create = (fd: FormData) => start(async () => {
    const r = await createTicket({ subject: String(fd.get("subject")), message: String(fd.get("message")), orderRef: String(fd.get("orderRef") ?? "") });
    if (!r.ok) return toast(r.error, "err");
    toast("We've got your message — we usually reply within a few hours"); setCreating(false); router.refresh();
  });
  const send = (id: string) => start(async () => {
    const r = await replyTicket(id, reply);
    if (!r.ok) return toast(r.error, "err");
    setReply(""); router.refresh();
  });

  return (
    <div className="space-y-6">
      <section className="card divide-y divide-zinc-200 dark:divide-zinc-800">
        {FAQ.map(([q, a]) => <details key={q} className="p-4"><summary className="cursor-pointer font-medium">{q}</summary><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{a}</p></details>)}
      </section>

      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Your tickets</h2>{!creating && <button onClick={() => setCreating(true)} className="btn-primary py-2"><Plus className="size-4" />New ticket</button>}</div>
      {creating && (
        <form action={create} className="card space-y-3 p-5">
          <label className="block"><span className="label">Subject</span><input name="subject" required minLength={3} maxLength={120} className="input" /></label>
          <label className="block"><span className="label">Related order (optional)</span><select name="orderRef" className="input"><option value="">None</option>{orderRefs.map((r) => <option key={r}>{r}</option>)}</select></label>
          <label className="block"><span className="label">How can we help?</span><textarea name="message" required minLength={5} rows={4} className="input" /></label>
          <div className="flex gap-2"><button disabled={pending} className="btn-primary">Send</button>{tickets.length > 0 && <button type="button" onClick={() => setCreating(false)} className="btn-ghost">Cancel</button>}</div>
        </form>
      )}

      <ul className="space-y-3">
        {tickets.map((t) => (
          <li key={t.id} className="card overflow-hidden">
            <button onClick={() => setOpenId(openId === t.id ? null : t.id)} className="flex w-full items-center gap-3 p-4 text-left">
              <MessageCircle className="size-5 text-zinc-400" />
              <span className="flex-1"><span className="block font-medium">{t.subject}</span><span className="text-xs text-zinc-500">{t.orderRef && `${t.orderRef} · `}{t.messages.length} messages</span></span>
              <span className={`badge ${t.status === "open" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"}`}>{t.status}</span>
            </button>
            {openId === t.id && (
              <div className="space-y-3 border-t border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                {t.messages.map((m, i) => (
                  <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.from === "customer" ? "ml-auto bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-white dark:bg-zinc-800"}`}>
                    {m.from === "admin" && <p className="text-xs font-semibold text-brand-600">{brand.name} Support</p>}
                    <p>{m.body}</p>
                    <p className="mt-1 text-[10px] opacity-60" suppressHydrationWarning>{new Date(m.at).toLocaleString()}</p>
                  </div>
                ))}
                <form onSubmit={(e) => { e.preventDefault(); send(t.id); }} className="flex gap-2">
                  <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" className="input" aria-label="Reply" />
                  <button disabled={pending || !reply.trim()} className="btn-primary px-4" aria-label="Send reply"><Send className="size-4" /></button>
                </form>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
