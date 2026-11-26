"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Banknote, Building2, Check, CreditCard, Loader2, Lock, MapPin, Plus, ShoppingBag, Smartphone, Truck, Wallet, Zap } from "lucide-react";
import AddressForm from "@/components/AddressForm";
import { CoinsToggle, CouponBox, PriceSummary } from "@/components/PriceSummary";
import ProductImage from "@/components/ProductImage";
import { trackEvent, useApp } from "@/components/Providers";
import { useQuote } from "@/components/useQuote";
import { Empty, Money } from "@/components/ui";
import { placeOrder } from "@/lib/actions";
import { DELIVERY, type DeliverySpeed } from "@/lib/pricing";
import type { Address, PaymentMethod } from "@/lib/types";

const STEPS = ["Address", "Delivery", "Payment"];
const METHODS: { k: PaymentMethod; label: string; sub: string; icon: typeof CreditCard }[] = [
  { k: "upi", label: "UPI", sub: "Google Pay, PhonePe, Paytm & more", icon: Smartphone },
  { k: "card", label: "Credit / Debit card", sub: "Visa, Mastercard, RuPay, Amex", icon: CreditCard },
  { k: "netbanking", label: "Net banking", sub: "All major banks", icon: Building2 },
  { k: "wallet", label: "Wallets", sub: "Paytm, Amazon Pay, MobiKwik", icon: Wallet },
  { k: "cod", label: "Cash on delivery", sub: "Pay when it arrives (up to ₹10,000)", icon: Banknote },
];

const luhn = (n: string) => { let s = 0; [...n].reverse().forEach((d, i) => { let x = +d; if (i % 2) { x *= 2; if (x > 9) x -= 9; } s += x; }); return n.length >= 12 && s % 10 === 0; };
const expValid = (v: string) => {
  const m = v.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if (!m) return false;
  const now = new Date();
  const yr = 2000 + Number(m[2]), mo = Number(m[1]);
  return yr > now.getFullYear() || (yr === now.getFullYear() && mo >= now.getMonth() + 1);
};
const brandOf = (n: string) => (/^4/.test(n) ? "Visa" : /^(5[1-5]|2[2-7])/.test(n) ? "Mastercard" : /^3[47]/.test(n) ? "Amex" : /^(60|65|81|82|508)/.test(n) ? "RuPay" : "");

