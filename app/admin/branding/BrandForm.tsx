"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ImagePlus, Trash2 } from "lucide-react";
import { useApp } from "@/components/Providers";
import { FONT_PRESETS, isHex, memberProgram, palette, type Brand, type FontPreset } from "@/lib/brand";
import { saveBrand } from "@/lib/brand-admin";
import { Toggle } from "../retention/Retention";

const SWATCHES = ["#f45d17", "#e11d48", "#7c3aed", "#2563eb", "#0d9488", "#16a34a", "#ca8a04", "#18181b"];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}</label>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card space-y-4 p-5"><h2 className="font-semibold">{title}</h2>{children}</section>;
}

/** Square app icon: uploaded image, or the auto icon (first letter on the brand gradient) the app generates. */
function IconTile({ src, name, primary, size = 64 }: { src?: string; name: string; primary: string; size?: number }) {
  const p = palette(primary);
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="App icon" style={{ width: size, height: size }} className="rounded-2xl object-cover shadow" />
    : <span style={{ width: size, height: size, background: `linear-gradient(135deg, ${p[500]}, ${p[700]})`, fontSize: size * 0.55 }} className="grid place-items-center rounded-2xl font-extrabold text-white shadow">{(name.trim()[0] ?? "S").toUpperCase()}</span>;
}

