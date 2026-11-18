import Link from "next/link";
import { db } from "@/lib/db";
import { PageTitle } from "../_ui";
import TicketReply from "./TicketReply";

export default async function Support({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { status = "open" } = await searchParams;
  const d = db();
  const tickets = d.tickets.filter((t) => status === "all" || t.status === status).sort((a, b) => (b.messages.at(-1)?.at ?? 0) - (a.messages.at(-1)?.at ?? 0));
  return (
    <div>
      <PageTitle title="Support queries" />
      <nav className="mb-4 flex gap-1.5" aria-label="Ticket status">
        {[["open", "Open"], ["resolved", "Resolved"], ["all", "All"]].map(([k, l]) => <Link key={k} href={`/admin/support?status=${k}`} className={`chip text-sm ${status === k ? "chip-on" : ""}`}>{l} <span className="opacity-60">{k === "all" ? d.tickets.length : d.tickets.filter((t) => t.status === k).length}</span></Link>)}
      </nav>
      {tickets.length === 0 && <p className="card p-10 text-center text-sm text-zinc-500">No tickets here. 🎉</p>}
      <ul className="space-y-4">
        {tickets.map((t) => {
          const u = d.users.find((x) => x.id === t.userId);
          return (
            <li key={t.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h2 className="font-semibold">{t.subject}</h2><p className="text-xs text-zinc-500">{u?.name ?? "Unknown"} · {u?.email ?? u?.phone}{t.orderRef && <> · Order <span className="font-mono">{t.orderRef}</span></>}</p></div>
                <span className={`badge ${t.status === "open" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"}`}>{t.status}</span>
              </div>
              <div className="mt-4 space-y-2">
                {t.messages.map((m, i) => (
                  <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.from === "admin" ? "ml-auto bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                    <p className="whitespace-pre-wrap">{m.body}</p><p className="mt-1 text-[10px] opacity-60">{m.from === "admin" ? "Support" : "Customer"} · {new Date(m.at).toLocaleString("en-IN")}</p>
                  </div>
                ))}
              </div>
              <TicketReply id={t.id} open={t.status === "open"} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
