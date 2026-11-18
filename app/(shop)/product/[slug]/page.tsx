import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductRail } from "@/components/ProductCard";
import ProductView from "@/components/pdp/ProductView";
import Reviews from "@/components/pdp/Reviews";
import { currentUser } from "@/lib/auth";
import { cardData } from "@/lib/catalog";
import { db, mutate } from "@/lib/db";
import { pctOff, unitPrice } from "@/lib/pricing";
import { getT } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = db().products.find((x) => x.slug === slug);
  return p ? { title: p.name, description: p.description } : {};
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ color?: string }> }) {
  const [{ slug }, { color }, user, t] = await Promise.all([params, searchParams, currentUser(), getT()]);
  const p = db().products.find((x) => x.slug === slug && x.active);
  if (!p) notFound();
  mutate((d) => { d.products.find((x) => x.id === p.id)!.views++; });

  const all = db().products.filter((x) => x.active && x.id !== p.id);
  const price = unitPrice(p);
  const similar = all.filter((x) => x.category === p.category).sort((a, b) => Math.abs(unitPrice(a) - price) - Math.abs(unitPrice(b) - price)).slice(0, 5);
  const upsell = all.filter((x) => x.kind === p.kind && unitPrice(x) > price).sort((a, b) => b.rating - a.rating).slice(0, 5);
  const completeLook = all.filter((x) => x.category !== p.category && (x.category === "accessories" || x.kind !== p.kind)).sort((a, b) => b.sold - a.sold).slice(0, 5);
  const reviews = db().reviews.filter((r) => r.productId === p.id).sort((a, b) => b.createdAt - a.createdAt);
  const purchased = !!user && db().orders.some((o) => o.userId === user.id && o.status === "delivered" && o.items.some((i) => i.productId === p.id));

  const ld = { "@context": "https://schema.org", "@type": "Product", name: p.name, brand: { "@type": "Brand", name: p.brand }, description: p.description, sku: p.id,
    aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.ratingCount },
    offers: { "@type": "Offer", priceCurrency: "INR", price, availability: p.variants.some((v) => v.stock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" } };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <nav className="mb-4 text-xs text-zinc-500">
        <Link href="/" className="hover:underline">Home</Link> / <Link href={`/shop?category=${p.category}`} className="capitalize hover:underline">{p.category}</Link> / <span>{p.subcategory}</span>
      </nav>
      <ProductView
        p={{ ...p, price, off: pctOff(p.mrp, price) }}
        initialColor={p.colors.find((c) => c.name === color)?.name ?? p.colors[0].name}
        measurements={user?.measurements ?? null}
      />
      <Reviews productId={p.id} rating={p.rating} count={p.ratingCount} reviews={reviews} canReview={!!user} purchased={purchased} title={t("pdp.reviews")} />
      {upsell.length > 0 && <Rail title="Upgrade your pick"><ProductRail items={upsell.map(cardData)} /></Rail>}
      <Rail title={t("pdp.youMayLike")}><ProductRail items={similar.map(cardData)} /></Rail>
      <Rail title="Complete the look"><ProductRail items={completeLook.map(cardData)} /></Rail>
    </div>
  );
}

function Rail({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-14"><h2 className="mb-5 font-display text-2xl font-bold">{title}</h2>{children}</section>;
}
