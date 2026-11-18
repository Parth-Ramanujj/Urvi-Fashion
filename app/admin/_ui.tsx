"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Crown, HeartHandshake, Images, LayoutDashboard, Palette, MapPinned, Megaphone, MessageSquare, MoreHorizontal, Package, ShoppingCart, Store, Users, X } from "lucide-react";
import { useApp } from "@/components/Providers";

const LINKS = [
  ["/admin", "Dashboard", LayoutDashboard], ["/admin/products", "Products", Package], ["/admin/orders", "Orders", ShoppingCart],
  ["/admin/customers", "Customers", Users], ["/admin/retention", "Retention", HeartHandshake], ["/admin/membership", "Membership", Crown],
  ["/admin/delivery", "Delivery", MapPinned], ["/admin/support", "Support", MessageSquare], ["/admin/marketing", "Marketing", Megaphone],
  ["/admin/branding", "Branding", Palette], ["/admin/banners", "Banners", Images],
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="no-scrollbar hidden gap-1 overflow-x-auto px-3 pb-3 md:flex lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0">
      {LINKS.map(([href, label, Icon]) => {
        const on = href === "/admin" ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${on ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}>
            <Icon className="size-4" />{label}
          </Link>
        );
      })}
      <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-brand-600 hover:bg-zinc-100 lg:mt-4 dark:hover:bg-zinc-800"><Store className="size-4" />View store</Link>
    </nav>
  );
}

const isOn = (path: string, href: string) => (href === "/admin" ? path === href : path.startsWith(href));
const PRIMARY = ["/admin", "/admin/orders", "/admin/products", "/admin/customers"];

/** Phone layout: app-style bottom tabs; every other page lives in the "More" sheet. */
export function AdminBottomNav() {
  const path = usePathname();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  const rest = LINKS.filter(([h]) => !PRIMARY.includes(h));
  const moreOn = rest.some(([h]) => isOn(path, h));
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-900/95" aria-label="Admin">
        {LINKS.filter(([h]) => PRIMARY.includes(h)).map(([href, label, Icon]) => (
          <Link key={href} href={href} aria-current={isOn(path, href) ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${isOn(path, href) ? "text-brand-600" : "text-zinc-500"}`}><Icon className="size-5" />{label}</Link>
        ))}
        <button onClick={() => setMore(true)} aria-expanded={more} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${moreOn ? "text-brand-600" : "text-zinc-500"}`}><MoreHorizontal className="size-5" />More</button>
      </nav>
      {more && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="More admin pages">
          <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 animate-slide-up rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between"><p className="font-semibold">More</p><button onClick={() => setMore(false)} aria-label="Close" className="rounded-full p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="size-5" /></button></div>
            <div className="grid grid-cols-3 gap-2">
              {[...rest, ["/", "View store", Store] as const].map(([href, label, Icon]) => (
                <Link key={href} href={href} className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-xs font-medium ${href !== "/" && isOn(path, href) ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-50 dark:bg-zinc-800/60"}`}><Icon className="size-5" />{label}</Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Runs a server action returning Result, toasts the outcome and refreshes server data. */
export function useAct() {
  const { toast } = useApp();
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = <T,>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, okMsg?: string, after?: (data: T) => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error, "err");
      if (okMsg) toast(okMsg);
      after?.(r.data);
      router.refresh();
    });
  return { pending, act };
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
      {children}
    </div>
  );
}

export const STATUS_TONE: Record<string, string> = {
  placed: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  packed: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  shipped: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  out_for_delivery: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  cancelled: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  return_requested: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  exchange_requested: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  returned: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  exchanged: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  return_rejected: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};
