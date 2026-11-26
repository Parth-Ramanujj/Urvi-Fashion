import Link from "next/link";
import { Plus, Search } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import { Money } from "@/components/ui";
import { db } from "@/lib/db";
import { flashActive, unitPrice } from "@/lib/pricing";
import { CATEGORIES } from "@/lib/types";
import { PageTitle } from "../_ui";
import BulkImport from "./BulkImport";
import { DeleteProduct } from "./DeleteProduct";

export default async function Products({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { q = "", category = "", status = "" } = await searchParams;
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const items = db().products.filter((p) => {
    const stock = p.variants.reduce((s, v) => s + v.stock, 0);
    return words.every((w) => `${p.name} ${p.brand} ${p.subcategory} ${p.id}`.toLowerCase().includes(w))
      && (!category || p.category === category)
      && (!status || (status === "active" ? p.active : status === "archived" ? !p.active : status === "low" ? p.variants.some((v) => v.stock <= 3) : stock === 0));
  }).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div>
      <PageTitle title="Products"><div className="flex flex-wrap gap-2"><BulkImport /><Link href="/admin/products/new" className="btn-brand"><Plus className="size-4" />Add product</Link></div></PageTitle>
      <form className="card mb-4 flex flex-wrap gap-2 p-3">
        <label className="relative min-w-48 flex-1"><span className="sr-only">Search products</span><Search className="absolute left-3 top-3 size-4 text-zinc-400" /><input name="q" defaultValue={q} placeholder="Search name, brand, ID…" className="input pl-9" /></label>
        <select name="category" defaultValue={category} className="input w-auto" aria-label="Category"><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}</select>
        <select name="status" defaultValue={status} className="input w-auto" aria-label="Status"><option value="">Any status</option><option value="active">Active</option><option value="archived">Archived</option><option value="low">Low stock</option><option value="out">Out of stock</option></select>
        <button className="btn-primary">Filter</button>
      </form>
      <p className="mb-2 text-sm text-zinc-500">{items.length} products</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
            <tr><th className="p-3 font-semibold">Product</th><th className="font-semibold">Category</th><th className="font-semibold">Price</th><th className="font-semibold">Stock</th><th className="font-semibold">Sold</th><th className="font-semibold">Status</th><th className="p-3 text-right font-semibold">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {items.map((p) => {
              const stock = p.variants.reduce((s, v) => s + v.stock, 0);
              const low = p.variants.filter((v) => v.stock <= 3).length;
              return (
                <tr key={p.id} className={p.active ? "" : "opacity-60"}>
                  <td className="p-3">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 hover:text-brand-600">
                      <div className="h-14 w-11 shrink-0 overflow-hidden rounded-lg"><ProductImage src={p.colors[0].images[0]} alt={p.name} /></div>
                      <span className="min-w-0"><span className="block font-medium">{p.name}</span><span className="text-xs text-zinc-500">{p.brand} · {p.colors.length} colours · {p.sizes.join("/")}</span></span>
                    </Link>
                  </td>
                  <td className="capitalize">{p.category}<div className="text-xs text-zinc-500">{p.subcategory}</div></td>
                  <td><Money v={unitPrice(p)} className="font-semibold" /><div className="text-xs text-zinc-400 line-through"><Money v={p.mrp} /></div>{flashActive(p) && <span className="badge bg-brand-100 text-brand-700">Flash −{p.flashSale!.percent}%</span>}</td>
                  <td><span className={stock === 0 ? "font-semibold text-red-600" : ""}>{stock}</span>{low > 0 && <div className="text-xs text-amber-600">{low} variants low</div>}</td>
                  <td className="tabular-nums">{p.sold}</td>
                  <td><span className={`badge ${p.active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}>{p.active ? "Active" : "Archived"}</span></td>
                  <td className="p-3 text-right"><div className="flex justify-end gap-1"><Link href={`/admin/products/${p.id}`} className="btn-ghost px-3 py-1.5 text-xs">Edit</Link><DeleteProduct id={p.id} name={p.name} /></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
