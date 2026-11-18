"use client";
import Link from "next/link";
import { useState } from "react";
import { updateStock } from "@/lib/admin-actions";
import { useAct } from "./_ui";

export default function QuickRestock({ productId, sku, name, variant, stock }: { productId: string; sku: string; name: string; variant: string; stock: number }) {
  const [v, setV] = useState(String(stock + 10));
  const { pending, act } = useAct();
  return (
    <li className="flex items-center gap-2 py-2.5 text-sm">
      <Link href={`/admin/products/${productId}`} className="min-w-0 flex-1 hover:text-brand-600">
        <span className="block truncate font-medium">{name}</span>
        <span className="text-xs text-zinc-500">{variant} · <span className={stock === 0 ? "font-semibold text-red-600" : "text-amber-600"}>{stock === 0 ? "out of stock" : `${stock} left`}</span></span>
      </Link>
      <form onSubmit={(e) => { e.preventDefault(); act(() => updateStock(productId, sku, Number(v)), "Stock updated"); }} className="flex shrink-0 items-center gap-1.5">
        <input type="number" inputMode="numeric" min={0} value={v} onChange={(e) => setV(e.target.value)} className="input w-16 px-2 py-1.5 text-center" aria-label={`New stock for ${name} ${variant}`} />
        <button disabled={pending || v === "" || Number(v) === stock} className="btn-primary px-3 py-1.5 text-xs">Save</button>
      </form>
    </li>
  );
}
