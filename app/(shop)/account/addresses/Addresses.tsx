"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import AddressForm from "@/components/AddressForm";
import { useApp } from "@/components/Providers";
import { deleteAddress } from "@/lib/actions";
import type { Address } from "@/lib/types";

export default function Addresses({ addresses }: { addresses: Address[] }) {
  const { toast } = useApp();
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(addresses.length ? null : "new");
  const [pending, start] = useTransition();
  const done = () => { setEditing(null); router.refresh(); };
  const remove = (id: string) => confirm("Delete this address?") && start(async () => { const r = await deleteAddress(id); if (!r.ok) toast(r.error, "err"); else { toast("Address deleted"); router.refresh(); } });

  return (
    <div className="space-y-3">
      {addresses.map((a) => editing === a.id ? (
        <div key={a.id} className="card p-5"><AddressForm initial={a} onSaved={done} onCancel={() => setEditing(null)} /></div>
      ) : (
        <div key={a.id} className="card flex gap-4 p-4">
          <MapPin className="mt-0.5 size-5 shrink-0 text-zinc-400" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">{a.name} <span className="badge ml-1 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{a.label}</span>{a.isDefault && <span className="badge ml-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Default</span>}</p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} – {a.pincode}</p>
            <p className="text-zinc-600 dark:text-zinc-400">Mobile: {a.phone}</p>
          </div>
          <div className="flex gap-1 self-start">
            <button onClick={() => setEditing(a.id)} className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Edit address"><Pencil className="size-4" /></button>
            <button onClick={() => remove(a.id)} disabled={pending} className="rounded-full p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label="Delete address"><Trash2 className="size-4" /></button>
          </div>
        </div>
      ))}
      {editing === "new" ? (
        <div className="card p-5"><h2 className="mb-4 font-semibold">New address</h2><AddressForm onSaved={done} onCancel={addresses.length ? () => setEditing(null) : undefined} /></div>
      ) : (
        <button onClick={() => setEditing("new")} className="card flex w-full items-center justify-center gap-2 border-dashed p-4 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800/50"><Plus className="size-4" />Add a new address</button>
      )}
    </div>
  );
}
