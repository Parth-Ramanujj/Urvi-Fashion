"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { savedCart, setPref as setPrefAction, syncCart } from "@/lib/actions";
import { formatMoney, translator, type Currency, type Lang } from "@/lib/i18n";
import type { CartLine } from "@/lib/types";
import type { PublicUser } from "@/lib/auth";
import type { Brand } from "@/lib/brand";

type Toast = { id: number; msg: string; kind: "ok" | "err" };
type Ctx = {
  brand: Brand;
  user: PublicUser | null;
  lang: Lang; currency: Currency; theme: string;
  t: ReturnType<typeof translator>;
  money: (inr: number) => string;
  setPref: (k: "lang" | "currency" | "theme", v: string) => void;
  cart: CartLine[]; cartCount: number; cartOpen: boolean; setCartOpen: (v: boolean) => void;
  addToCart: (l: CartLine) => void; setQty: (sku: string, qty: number) => void; removeFromCart: (sku: string) => void; clearCart: () => void;
  wishlist: string[]; toggleWish: (id: string) => void;
  toast: (msg: string, kind?: "ok" | "err") => void;
  canInstall: boolean; install: () => void;
};
const C = createContext<Ctx | null>(null);
export const useApp = () => useContext(C)!;

function load<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode: keep in memory */ }
}

export default function Providers({ children, user, lang, currency, theme: initialTheme, brand }: { children: React.ReactNode; user: PublicUser | null; lang: Lang; currency: Currency; theme: string; brand: Brand }) {
  const router = useRouter();
  const [theme, setTheme] = useState(initialTheme);
  // shortcut: cart & wishlist live in localStorage (per device); move to the user record for cross-device sync.
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [installEvt, setInstallEvt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);

  // Installable app: register the service worker and keep the browser's install prompt for our "Install app" buttons.
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvt(e as Event & { prompt: () => Promise<void> }); };
    const onInstalled = () => setInstallEvt(null);
    addEventListener("beforeinstallprompt", onPrompt); addEventListener("appinstalled", onInstalled);
    return () => { removeEventListener("beforeinstallprompt", onPrompt); removeEventListener("appinstalled", onInstalled); };
  }, []);

  useEffect(() => { setCart(load("th_cart", [])); setWishlist(load("th_wish", [])); setReady(true); }, []);
  useEffect(() => { if (ready) save("th_cart", cart); }, [cart, ready]);

  // Logged-in shoppers: restore the bag saved on the server (other device) when this one is empty, then mirror changes back.
  const uid = user?.role === "customer" ? user.id : null;
  const restored = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !uid) return;
    savedCart().then((s) => { if (s.length) setCart((c) => (c.length ? c : s)); }).finally(() => { restored.current = uid; });
  }, [ready, uid]);
  useEffect(() => {
    if (!ready || !uid || restored.current !== uid) return;
    const t = setTimeout(() => syncCart(cart), 1500);
    return () => clearTimeout(t);
  }, [cart, ready, uid]);
  useEffect(() => { if (ready) save("th_wish", wishlist); }, [wishlist, ready]);

  const toast = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const setPref = useCallback((k: "lang" | "currency" | "theme", v: string) => {
    if (k === "theme") {
      setTheme(v);
      const dark = v === "dark" || (v === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    }
    setPrefAction(k, v).then(() => k !== "theme" && router.refresh());
  }, [router]);

  const value = useMemo<Ctx>(() => ({
    brand, user, lang, currency, theme, t: translator(lang), money: (v) => formatMoney(v, currency), setPref,
    cart, cartCount: cart.reduce((s, l) => s + l.qty, 0), cartOpen, setCartOpen,
    addToCart: (l) => setCart((c) => {
      const ex = c.find((x) => x.sku === l.sku);
      return ex ? c.map((x) => (x.sku === l.sku ? { ...x, qty: Math.min(10, x.qty + l.qty) } : x)) : [...c, l];
    }),
    setQty: (sku, qty) => setCart((c) => c.map((x) => (x.sku === sku ? { ...x, qty: Math.max(1, Math.min(10, qty)) } : x))),
    removeFromCart: (sku) => setCart((c) => c.filter((x) => x.sku !== sku)),
    clearCart: () => setCart([]),
    wishlist, toggleWish: (id) => setWishlist((w) => (w.includes(id) ? w.filter((x) => x !== id) : [id, ...w])),
    toast,
    canInstall: !!installEvt, install: () => { installEvt?.prompt(); setInstallEvt(null); },
  }), [brand, user, lang, currency, theme, setPref, cart, cartOpen, wishlist, toast, installEvt]);

  return (
    <C.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex max-w-sm animate-slide-up items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-xl dark:bg-white dark:text-zinc-900">
            {t.kind === "ok" ? <CheckCircle2 className="size-4 text-emerald-400 dark:text-emerald-600" /> : <AlertCircle className="size-4 text-red-400 dark:text-red-600" />}
            {t.msg}
          </div>
        ))}
      </div>
    </C.Provider>
  );
}