export default function Checkout({ addresses: initial }: { addresses: Address[] }) {
  const { cart, clearCart, toast, money, brand } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [addresses, setAddresses] = useState(initial);
  const [addressId, setAddressId] = useState(initial.find((a) => a.isDefault)?.id ?? initial[0]?.id ?? "");
  const [adding, setAdding] = useState(initial.length === 0);
  const [speed, setSpeed] = useState<DeliverySpeed>("standard");
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [coupon, setCoupon] = useState("");
  const [useCoins, setUseCoins] = useState(true);
  const [pay, setPay] = useState({ upi: "", card: "", name: "", exp: "", cvv: "", bank: "", wallet: "" });
  const [processing, setProcessing] = useState(false);
  useEffect(() => { try { setCoupon(sessionStorage.getItem("th_coupon") ?? ""); } catch {} }, []);
  useEffect(() => { if (cart.length) trackEvent("checkout_start", { meta: `${cart.length} items` }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { q, loading } = useQuote(coupon, speed, useCoins, addressId);
  const dq = q?.delivery;
  // Fall back to standard / online payment when the chosen city doesn't offer express / COD.
  useEffect(() => { if (dq && !dq.options[speed].available) setSpeed("standard"); }, [dq, speed]);
  useEffect(() => { if (dq && !dq.cod && method === "cod") setMethod("upi"); }, [dq, method]);

  if (cart.length === 0 && !processing) return <div className="mx-auto max-w-7xl px-4"><Empty icon={<ShoppingBag className="size-7" />} title="Your bag is empty"><Link href="/shop" className="btn-primary">Continue shopping</Link></Empty></div>;

  const address = addresses.find((a) => a.id === addressId);
  const cardNum = pay.card.replace(/\s/g, "");
  const payValid =
    method === "upi" ? /^[\w.-]{2,}@[a-z]{2,}$/i.test(pay.upi) :
    method === "card" ? luhn(cardNum) && pay.name.trim().length > 1 && expValid(pay.exp) && /^\d{3,4}$/.test(pay.cvv) :
    method === "netbanking" ? !!pay.bank : method === "wallet" ? !!pay.wallet : true;
  const blocked = !q || q.lines.some((l) => !l.available);

  const submit = async () => {
    if (!payValid || blocked) return;
    setProcessing(true);
    if (method !== "cod") await new Promise((r) => setTimeout(r, 1400)); // simulated gateway round-trip
    const r = await placeOrder({ lines: cart.map(({ productId, color, size, qty }) => ({ productId, color, size, qty })), addressId, speed, method, couponCode: q?.coupon?.code, useCoins: useCoins && !!q?.totals.coins });
    if (!r.ok) { setProcessing(false); return toast(r.error, "err"); }
    try { sessionStorage.removeItem("th_coupon"); } catch {}
    router.replace(`/order-success/${r.data.id}`);
    clearCart();
  };

  const field = (k: keyof typeof pay, props: React.InputHTMLAttributes<HTMLInputElement>, fmt?: (v: string) => string) => (
    <input value={pay[k]} onChange={(e) => setPay({ ...pay, [k]: fmt ? fmt(e.target.value) : e.target.value })} className="input" {...props} />
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <ol className="mx-auto mb-8 flex max-w-md items-center">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center last:flex-none">
            <button onClick={() => i < step && setStep(i)} disabled={i > step} className="flex flex-col items-center gap-1">
              <span className={`grid size-8 place-items-center rounded-full text-sm font-bold transition ${i < step ? "bg-emerald-500 text-white" : i === step ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800"}`}>{i < step ? <Check className="size-4" /> : i + 1}</span>
              <span className={`text-xs font-medium ${i === step ? "" : "text-zinc-500"}`}>{s}</span>
            </button>
            {i < STEPS.length - 1 && <span className={`mx-2 mb-5 h-0.5 flex-1 rounded ${i < step ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"}`} />}
          </li>
        ))}
      </ol>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="animate-fade-in" key={step}>
          {step === 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold"><MapPin className="size-5" />Delivery address</h2>
              {addresses.map((a) => (
                <label key={a.id} className={`card flex cursor-pointer gap-3 p-4 transition ${addressId === a.id ? "border-zinc-900 ring-1 ring-zinc-900 dark:border-white dark:ring-white" : ""}`}>
                  <input type="radio" name="addr" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1 size-4 accent-zinc-900" />
                  <span className="text-sm"><span className="font-semibold">{a.name}</span> <span className="badge ml-1 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{a.label}</span>
                    <span className="mt-1 block text-zinc-600 dark:text-zinc-400">{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} – {a.pincode}</span>
                    <span className="block text-zinc-600 dark:text-zinc-400">Mobile: {a.phone}</span></span>
                </label>
              ))}
              {adding ? (
                <div className="card p-5"><AddressForm onSaved={(a) => { setAddresses((x) => [...x.filter((y) => y.id !== a.id).map((y) => (a.isDefault ? { ...y, isDefault: false } : y)), a]); setAddressId(a.id); setAdding(false); }} onCancel={addresses.length ? () => setAdding(false) : undefined} /></div>
              ) : (
                <button onClick={() => setAdding(true)} className="card flex w-full items-center justify-center gap-2 border-dashed p-4 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800/50"><Plus className="size-4" />Add a new address</button>
              )}
              {dq && !dq.serviceable && address && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">Sorry, we don&apos;t deliver to <b>{address.city}</b> yet. Please choose another address.</p>}
              {dq?.city && <p className="text-sm text-emerald-700 dark:text-emerald-400">✓ Fast local delivery available in {dq.city}</p>}
              <button onClick={() => setStep(1)} disabled={!address || (dq ? !dq.serviceable : true)} className="btn-primary w-full py-3.5 sm:w-auto">Deliver here</button>
            </section>
          )}

          {step === 1 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold"><Truck className="size-5" />Delivery speed</h2>
              {(Object.keys(DELIVERY) as DeliverySpeed[]).map((k) => {
                const d = dq?.options[k] ?? { available: true, fee: DELIVERY[k].fee, days: DELIVERY[k].days as unknown as [number, number] };
                const eta = new Date(Date.now() + Math.max(1, d.days[1]) * 86_400_000).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
                const sub = q ? q.totals.mrp - q.totals.discount - q.totals.coupon : 0;
                const free = !!q?.member?.freeDelivery || (k === "standard" && sub >= (dq?.freeAbove ?? DELIVERY.standard.freeAbove));
                return (
                  <label key={k} className={`card flex items-center gap-4 p-4 transition ${d.available ? "cursor-pointer" : "pointer-events-none opacity-50"} ${speed === k ? "border-zinc-900 ring-1 ring-zinc-900 dark:border-white dark:ring-white" : ""}`}>
                    <input type="radio" name="speed" checked={speed === k} disabled={!d.available} onChange={() => setSpeed(k)} className="size-4 accent-zinc-900" />
                    <span className={`grid size-10 place-items-center rounded-full ${k === "express" ? "bg-brand-100 text-brand-600 dark:bg-brand-900/40" : "bg-zinc-100 dark:bg-zinc-800"}`}>{k === "express" ? <Zap className="size-5" /> : <Truck className="size-5" />}</span>
                    <span className="flex-1"><span className="block font-semibold">{DELIVERY[k].label} delivery</span><span className="text-sm text-zinc-500">{d.available ? <>{d.days[0] === 0 ? "Same day" : `${d.days.join("–")} days`} · arrives by {eta}</> : `Not available in ${address?.city ?? "your city"}`}</span></span>
                    <span className="font-semibold">{free ? <span className="text-emerald-600">FREE</span> : money(d.fee)}</span>
                  </label>
                );
              })}
              <div className="flex gap-2"><button onClick={() => setStep(0)} className="btn-ghost">Back</button><button onClick={() => setStep(2)} className="btn-primary flex-1 py-3.5 sm:flex-none">Continue to payment</button></div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold"><Lock className="size-5" />Payment</h2>
              <div className="card divide-y divide-zinc-200 overflow-hidden dark:divide-zinc-800">
                {METHODS.filter((m) => m.k !== "cod" || !dq || dq.cod).map(({ k, label, sub, icon: I }) => (
                  <div key={k}>
                    <label className={`flex cursor-pointer items-center gap-4 p-4 transition ${method === k ? "bg-zinc-50 dark:bg-zinc-800/50" : ""}`}>
                      <input type="radio" name="method" checked={method === k} onChange={() => setMethod(k)} className="size-4 accent-zinc-900" />
                      <I className="size-5 text-zinc-500" />
                      <span className="flex-1"><span className="block font-semibold">{label}</span><span className="text-xs text-zinc-500">{sub}</span></span>
                    </label>
                    {method === k && (
                      <div className="animate-fade-in space-y-3 bg-zinc-50 px-4 pb-5 pl-[4.25rem] dark:bg-zinc-800/50">
                        {k === "upi" && (<>
                          <div className="flex flex-wrap gap-2">{["okaxis", "ybl", "paytm", "okicici"].map((h) => <button key={h} type="button" onClick={() => setPay({ ...pay, upi: `${pay.upi.split("@")[0] || "yourname"}@${h}` })} className="chip text-xs">@{h}</button>)}</div>
                          {field("upi", { placeholder: "yourname@okaxis", "aria-label": "UPI ID", autoComplete: "off" })}
                          <p className="text-xs text-zinc-500">You&apos;ll get a payment request in your UPI app.</p>
                        </>)}
                        {k === "card" && (<>
                          <div className="relative">{field("card", { placeholder: "Card number", inputMode: "numeric", autoComplete: "cc-number", "aria-label": "Card number" }, (v) => v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim())}
                            {brandOf(cardNum) && <span className="badge absolute right-3 top-1/2 -translate-y-1/2 bg-zinc-900 text-white">{brandOf(cardNum)}</span>}</div>
                          {cardNum.length >= 12 && !luhn(cardNum) && <p className="text-xs text-red-600">That card number doesn&apos;t look right.</p>}
                          {field("name", { placeholder: "Name on card", autoComplete: "cc-name", "aria-label": "Name on card" })}
                          <div className="grid grid-cols-2 gap-3">
                            {field("exp", { placeholder: "MM/YY", inputMode: "numeric", autoComplete: "cc-exp", "aria-label": "Expiry" }, (v) => v.replace(/\D/g, "").slice(0, 4).replace(/^(\d{2})(\d)/, "$1/$2"))}
                            {field("cvv", { placeholder: "CVV", type: "password", inputMode: "numeric", autoComplete: "cc-csc", "aria-label": "CVV" }, (v) => v.replace(/\D/g, "").slice(0, 4))}
                          </div>
                          <p className="text-xs text-zinc-500">Demo gateway: card details never leave your browser. Try 4111 1111 1111 1111.</p>
                        </>)}
                        {k === "netbanking" && (
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{["HDFC Bank", "ICICI Bank", "SBI", "Axis Bank", "Kotak", "Yes Bank"].map((b) => <button key={b} type="button" onClick={() => setPay({ ...pay, bank: b })} className={`chip justify-center text-xs ${pay.bank === b ? "chip-on" : ""}`}>{b}</button>)}</div>
                        )}
                        {k === "wallet" && (
                          <div className="flex flex-wrap gap-2">{["Paytm", "Amazon Pay", "MobiKwik", "PhonePe"].map((w) => <button key={w} type="button" onClick={() => setPay({ ...pay, wallet: w })} className={`chip text-xs ${pay.wallet === w ? "chip-on" : ""}`}>{w}</button>)}</div>
                        )}
                        {k === "cod" && <p className="text-sm text-zinc-600 dark:text-zinc-400">Pay in cash or UPI to the delivery partner. Available on orders up to ₹10,000.</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="btn-ghost">Back</button>
                <button onClick={submit} disabled={!payValid || blocked || processing || loading} className="btn-brand flex-1 py-3.5 text-base">
                  <Lock className="size-4" />{method === "cod" ? "Place order" : `Pay ${q ? money(q.totals.total) : ""}`}
                </button>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-4">
            <p className="label">{cart.length} items</p>
            <ul className="max-h-60 space-y-3 overflow-y-auto">
              {cart.map((l) => {
                const s = q?.lines.find((x) => x.productId === l.productId && x.color === l.color && x.size === l.size);
                return (
                  <li key={l.sku} className="flex gap-3">
                    <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg"><ProductImage src={l.image} alt={l.name} /></div>
                    <div className="min-w-0 flex-1 text-sm"><p className="truncate font-medium">{l.name}</p><p className="text-xs text-zinc-500">{l.color} · {l.size} · Qty {l.qty}</p>{s && !s.available && <p className="text-xs font-semibold text-red-600">Unavailable — update your bag</p>}</div>
                    <Money v={(s?.price ?? l.price) * l.qty} className="text-sm font-semibold" />
                  </li>
                );
              })}
            </ul>
            {address && step > 0 && <p className="mt-3 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">Delivering to <b className="text-zinc-900 dark:text-white">{address.name}</b>, {address.city} {address.pincode}</p>}
          </div>
          <CouponBox q={q} code={coupon} setCode={(c) => { setCoupon(c); try { sessionStorage.setItem("th_coupon", c); } catch {} }} />
          {q && !q.member && <Link href="/membership" className="card flex items-center gap-3 border-violet-300 bg-violet-50 p-4 text-sm dark:border-violet-800 dark:bg-violet-950/40"><span className="text-xl">👑</span><span className="flex-1"><b>Join {brand.name} {brand.membershipName}</b><span className="block text-xs text-zinc-500">Extra member discount + free delivery on every order</span></span><span className="font-semibold text-violet-600">Join →</span></Link>}
          {q?.member && <p className="rounded-xl bg-violet-50 p-3 text-center text-sm text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">👑 {q.member.name}: {q.member.pct}% member discount{q.member.freeDelivery ? " + free delivery" : ""} applied</p>}
          <CoinsToggle q={q} on={useCoins} setOn={setUseCoins} />
          <PriceSummary totals={q?.totals} loading={loading} />
          {q?.coins && <p className="text-center text-xs text-zinc-500">🪙 You&apos;ll earn coins on this order once it&apos;s delivered.</p>}
        </aside>
      </div>

      {processing && (
        <div className="fixed inset-0 z-[90] grid animate-fade-in place-items-center bg-white/90 backdrop-blur dark:bg-zinc-950/90" role="status">
          <div className="text-center"><Loader2 className="mx-auto size-10 animate-spin text-brand-500" /><p className="mt-4 font-semibold">{method === "cod" ? "Placing your order…" : "Securely processing payment…"}</p><p className="text-sm text-zinc-500">Please don&apos;t close this window.</p></div>
        </div>
      )}
    </div>
  );
}
