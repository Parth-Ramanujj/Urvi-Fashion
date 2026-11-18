"use client";
import { Trash2 } from "lucide-react";
import { useApp } from "@/components/Providers";
import { deleteProduct } from "@/lib/admin-actions";
import { useAct } from "../_ui";

export function DeleteProduct({ id, name }: { id: string; name: string }) {
  const { pending, act } = useAct();
  const { toast } = useApp();
  return (
    <button disabled={pending} aria-label={`Delete ${name}`} className="btn-ghost px-2.5 py-1.5 text-xs text-red-600"
      onClick={() => confirm(`Delete "${name}"? Products with past orders are archived instead.`) && act(() => deleteProduct(id), undefined, (r) => toast(r.mode === "archived" ? "Has past orders — archived instead" : "Product deleted"))}>
      <Trash2 className="size-3.5" />
    </button>
  );
}
