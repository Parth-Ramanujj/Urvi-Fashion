"use client";
import { useTransition } from "react";
import { saveAddress } from "@/lib/actions";
import type { Address } from "@/lib/types";
import { useApp } from "./Providers";

const STATES = ["Andhra Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu & Kashmir", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal"];

export default function AddressForm({ initial, onSaved, onCancel }: { initial?: Address; onSaved: (a: Address) => void; onCancel?: () => void }) {
  const { toast } = useApp();
  const [pending, start] = useTransition();
  const submit = (fd: FormData) => start(async () => {
    const r = await saveAddress({ ...Object.fromEntries(fd) as unknown as Address, id: initial?.id, isDefault: fd.get("isDefault") === "on" });
    if (!r.ok) return toast(r.error, "err");
    toast("Address saved"); onSaved(r.data);
  });
  const f = (name: keyof Address, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block"><span className="label">{label}</span><input name={name} defaultValue={(initial?.[name] as string) ?? ""} className="input" {...props} /></label>
  );
  return (
    <form action={submit} className="grid gap-3 sm:grid-cols-2">
      {f("name", "Full name", { required: true, autoComplete: "name" })}
      {f("phone", "Mobile", { required: true, inputMode: "numeric", pattern: "[6-9]\\d{9}", maxLength: 10, autoComplete: "tel-national", title: "10-digit mobile number" })}
      <div className="sm:col-span-2">{f("line1", "House / flat, street", { required: true, autoComplete: "address-line1" })}</div>
      <div className="sm:col-span-2">{f("line2", "Area, landmark (optional)", { autoComplete: "address-line2" })}</div>
      {f("pincode", "PIN code", { required: true, inputMode: "numeric", pattern: "\\d{6}", maxLength: 6, autoComplete: "postal-code" })}
      {f("city", "City", { required: true, autoComplete: "address-level2" })}
      <label className="block"><span className="label">State</span><select name="state" required defaultValue={initial?.state ?? ""} className="input"><option value="" disabled>Select state</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
      <div><span className="label">Save as</span><div className="flex gap-2">{(["Home", "Work", "Other"] as const).map((l) => <label key={l} className="chip cursor-pointer text-xs has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-900 has-[:checked]:text-white dark:has-[:checked]:bg-white dark:has-[:checked]:text-zinc-900"><input type="radio" name="label" value={l} defaultChecked={(initial?.label ?? "Home") === l} className="sr-only" />{l}</label>)}</div></div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="isDefault" defaultChecked={initial?.isDefault} className="size-4 accent-zinc-900" />Make this my default address</label>
      <div className="flex gap-2 sm:col-span-2">
        <button disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save address"}</button>
        {onCancel && <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>}
      </div>
    </form>
  );
}
