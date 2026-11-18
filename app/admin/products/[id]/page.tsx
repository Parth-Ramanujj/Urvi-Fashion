import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import ProductForm from "./ProductForm";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = id === "new" ? null : db().products.find((x) => x.id === id);
  if (p === undefined) notFound();
  return (
    <div>
      <Link href="/admin/products" className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><ArrowLeft className="size-4" />Products</Link>
      <h1 className="mb-6 font-display text-2xl font-bold sm:text-3xl">{p ? `Edit · ${p.name}` : "New product"}</h1>
      <ProductForm product={p} />
    </div>
  );
}
