"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Ruler } from "lucide-react";
import { useApp } from "@/components/Providers";
import { updateProfile } from "@/lib/actions";
import type { Measurements } from "@/lib/types";

const FIELDS: [keyof Measurements, string, string][] = [["height", "Height", "cm"], ["chest", "Chest / bust", "cm"], ["waist", "Waist", "cm"], ["hips", "Hips", "cm"], ["inseam", "Inseam", "cm"]];

export default function ProfileForm({ name, phone, email, measurements: m, dob, anniversary, specialEvent }: { name: string; phone: string; email: string; measurements: Measurements; dob: string; anniversary: string; specialEvent?: { label: string; date: string } }) {
  const { toast } = useApp();
  const router = useRouter();
  const [pending, start] = useTransition();
  const submit = (fd: FormData) => start(async () => {
    const measurements = Object.fromEntries(FIELDS.map(([k]) => [k, Number(fd.get(k)) || undefined])) as Measurements;
    measurements.fit = (fd.get("fit") as Measurements["fit"]) || undefined;
    const evLabel = String(fd.get("evLabel") ?? "").trim();
    const evDate = String(fd.get("evDate") ?? "").trim();
    const r = await updateProfile({
      name: String(fd.get("name")), phone: String(fd.get("phone") ?? "") || undefined, measurements,
      dob: String(fd.get("dob") ?? "") || undefined, anniversary: String(fd.get("anniversary") ?? "") || undefined,
      specialEvent: evLabel && evDate ? { label: evLabel, date: evDate } : undefined,
    });
    if (!r.ok) return toast(r.error, "err");
    toast("Profile saved"); router.refresh();
  });
  return (
    <form action={submit} className="space-y-6">
      <section className="card p-5">
        <h2 className="mb-4 text-lg font-semibold">Personal details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="label">Full name</span><input name="name" defaultValue={name} required className="input" autoComplete="name" /></label>
          <label><span className="label">Mobile</span><input name="phone" defaultValue={phone} inputMode="numeric" maxLength={10} pattern="[6-9]\d{9}" className="input" autoComplete="tel-national" /></label>
          <label><span className="label">Email</span><input value={email || "—"} disabled className="input opacity-60" /></label>
          <label><span className="label">Birthday 🎂</span><input name="dob" type="date" defaultValue={dob} disabled={!!dob} max={new Date(Date.now() - 5 * 365 * 86_400_000).toISOString().slice(0, 10)} className="input disabled:opacity-60" />
            <span className="mt-1 block text-xs text-zinc-500">{dob ? "Saved — watch for a gift in your birthday month." : "Add it once to get a birthday gift every year."}</span></label>
          <label><span className="label">Anniversary 💍</span><input name="anniversary" type="date" defaultValue={anniversary} className="input" /></label>
          <label><span className="label">Other event name 🎉</span><input name="evLabel" defaultValue={specialEvent?.label ?? ""} maxLength={40} placeholder="e.g. Partner's birthday, Kid's birthday" className="input" /></label>
          <label><span className="label">Other event date</span><input name="evDate" type="date" defaultValue={specialEvent?.date ?? ""} className="input" /></label>
        </div>
      </section>
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Ruler className="size-5" />Measurement profile</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-500">We use these to highlight your best size on every product.</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {FIELDS.map(([k, l, u]) => <label key={k}><span className="label">{l} ({u})</span><input name={k} type="number" min={1} max={299} defaultValue={m[k] as number | undefined} className="input" /></label>)}
          <label><span className="label">Preferred fit</span><select name="fit" defaultValue={m.fit ?? ""} className="input"><option value="">No preference</option><option value="slim">Slim</option><option value="regular">Regular</option><option value="relaxed">Relaxed</option></select></label>
        </div>
      </section>
      <button disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save changes"}</button>
    </form>
  );
}
