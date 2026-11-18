import Link from "next/link";
import Header from "@/components/Header";
import Logo from "@/components/Logo";
import { getBrand } from "@/lib/server-utils";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  const b = getBrand();
  return (
    <>
      <Header />
      <main className="min-h-[70vh] pb-20 md:pb-0">{children}</main>
      <footer className="no-print mt-20 border-t border-zinc-200 bg-zinc-50 pb-24 dark:border-zinc-800 dark:bg-zinc-900/40 md:pb-0">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-2 text-sm text-zinc-500">{b.footerAbout}</p>
            {(b.contact.email || b.contact.phone || b.contact.whatsapp) && (
              <p className="mt-3 space-y-1 text-sm text-zinc-500">
                {b.contact.email && <a href={`mailto:${b.contact.email}`} className="block hover:underline">✉️ {b.contact.email}</a>}
                {b.contact.phone && <a href={`tel:${b.contact.phone.replace(/\s/g, "")}`} className="block hover:underline">📞 {b.contact.phone}</a>}
                {b.contact.whatsapp && <a href={`https://wa.me/${b.contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className="block hover:underline">💬 WhatsApp us</a>}
              </p>
            )}
          </div>
          {[
            ["Shop", [["Men", "/shop?category=men"], ["Women", "/shop?category=women"], ["Kids", "/shop?category=kids"], ["Accessories", "/shop?category=accessories"]]],
            ["Help", [["Track order", "/account/orders"], ["Returns & exchanges", "/account/orders"], ["Contact support", "/account/support"], ["Size guide", "/shop"]]],
            ["Account", [["My account", "/account"], ["Wishlist", "/wishlist"], ["Addresses", "/account/addresses"], ["Log in", "/login"]]],
          ].map(([title, links]) => (
            <div key={title as string}>
              <p className="label">{title as string}</p>
              <ul className="space-y-2 text-sm">{(links as string[][]).map(([l, h]) => <li key={l}><Link href={h} className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">{l}</Link></li>)}</ul>
            </div>
          ))}
        </div>
        <p className="border-t border-zinc-200 py-5 text-center text-xs text-zinc-500 dark:border-zinc-800">© {new Date().getFullYear()} {b.legal.company || b.name}. Secure payments · 100% authentic products.</p>
      </footer>
    </>
  );
}
