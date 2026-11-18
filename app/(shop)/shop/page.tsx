import { Suspense } from "react";
import { SearchX } from "lucide-react";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import ShopFilters, { SortSelect } from "@/components/ShopFilters";
import { Empty } from "@/components/ui";
import { queryProducts, SORTS, type Filters } from "@/lib/catalog";
import { getT } from "@/lib/server-utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shop" };

export default async function Shop({ searchParams }: { searchParams: Promise<Filters> }) {
  const f = await searchParams;
  const t = await getT();
  const { items, facets } = queryProducts(f);
  const title = f.q ? `Results for “${f.q}”` : f.sale === "flash" ? "Flash sale" : f.category ? f.category[0].toUpperCase() + f.category.slice(1) : "All clothing";

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6">
      <nav className="text-xs text-zinc-500"><Link href="/" className="hover:underline">Home</Link> / <span className="capitalize">{f.category ?? "Shop"}</span></nav>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl font-bold md:text-4xl">{title}</h1><p className="text-sm text-zinc-500">{t("common.results", { n: items.length })}</p></div>
      </div>
      <Suspense>
        <div className="mt-6 gap-8 lg:flex">
          <ShopFilters facets={facets} />
          <div className="min-w-0 flex-1">
            <div className="mb-4 mt-3 flex items-center justify-end gap-3 lg:mt-0">
              <SortSelect sorts={SORTS} />
            </div>
            {items.length === 0 ? (
              <Empty icon={<SearchX className="size-7" />} title="No matches found"><p className="text-sm text-zinc-500">Try removing a filter or searching for something else.</p><Link href="/shop" className="btn-primary">Clear everything</Link></Empty>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
                {items.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 8} />)}
              </div>
            )}
          </div>
        </div>
      </Suspense>
    </div>
  );
}
