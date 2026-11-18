"use client";
import { Ban, ShieldCheck } from "lucide-react";
import { setUserBlocked, setUserRole } from "@/lib/admin-actions";
import type { Role } from "@/lib/types";
import { useAct } from "../_ui";

export default function UserControls({ id, role, blocked, self }: { id: string; role: Role; blocked: boolean; self: boolean }) {
  const { pending, act } = useAct();
  if (self) return <span className="text-xs text-zinc-500">You ({role})</span>;
  return (
    <div className="flex items-center gap-2">
      <select disabled={pending} value={role} aria-label="Role" onChange={(e) => confirm(`Change role to ${e.target.value}?`) && act(() => setUserRole(id, e.target.value as Role), "Role updated")} className="input w-auto py-1.5 text-xs">
        <option value="customer">Customer</option><option value="delivery">Delivery</option><option value="admin">Admin</option>
      </select>
      {role !== "admin" && (
        <button disabled={pending} onClick={() => act(() => setUserBlocked(id, !blocked), blocked ? "User unblocked" : "User blocked")}
          className={`btn-ghost px-3 py-1.5 text-xs ${blocked ? "text-emerald-600" : "text-red-600"}`}>
          {blocked ? <><ShieldCheck className="size-3.5" />Unblock</> : <><Ban className="size-3.5" />Block</>}
        </button>
      )}
    </div>
  );
}
