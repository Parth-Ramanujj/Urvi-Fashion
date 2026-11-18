"use client";
import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { adminReplyTicket } from "@/lib/admin-actions";
import { useAct } from "../_ui";

export default function TicketReply({ id, open }: { id: string; open: boolean }) {
  const [msg, setMsg] = useState("");
  const { pending, act } = useAct();
  const send = (resolve: boolean) => act(() => adminReplyTicket(id, msg, resolve), resolve ? "Ticket resolved" : "Reply sent", () => setMsg(""));
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(false); }} className="mt-4 flex flex-col gap-2 sm:flex-row">
      <label className="flex-1"><span className="sr-only">Reply</span><textarea rows={1} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={open ? "Write a reply…" : "Reply to reopen…"} className="input min-h-10" /></label>
      <div className="flex gap-2">
        <button disabled={pending || !msg.trim()} className="btn-primary"><Send className="size-4" />Reply</button>
        {open && <button type="button" disabled={pending} onClick={() => send(true)} className="btn-ghost"><CheckCircle2 className="size-4" />{msg.trim() ? "Reply & resolve" : "Resolve"}</button>}
      </div>
    </form>
  );
}
