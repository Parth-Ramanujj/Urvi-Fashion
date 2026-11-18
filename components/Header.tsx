"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ChevronRight, Coins, Crown, Download, Globe, Heart, Home, LayoutDashboard, LifeBuoy, LogOut, Menu as MenuIcon, Moon, Package, Search, ShoppingBag, Sun, Truck, User, X, Grid2x2, Monitor } from "lucide-react";
import { logout, markNotificationsRead, myNotifications } from "@/lib/actions";
import { CURRENCIES, LANGS } from "@/lib/i18n";
import CartDrawer from "./CartDrawer";
import Logo from "./Logo";
import { memberProgram } from "@/lib/brand";
import SearchBar from "./SearchBar";
import { useApp } from "./Providers";

const NAV = [["men", "nav.men"], ["women", "nav.women"], ["kids", "nav.kids"], ["accessories", "nav.accessories"], ["seasonal", "nav.seasonal"]] as const;

function Menu({ trigger, children, label }: { trigger: React.ReactNode; children: React.ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button onClick={() => setOpen((o) => !o)} className="grid size-10 place-items-center rounded-full transition hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label={label} aria-expanded={open}>{trigger}</button>
      {open && <div className="absolute right-0 top-10 z-50 w-72 pt-2"><div className="animate-fade-in rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>{children}</div></div>}
    </div>
  );
}

function Bell_() {
  const { user } = useApp();
  const [items, setItems] = useState<Awaited<ReturnType<typeof myNotifications>>>([]);
  useEffect(() => { if (user) myNotifications().then(setItems); }, [user]);
  if (!user) return null;
  const unread = items.filter((n) => !n.read).length;
  return (
    <Menu label="Notifications" trigger={<span className="relative"><Bell className="size-5" />{unread > 0 && <span className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-brand-500 text-[10px] font-bold text-white">{unread}</span>}</span>}>
      <div className="flex items-center justify-between px-2 py-1.5">
        <p className="text-sm font-semibold">Notifications</p>
        {unread > 0 && <button className="text-xs text-brand-600" onClick={() => markNotificationsRead().then(() => setItems((x) => x.map((n) => ({ ...n, read: true }))))}>Mark all read</button>}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {items.length === 0 && <p className="p-4 text-center text-sm text-zinc-500">You&apos;re all caught up.</p>}
        {items.map((n) => (
          <Link key={n.id} href={n.href ?? "#"} className="flex gap-2 rounded-xl p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-brand-500"}`} />
            <span><span className="block text-sm font-medium">{n.title}</span><span className="block text-xs text-zinc-500">{n.body}</span><span className="block text-[11px] text-zinc-400" suppressHydrationWarning>{new Date(n.createdAt).toLocaleString()}</span></span>
          </Link>
        ))}
      </div>
    </Menu>
  );
}

export default function Header() {
  const { t, user, cartCount, setCartOpen, wishlist, theme, setPref, lang, currency, brand } = useApp();
  const plus = memberProgram(brand);
  const router = useRouter();
  const path = usePathname();
  const [mobileSearch, setMobileSearch] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => setDrawer(false), [path]);
  useEffect(() => { const f = () => setScrolled(scrollY > 8); f(); addEventListener("scroll", f, { passive: true }); return () => removeEventListener("scroll", f); }, []);

  const doLogout = async () => { await logout(); router.push("/"); router.refresh(); };
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <>
      {brand.announcement.enabled && brand.announcement.text && <div className="no-print hidden bg-zinc-900 px-4 py-1.5 text-center text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900 md:block">{brand.announcement.text}</div>}
      <header className={`no-print sticky top-0 z-40 border-b transition ${scrolled ? "border-zinc-200 bg-white/85 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/85" : "border-transparent bg-white dark:bg-zinc-950"}`}>
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:h-16">
          <button onClick={() => setDrawer(true)} className="-ml-2 grid size-10 place-items-center rounded-full md:hidden" aria-label="Open menu"><MenuIcon className="size-6" /></button>
          <Link href="/" aria-label={`${brand.name} home`}><Logo /></Link>
          <nav className="ml-6 hidden items-center gap-1 lg:flex">
            {NAV.map(([c, k]) => (
              <Link key={c} href={`/shop?category=${c}`} className="rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white">{t(k)}</Link>
            ))}
          </nav>
          <div className="mx-4 hidden max-w-md flex-1 md:block"><SearchBar /></div>
          <div className="ml-auto flex items-center">
            {path !== "/" && <button onClick={() => setMobileSearch(true)} className="grid size-10 place-items-center rounded-full md:hidden" aria-label="Search"><Search className="size-5" /></button>}
            <div className="hidden md:block"><Menu label="Language, currency and theme" trigger={<Globe className="size-5" />}>
              <p className="label px-2 pt-1">Language</p>
              <div className="flex flex-wrap gap-1.5 px-2 pb-2">{Object.entries(LANGS).map(([k, v]) => <button key={k} onClick={() => setPref("lang", k)} className={`chip text-xs ${lang === k ? "chip-on" : ""}`}>{v}</button>)}</div>
              <p className="label px-2">Currency</p>
              <div className="flex flex-wrap gap-1.5 px-2 pb-2">{Object.keys(CURRENCIES).map((k) => <button key={k} onClick={() => setPref("currency", k)} className={`chip text-xs ${currency === k ? "chip-on" : ""}`}>{k}</button>)}</div>
              <p className="label px-2">Theme</p>
              <div className="flex gap-1.5 px-2 pb-2">
                {([["light", Sun], ["dark", Moon], ["system", Monitor]] as const).map(([k, I]) => <button key={k} onClick={() => setPref("theme", k)} className={`chip text-xs capitalize ${theme === k ? "chip-on" : ""}`}><I className="size-3.5" />{k}</button>)}
              </div>
            </Menu></div>
            <button onClick={() => setPref("theme", theme === "dark" ? "light" : "dark")} className="hidden size-10 place-items-center rounded-full hover:bg-zinc-100 md:grid dark:hover:bg-zinc-800" aria-label="Toggle dark mode"><ThemeIcon className="size-5" /></button>
            <div className="hidden md:block"><Bell_ /></div>
            <Link href="/wishlist" className="relative grid size-10 place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Wishlist">
              <Heart className="size-5" />{wishlist.length > 0 && <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-zinc-900 text-[10px] font-bold text-white dark:bg-white dark:text-zinc-900">{wishlist.length}</span>}
            </Link>
            {user ? (
              <div className="hidden md:block"><Menu label="Account menu" trigger={<span className="grid size-8 place-items-center rounded-full bg-brand-500 text-sm font-bold text-white">{user.name[0]?.toUpperCase()}</span>}>
                <div className="px-3 py-2"><p className="font-semibold">{user.name}</p><p className="truncate text-xs text-zinc-500">{user.email ?? user.phone}</p></div>
                {user.role === "admin" && <MenuLink href="/admin" icon={<LayoutDashboard className="size-4" />}>Admin dashboard</MenuLink>}
                {user.role === "delivery" && <MenuLink href="/delivery" icon={<Truck className="size-4" />}>My deliveries</MenuLink>}
                <MenuLink href="/account" icon={<User className="size-4" />}>{t("acct.account")}</MenuLink>
                <MenuLink href="/account/orders" icon={<Package className="size-4" />}>{t("acct.orders")}</MenuLink>
                <MenuLink href="/account/rewards" icon={<Coins className="size-4" />}>Rewards</MenuLink>
                <MenuLink href="/membership" icon={<Crown className="size-4" />}>{plus}</MenuLink>
                <MenuLink href="/wishlist" icon={<Heart className="size-4" />}>{t("acct.wishlist")}</MenuLink>
                <button onClick={doLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"><LogOut className="size-4" />{t("acct.logout")}</button>
              </Menu></div>
            ) : (
              <Link href={path.startsWith("/login") ? "/login" : `/login?next=${encodeURIComponent(path)}`} className="btn-primary ml-1 hidden px-4 py-2 md:inline-flex">{t("acct.login")}</Link>
            )}
            <button onClick={() => setCartOpen(true)} className="relative grid size-10 place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label={`Bag, ${cartCount} items`}>
              <ShoppingBag className="size-5" />
              {cartCount > 0 && <span key={cartCount} className="absolute right-0.5 top-0.5 grid size-[18px] animate-pop place-items-center rounded-full bg-brand-500 text-[10px] font-bold text-white">{cartCount}</span>}
            </button>
          </div>
        </div>
        <nav className="no-scrollbar hidden gap-1 overflow-x-auto px-4 pb-2 md:flex lg:hidden">
          {NAV.map(([c, k]) => <Link key={c} href={`/shop?category=${c}`} className="chip shrink-0 py-1 text-xs">{t(k)}</Link>)}
        </nav>
      </header>

      {/* Mobile side menu */}
      {drawer && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={() => setDrawer(false)} />
          {/* Any tap on a link or option closes the menu (path-change alone misses same-page links like category filters). */}
          <aside onClick={(e) => (e.target as HTMLElement).closest("a, button") && setDrawer(false)} className="absolute inset-y-0 left-0 flex w-[85%] max-w-xs animate-slide-in-left flex-col overflow-y-auto bg-white dark:bg-zinc-950">
            <div className="bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white">
              <button onClick={() => setDrawer(false)} className="float-right rounded-full p-1 hover:bg-white/20" aria-label="Close menu"><X className="size-5" /></button>
              <span className="grid size-12 place-items-center rounded-full bg-white/20 text-lg font-bold">{user ? user.name[0]?.toUpperCase() : <User className="size-6" />}</span>
              {user ? <><p className="mt-3 font-semibold">{user.name}</p><p className="truncate text-xs text-white/80">{user.email ?? user.phone}</p></>
                : <Link href={`/login?next=${encodeURIComponent(path)}`} className="mt-3 inline-flex items-center gap-1 font-semibold">{t("acct.login")} / Sign up <ChevronRight className="size-4" /></Link>}
            </div>
            <nav className="p-2">
              <p className="label px-3 pt-3">Shop</p>
              {NAV.map(([c, k]) => <Link key={c} href={`/shop?category=${c}`} className="flex items-center justify-between rounded-xl px-3 py-3 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900">{t(k)}<ChevronRight className="size-4 text-zinc-400" /></Link>)}
              <Link href="/shop?sale=flash" className="flex items-center justify-between rounded-xl px-3 py-3 font-medium text-brand-600 hover:bg-zinc-100 dark:hover:bg-zinc-900">Flash sale ⚡<ChevronRight className="size-4" /></Link>
              <div className="my-2 border-t border-zinc-200 dark:border-zinc-800" />
              {user?.role === "admin" && <MenuLink href="/admin" icon={<LayoutDashboard className="size-4" />}>Admin dashboard</MenuLink>}
              {user?.role === "delivery" && <MenuLink href="/delivery" icon={<Truck className="size-4" />}>My deliveries</MenuLink>}
              <MenuLink href="/account/orders" icon={<Package className="size-4" />}>{t("acct.orders")}</MenuLink>
              <MenuLink href="/account/rewards" icon={<Coins className="size-4" />}>Rewards & referrals</MenuLink>
              <MenuLink href="/membership" icon={<Crown className="size-4 text-violet-600" />}>{plus} 👑</MenuLink>
              <MenuLink href="/wishlist" icon={<Heart className="size-4" />}>{t("acct.wishlist")}</MenuLink>
              <MenuLink href="/account" icon={<User className="size-4" />}>{t("acct.account")}</MenuLink>
              <MenuLink href="/account/support" icon={<LifeBuoy className="size-4" />}>Help & support</MenuLink>
              <InstallItem />
              <div className="my-2 border-t border-zinc-200 dark:border-zinc-800" />
              <p className="label px-3 pt-2">Language</p>
              <div className="flex flex-wrap gap-1.5 px-3 pb-3">{Object.entries(LANGS).map(([k, v]) => <button key={k} onClick={() => setPref("lang", k)} className={`chip text-xs ${lang === k ? "chip-on" : ""}`}>{v}</button>)}</div>
              <p className="label px-3">Currency</p>
              <div className="flex flex-wrap gap-1.5 px-3 pb-3">{Object.keys(CURRENCIES).map((k) => <button key={k} onClick={() => setPref("currency", k)} className={`chip text-xs ${currency === k ? "chip-on" : ""}`}>{k}</button>)}</div>
              <p className="label px-3">Theme</p>
              <div className="flex gap-1.5 px-3 pb-3">{([["light", Sun], ["dark", Moon], ["system", Monitor]] as const).map(([k, I]) => <button key={k} onClick={() => setPref("theme", k)} className={`chip text-xs capitalize ${theme === k ? "chip-on" : ""}`}><I className="size-3.5" />{k}</button>)}</div>
              {user && <button onClick={doLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-900"><LogOut className="size-4" />{t("acct.logout")}</button>}
            </nav>
          </aside>
        </div>
      )}

      {mobileSearch && (
        <div className="fixed inset-0 z-50 animate-fade-in bg-white p-4 dark:bg-zinc-950 md:hidden">
          <div className="flex items-center gap-2"><SearchBar autoFocus onDone={() => setMobileSearch(false)} /><button onClick={() => setMobileSearch(false)} aria-label="Close search" className="p-2"><X className="size-5" /></button></div>
        </div>
      )}

      {/* Mobile bottom tab bar */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 md:hidden">
        {[["/", Home, t("nav.home")], ["/shop", Grid2x2, "Shop"], ["/wishlist", Heart, t("acct.wishlist")], ["#bag", ShoppingBag, "Bag"], [user ? "/account" : "/login", User, user ? t("acct.account") : t("acct.login")]].map(([href, I, label]) => {
          const Icon = I as typeof Home; const on = href === path;
          const inner = <><Icon className="size-5" /><span className="text-[10px] font-medium">{label as string}</span>{href === "#bag" && cartCount > 0 && <span className="absolute right-[30%] top-1 grid size-4 place-items-center rounded-full bg-brand-500 text-[9px] font-bold text-white">{cartCount}</span>}</>;
          const cls = `relative flex flex-col items-center gap-0.5 py-2 ${on ? "text-brand-600" : "text-zinc-500"}`;
          return href === "#bag" ? <button key="bag" onClick={() => setCartOpen(true)} className={cls}>{inner}</button> : <Link key={href as string} href={href as string} className={cls}>{inner}</Link>;
        })}
      </nav>
      <CartDrawer />
    </>
  );
}

/** "Install app" row: Android/desktop use the browser prompt; iOS gets Add-to-Home-Screen steps. */
function InstallItem() {
  const { install, canInstall, brand } = useApp();
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(true);
  useEffect(() => { setIos(/iphone|ipad|ipod/i.test(navigator.userAgent)); setStandalone(matchMedia("(display-mode: standalone)").matches); }, []);
  if (standalone || (!canInstall && !ios)) return null;
  return canInstall
    ? <button onClick={install} className="flex w-full items-center gap-3 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300"><Download className="size-4" />Install {brand.shortName} app</button>
    : <p className="flex items-start gap-3 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"><Download className="mt-0.5 size-4 shrink-0" />Install the app: tap Share, then &quot;Add to Home Screen&quot;.</p>;
}

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">{icon}{children}</Link>;
}
