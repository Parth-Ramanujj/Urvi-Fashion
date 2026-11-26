"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";
import { Mail, Smartphone } from "lucide-react";
import { login, register, sendOtp, verifyOtp } from "@/lib/actions";
import { useApp } from "@/components/Providers";

const ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in isn't configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local.",
  google_failed: "Google sign-in failed. Please try again.",
  blocked: "This account has been suspended. Contact support.",
};

function Login() {
  const sp = useSearchParams();
  const router = useRouter();
  const { toast, brand } = useApp();
  const rawNext = sp.get("next") ?? "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\") ? rawNext : "";
  const [tab, setTab] = useState<"email" | "phone">("email");
  const ref = (sp.get("ref") ?? "").toUpperCase().slice(0, 20);
  const [mode, setMode] = useState<"login" | "register">(sp.get("mode") === "register" || ref ? "register" : "login");
  const [err, setErr] = useState(ERRORS[sp.get("error") ?? ""] ?? "");
  const [pending, start] = useTransition();
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const done = (role: string) => {
    const dest =
      role === "admin"
        ? (next.startsWith("/admin") ? next : "/admin")
        : role === "delivery"
          ? (next.startsWith("/delivery") ? next : "/delivery")
          : (next || "/");
    if (role === "admin" || role === "delivery") {
      window.location.href = dest;
      return;
    }
    router.push(dest); router.refresh();
  };

  const onEmail = (fd: FormData) => start(async () => {
    setErr("");
    const input = { name: String(fd.get("name") ?? ""), phone: String(fd.get("phone") ?? ""), email: String(fd.get("email")), password: String(fd.get("password")), ref: String(fd.get("ref") ?? "") };
    const r = mode === "login" ? await login(input) : await register(input);
    if (!r.ok) return setErr(r.error);
    toast(mode === "login" ? "Welcome back!" : "Account created 🎉"); done(r.data.role);
  });

  const onSend = () => start(async () => {
    setErr("");
    const r = await sendOtp(phone);
    if (!r.ok) return setErr(r.error);
    setOtpSent(true);
    toast(r.data.devCode ? `Dev mode — your code is ${r.data.devCode}` : "Code sent via SMS");
  });

  const onVerify = (fd: FormData) => start(async () => {
    setErr("");
    const r = await verifyOtp({ phone, code: String(fd.get("code")), name: String(fd.get("name") ?? ""), ref: String(fd.get("ref") ?? "") });
    if (!r.ok) return setErr(r.error);
    toast("Signed in"); done(r.data.role);
  });

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 md:grid-cols-2 md:py-16">
      <div className="hidden flex-col justify-center rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-700 p-10 text-white md:flex">
        <p className="font-display text-4xl font-bold leading-tight">{brand.tagline}</p>
        <p className="mt-4 text-white/70">Save your sizes, track orders in real time and get early access to flash sales.</p>
        {brand.showDemoLogins && <div className="mt-8 space-y-2 rounded-2xl bg-white/10 p-4 text-sm">
          <p className="font-semibold">Demo accounts</p>
          <p className="text-white/80">Customer · demo@threadly.dev / Demo@123</p>
          <p className="text-white/80">Admin · admin@threadly.dev / Admin@123</p>
          <p className="text-white/80">Delivery · rider@threadly.dev / Rider@123</p>
        </div>}
      </div>

      <div className="mx-auto w-full max-w-sm animate-slide-up">
        <h1 className="font-display text-3xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-zinc-500">{mode === "login" ? "Log in to continue shopping." : "Join in seconds — it's free."}</p>

        <div className="mb-5 mt-6 grid grid-cols-2 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900" role="tablist">
          {([["email", Mail, "Email"], ["phone", Smartphone, "Phone OTP"]] as const).map(([k, I, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setErr(""); }} className={`flex items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold transition ${tab === k ? "bg-white shadow dark:bg-zinc-800" : "text-zinc-500"}`}><I className="size-4" />{l}</button>
          ))}
        </div>

        {err && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{err}</p>}

        {tab === "email" ? (
          <form action={onEmail} className="space-y-4">
            {mode === "register" && <label className="block"><span className="label">Full name</span><input name="name" required minLength={2} autoComplete="name" className="input" /></label>}
            {mode === "register" && <label className="block"><span className="label">Mobile number</span><div className="flex gap-2"><span className="input w-16 shrink-0 text-center text-zinc-500">+91</span><input name="phone" required inputMode="numeric" pattern="[6-9]\d{9}" maxLength={10} autoComplete="tel-national" placeholder="98765 43210" className="input" /></div></label>}
            <label className="block"><span className="label">Email</span><input name="email" type="email" required autoComplete="email" className="input" /></label>
            <label className="block"><span className="label">Password</span><input name="password" type="password" required minLength={mode === "register" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} className="input" />
              {mode === "register" && <span className="mt-1 block text-xs text-zinc-500">8+ characters with letters and numbers.</span>}</label>
            {mode === "register" && <label className="block"><span className="label">Referral code (optional)</span><input name="ref" defaultValue={ref} className="input uppercase" maxLength={20} autoComplete="off" />{ref && <span className="mt-1 block text-xs text-emerald-600">🎁 Friend&apos;s code applied — you&apos;ll get bonus coins on sign-up.</span>}</label>}
            <button disabled={pending} className="btn-primary w-full py-3">{pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</button>
          </form>
        ) : !otpSent ? (
          <div className="space-y-4">
            <label className="block"><span className="label">Mobile number</span>
              <div className="flex gap-2"><span className="input w-16 shrink-0 text-center text-zinc-500">+91</span><input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" className="input" /></div>
            </label>
            <button onClick={onSend} disabled={pending || phone.length !== 10} className="btn-primary w-full py-3">{pending ? "Sending…" : "Send OTP"}</button>
          </div>
        ) : (
          <form action={onVerify} className="space-y-4">
            <p className="text-sm text-zinc-500">Enter the 6-digit code sent to +91 {phone}. <button type="button" onClick={() => setOtpSent(false)} className="font-semibold text-zinc-900 underline dark:text-white">Change</button></p>
            <input name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className="input text-center text-2xl tracking-[0.5em]" placeholder="••••••" autoFocus />
            <label className="block"><span className="label">Your name (new accounts)</span><input name="name" className="input" autoComplete="name" /></label>
            <label className="block"><span className="label">Referral code (new accounts, optional)</span><input name="ref" defaultValue={ref} className="input uppercase" maxLength={20} autoComplete="off" /></label>
            <button disabled={pending} className="btn-primary w-full py-3">{pending ? "Verifying…" : "Verify & continue"}</button>
            <button type="button" onClick={onSend} disabled={pending} className="w-full text-sm text-zinc-500 hover:underline">Resend code</button>
          </form>
        )}

        {tab === "email" && (
          <p className="mt-6 text-center text-sm text-zinc-500">
            {mode === "login" ? `New to ${brand.name}? ` : "Already have an account? "}
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }} className="font-semibold text-zinc-900 underline dark:text-white">{mode === "login" ? "Create an account" : "Log in"}</button>
          </p>
        )}
        <p className="mt-4 text-center text-xs text-zinc-400">By continuing you agree to our <Link href="#" className="underline">Terms</Link> & <Link href="#" className="underline">Privacy Policy</Link>.</p>
        {brand.showDemoLogins && <div className="mt-6 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500 md:hidden dark:bg-zinc-900">Demo: demo@threadly.dev / Demo@123 · admin@threadly.dev / Admin@123 · rider@threadly.dev / Rider@123</div>}
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense><Login /></Suspense>;
}