export default function BrandForm({ initial }: { initial: Brand }) {
  const { toast } = useApp();
  const router = useRouter();
  const [b, setB] = useState<Brand>(initial);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof Brand>(k: K, v: Brand[K]) => setB((x) => ({ ...x, [k]: v }));
  const setIn = <K extends "contact" | "legal" | "announcement">(k: K, patch: Partial<Brand[K]>) => setB((x) => ({ ...x, [k]: { ...x[k], ...patch } }));

  const logoUrl = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : removeLogo ? undefined : b.logo), [logoFile, removeLogo, b.logo]);
  const iconUrl = useMemo(() => (iconFile ? URL.createObjectURL(iconFile) : removeIcon ? undefined : b.icon), [iconFile, removeIcon, b.icon]);
  const pal = palette(isHex(b.primary) ? b.primary : initial.primary);
  const previewVars = Object.fromEntries(Object.entries(pal).map(([k, v]) => [`--brand-${k}`, v])) as React.CSSProperties;
  const font = FONT_PRESETS[b.font] ?? FONT_PRESETS.classic;
  const sampleRef = `${(b.orderPrefix || "AB").toUpperCase()}${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-1A2B3C4D`;

  const save = () => start(async () => {
    const fd = new FormData();
    fd.set("data", JSON.stringify(b));
    if (logoFile) fd.set("logo", logoFile);
    if (iconFile) fd.set("icon", iconFile);
    if (removeLogo) fd.set("removeLogo", "1");
    if (removeIcon) fd.set("removeIcon", "1");
    const r = await saveBrand(fd);
    if (!r.ok) return toast(r.error, "err");
    setB(r.data); setLogoFile(null); setIconFile(null); setRemoveLogo(false); setRemoveIcon(false);
    toast("Branding saved — the whole store is updated");
    router.refresh();
  });

  const upload = (label: string, url: string | undefined, onFile: (f: File) => void, onRemove: () => void, tile: React.ReactNode) => (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        {tile}
        <label className="btn-ghost cursor-pointer py-2"><ImagePlus className="size-4" />{url ? "Replace" : "Upload"}
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        </label>
        {url && <button type="button" onClick={onRemove} className="btn-ghost py-2 text-red-600" aria-label={`Remove ${label}`}><Trash2 className="size-4" /></button>}
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <Section title="Identity">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Store name"><input className="input" value={b.name} maxLength={40} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Short name" hint="Under the app icon on phones (max 12)"><input className="input" value={b.shortName} maxLength={12} onChange={(e) => set("shortName", e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="Tagline"><input className="input" value={b.tagline} maxLength={80} onChange={(e) => set("tagline", e.target.value)} /></Field></div>
          </div>
          <Toggle label="Show a coloured dot after the name (text logo only)" on={b.wordmarkDot} onChange={(v) => set("wordmarkDot", v)} />
          <div className="grid gap-5 sm:grid-cols-2">
            {upload("Logo (wide, PNG with transparent background)", logoUrl, (f) => { setLogoFile(f); setRemoveLogo(false); }, () => { setLogoFile(null); setRemoveLogo(true); },
              <span className="grid h-16 w-32 place-items-center overflow-hidden rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {logoUrl ? <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-zinc-400">Text logo</span>}
              </span>)}
            {upload("App icon (square, 512×512)", iconUrl, (f) => { setIconFile(f); setRemoveIcon(false); }, () => { setIconFile(null); setRemoveIcon(true); },
              <IconTile src={iconUrl} name={b.name} primary={pal[500]} />)}
          </div>
          {!iconUrl && <p className="text-xs text-zinc-500">No icon uploaded: the app icon and favicon are generated from your first letter on the brand colour (shown above).</p>}
        </Section>

        <Section title="Look">
          <div>
            <span className="label">Brand colour</span>
            <div className="flex flex-wrap items-center gap-2">
              <input type="color" value={isHex(b.primary) ? b.primary : "#000000"} onChange={(e) => set("primary", e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-zinc-300 bg-transparent dark:border-zinc-700" aria-label="Pick brand colour" />
              <input className="input w-32 font-mono" value={b.primary} maxLength={7} onChange={(e) => set("primary", e.target.value)} aria-label="Brand colour hex" />
              {SWATCHES.map((c) => <button key={c} type="button" onClick={() => set("primary", c)} aria-label={c} className={`size-8 rounded-full ring-offset-2 dark:ring-offset-zinc-900 ${b.primary === c ? "ring-2 ring-zinc-900 dark:ring-white" : ""}`} style={{ background: c }} />)}
            </div>
            {!isHex(b.primary) && <p className="mt-1 text-xs text-red-600">Enter a 6-digit hex colour like #f45d17</p>}
            <div className="mt-3 flex overflow-hidden rounded-xl">{Object.entries(pal).map(([k, v]) => <span key={k} title={`${k} ${v}`} className="h-8 flex-1" style={{ background: v }} />)}</div>
          </div>
          <div>
            <span className="label">Font style</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(FONT_PRESETS) as FontPreset[]).map((k) => (
                <button key={k} type="button" onClick={() => set("font", k)} className={`rounded-2xl border p-4 text-left transition ${b.font === k ? "border-zinc-900 ring-1 ring-zinc-900 dark:border-white dark:ring-white" : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700"}`}>
                  <span className="block text-xl font-bold" style={{ fontFamily: FONT_PRESETS[k].head }}>{b.name || "Your store"}</span>
                  <span className="block text-xs text-zinc-500" style={{ fontFamily: FONT_PRESETS[k].body }}>{FONT_PRESETS[k].label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Default theme for new visitors</span>
            <div className="flex gap-2">{(["light", "dark", "system"] as const).map((t) => <button key={t} type="button" onClick={() => set("defaultTheme", t)} className={`chip capitalize ${b.defaultTheme === t ? "chip-on" : ""}`}>{t}</button>)}</div>
          </div>
        </Section>

        <Section title="Store content">
          <Toggle label="Announcement bar at the top of the store" on={b.announcement.enabled} onChange={(v) => setIn("announcement", { enabled: v })} />
          <Field label="Announcement text"><input className="input" value={b.announcement.text} maxLength={140} onChange={(e) => setIn("announcement", { text: e.target.value })} /></Field>
          <Field label="Footer about text"><textarea className="input" rows={2} value={b.footerAbout} maxLength={300} onChange={(e) => set("footerAbout", e.target.value)} /></Field>
          <Field label="SEO description" hint="Shown in Google results and link previews"><textarea className="input" rows={2} value={b.description} maxLength={200} onChange={(e) => set("description", e.target.value)} /></Field>
        </Section>

        <Section title="Contact & legal">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Support email"><input className="input" type="email" value={b.contact.email} onChange={(e) => setIn("contact", { email: e.target.value })} /></Field>
            <Field label="Support phone"><input className="input" value={b.contact.phone} maxLength={20} onChange={(e) => setIn("contact", { phone: e.target.value })} /></Field>
            <Field label="WhatsApp number" hint="With country code, digits only (e.g. 919876543210)"><input className="input" inputMode="numeric" value={b.contact.whatsapp} onChange={(e) => setIn("contact", { whatsapp: e.target.value.replace(/\D/g, "") })} /></Field>
            <Field label="Store address"><input className="input" value={b.contact.address} maxLength={200} onChange={(e) => setIn("contact", { address: e.target.value })} /></Field>
            <Field label="Legal company name (invoice)"><input className="input" value={b.legal.company} maxLength={80} onChange={(e) => setIn("legal", { company: e.target.value })} /></Field>
            <Field label="GSTIN"><input className="input font-mono uppercase" value={b.legal.gstin} maxLength={15} onChange={(e) => setIn("legal", { gstin: e.target.value.toUpperCase() })} /></Field>
            <div className="sm:col-span-2"><Field label="Registered address (invoice)"><input className="input" value={b.legal.address} maxLength={200} onChange={(e) => setIn("legal", { address: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Invoice footer note"><textarea className="input" rows={2} value={b.legal.invoiceNote} maxLength={300} onChange={(e) => setIn("legal", { invoiceNote: e.target.value })} /></Field></div>
          </div>
        </Section>

        <Section title="Programme names">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Order number prefix" hint={`New orders: ${sampleRef}`}><input className="input font-mono uppercase" value={b.orderPrefix} maxLength={4} onChange={(e) => set("orderPrefix", e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} /></Field>
            <Field label="Membership name" hint={`Shown as “${memberProgram(b)}”`}><input className="input" value={b.membershipName} maxLength={20} onChange={(e) => set("membershipName", e.target.value)} /></Field>
            <Field label="Reward coin name" hint={`e.g. “120 ${b.coinName || "coins"}”`}><input className="input" value={b.coinName} maxLength={20} onChange={(e) => set("coinName", e.target.value)} /></Field>
          </div>
        </Section>

        <Section title="Demo mode">
          <Toggle label="Show demo login hints on the login page" on={b.showDemoLogins} onChange={(v) => set("showDemoLogins", v)} />
          {b.showDemoLogins && <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"><AlertTriangle className="size-4 shrink-0" />Turn this off for a real store — it shows demo account passwords to every visitor.</p>}
        </Section>

        <div className="sticky bottom-20 z-10 md:bottom-4"><button onClick={save} disabled={pending || !isHex(b.primary)} className="btn-primary w-full py-3 shadow-lg sm:w-auto">{pending ? "Saving…" : "Save branding"}</button></div>
      </div>

      {/* Live preview with the edited palette applied locally */}
      <aside className="xl:sticky xl:top-6 xl:self-start" style={previewVars}>
        <p className="label">Live preview</p>
        <div className="card overflow-hidden" style={{ fontFamily: font.body }}>
          {b.announcement.enabled && b.announcement.text && <p className="bg-zinc-900 px-3 py-1.5 text-center text-[10px] text-white">{b.announcement.text}</p>}
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <span className="text-lg font-bold" style={{ fontFamily: font.head }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logoUrl ? <img src={logoUrl} alt="" className="h-6 w-auto max-w-[140px] object-contain" /> : <>{b.name || "Store"}{b.wordmarkDot && <span style={{ color: pal[500] }}>.</span>}</>}
            </span>
            <span className="size-6 rounded-full" style={{ background: pal[500] }} />
          </div>
          <div className="space-y-3 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">{b.tagline}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: font.head }}>New season edit</p>
            <p className="text-sm"><b style={{ color: pal[600] }}>₹1,299</b> <span className="text-zinc-400 line-through">₹2,499</span> <span className="badge" style={{ background: pal[100], color: pal[700] }}>48% off</span></p>
            <button type="button" className="btn w-full text-white" style={{ background: pal[500] }}>Add to bag</button>
            <p className="rounded-xl p-2 text-center text-xs" style={{ background: pal[50], color: pal[700] }}>👑 Join {memberProgram(b)} · earn 50 {b.coinName}</p>
          </div>
          <div className="flex items-center gap-3 border-t border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
            <IconTile src={iconUrl} name={b.name} primary={pal[500]} size={52} />
            <div><p className="text-sm font-semibold">{b.shortName || "Store"}</p><p className="text-xs text-zinc-500">Home-screen app icon</p></div>
          </div>
        </div>
      </aside>
    </div>
  );
}
