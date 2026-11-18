"use client";
import { useRef, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { useApp } from "@/components/Providers";
import { changePassword } from "@/lib/actions";

export default function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const { toast } = useApp();
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const submit = (fd: FormData) => start(async () => {
    if (fd.get("next") !== fd.get("confirm")) return toast("New passwords don't match", "err");
    const r = await changePassword({ current: String(fd.get("current") ?? ""), next: String(fd.get("next")) });
    if (!r.ok) return toast(r.error, "err");
    form.current?.reset();
    toast(hasPassword ? "Password changed" : "Password set — you can now log in with email");
  });
  return (
    <form ref={form} action={submit} className="card mt-6 space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><KeyRound className="size-5" />{hasPassword ? "Change password" : "Set a password"}</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {hasPassword && <label><span className="label">Current password</span><input name="current" type="password" required autoComplete="current-password" className="input" /></label>}
        <label><span className="label">New password</span><input name="next" type="password" required minLength={8} autoComplete="new-password" className="input" /></label>
        <label><span className="label">Confirm new password</span><input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" /></label>
      </div>
      <p className="text-xs text-zinc-500">8+ characters with letters and numbers.</p>
      <button disabled={pending} className="btn-primary">{pending ? "Saving…" : hasPassword ? "Change password" : "Set password"}</button>
    </form>
  );
}
