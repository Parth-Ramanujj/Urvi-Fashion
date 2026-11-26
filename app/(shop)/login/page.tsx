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
    const dest = next || (role === "admin" ? "/admin" : role === "delivery" ? "/delivery" : "/");
    router.push(dest); router.refresh();
  };

  const onEmail = (fd: FormData) => start(async () => {
    setErr("");
    const input = { name: String(fd.get("name") ?? ""), email: String(fd.get("email")), password: String(fd.get("password")), ref: String(fd.get("ref") ?? "") };
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

        <a href={`/api/auth/google${next || ref ? `?${new URLSearchParams({ ...(next ? { next } : {}), ...(ref ? { ref } : {}) })}` : ""}`} className="btn-ghost mt-6 w-full py-3">
          <svg viewBox="0 0 48 48" className="size-5" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
          Continue with Google
        </a>

        <div className="my-6 flex items-center gap-3 text-xs text-zinc-400"><span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />or<span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" /></div>

        <div className="mb-5 grid grid-cols-2 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900" role="tablist">
          {([["email", Mail, "Email"], ["phone", Smartphone, "Phone OTP"]] as const).map(([k, I, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setErr(""); }} className={`flex items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold transition ${tab === k ? "bg-white shadow dark:bg-zinc-800" : "text-zinc-500"}`}><I className="size-4" />{l}</button>
          ))}
        </div>

        {err && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{err}</p>}

        {tab === "email" ? (
          <form action={onEmail} className="space-y-4">
            {mode === "register" && <label className="block"><span className="label">Full name</span><input name="name" required autoComplete="name" className="input" /></label>}
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
