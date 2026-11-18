"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { FONT_PRESETS, isHex, type Brand } from "./brand";
import { newId } from "./crypto";
import { db, mutate } from "./db";
import { fail, run, saveUpload, str } from "./server-utils";
import { ART_KINDS, type Banner } from "./types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parse<T>(form: FormData): T {
  try { return JSON.parse(String(form.get("data") ?? "")) as T; } catch { return fail("Invalid form data"); }
}
/** Trimmed string with a length range; empty allowed only when min is 0. */
function text(v: unknown, label: string, max: number, min = 0) {
  const s = str(v, 2000);
  if (s.length < min || s.length > max) fail(min ? `${label} must be ${min}–${max} characters` : `${label} must be at most ${max} characters`);
  return s;
}

export async function saveBrand(form: FormData) {
  return run(async () => {
    await requireUser("admin");
    const b = parse<Partial<Brand>>(form);
    const primary = str(b.primary, 7).toLowerCase();
    if (!isHex(primary)) fail("Brand colour must be a hex colour like #f45d17");
    if (!(b.font && b.font in FONT_PRESETS)) fail("Choose a font style");
    if (!["light", "dark", "system"].includes(b.defaultTheme ?? "")) fail("Choose a default theme");
    const email = str(b.contact?.email, 120);
    if (email && !EMAIL.test(email)) fail("Contact email is not valid");
    const whatsapp = str(b.contact?.whatsapp, 20).replace(/\D/g, "");
    if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) fail("WhatsApp number must be 10–15 digits incl. country code");
    const gstin = str(b.legal?.gstin, 20).toUpperCase();
    if (gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(gstin)) fail("GSTIN must be 15 characters (e.g. 24ABCDE1234F1Z5)");
    const orderPrefix = str(b.orderPrefix, 4).toUpperCase();
    if (!/^[A-Z]{2,4}$/.test(orderPrefix)) fail("Order prefix must be 2–4 letters");

    const packageName = str(b.android?.packageName, 150);
    if (packageName && !/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(packageName)) fail("Android package name looks wrong (e.g. app.vercel.clothing_psi_six.twa)");
    const sha256 = (Array.isArray(b.android?.sha256) ? b.android!.sha256 : []).map((f) => str(f, 120).toUpperCase().replace(/[^0-9A-F]/g, "")).filter(Boolean);
    if (sha256.length > 5) fail("Add at most 5 signing fingerprints");
    if (sha256.some((f) => f.length !== 64)) fail("Each SHA-256 fingerprint must be 64 hex characters (colons optional)");
    if (packageName && !sha256.length) fail("Add the app's SHA-256 signing fingerprint too");

    const next: Omit<Brand, "logo" | "icon"> = {
      name: text(b.name, "Store name", 40, 2),
      shortName: text(b.shortName, "Short name", 12, 1),
      tagline: text(b.tagline, "Tagline", 80),
      description: text(b.description, "SEO description", 200),
      wordmarkDot: !!b.wordmarkDot,
      primary, font: b.font!, defaultTheme: b.defaultTheme!,
      announcement: { enabled: !!b.announcement?.enabled, text: text(b.announcement?.text, "Announcement", 140) },
      footerAbout: text(b.footerAbout, "Footer text", 300),
      contact: { email, phone: text(b.contact?.phone, "Phone", 20), whatsapp, address: text(b.contact?.address, "Address", 200) },
      legal: { company: text(b.legal?.company, "Legal company name", 80), gstin, address: text(b.legal?.address, "Registered address", 200), invoiceNote: text(b.legal?.invoiceNote, "Invoice note", 300) },
      orderPrefix,
      membershipName: text(b.membershipName, "Membership name", 20, 1),
      coinName: text(b.coinName, "Coin name", 20, 1),
      showDemoLogins: !!b.showDemoLogins,
      android: { packageName, sha256: sha256.map((f) => f.match(/../g)!.join(":")) },
    };
    const iconFile = form.get("icon");
    // The app-icon renderer (app/icons/[size]) supports PNG and JPEG only.
    if (iconFile instanceof File && iconFile.size > 0 && !["image/png", "image/jpeg"].includes(iconFile.type)) fail("App icon must be a PNG or JPG image");
    const logo = await saveUpload(form.get("logo"));
    const icon = await saveUpload(iconFile);
    mutate((d) => {
      const cur = d.brand!;
      d.brand = {
        ...next,
        logo: logo ?? (form.get("removeLogo") === "1" ? undefined : cur.logo),
        icon: icon ?? (form.get("removeIcon") === "1" ? undefined : cur.icon),
      };
    });
    revalidatePath("/", "layout");
    return db().brand!;
  });
}

export async function saveBanners(form: FormData) {
  return run(async () => {
    await requireUser("admin");
    const list = parse<Banner[]>(form);
    if (!Array.isArray(list) || list.length > 8) fail("You can have up to 8 banners");
    const out: Banner[] = [];
    for (const [i, b] of list.entries()) {
      const n = `Banner ${i + 1}`;
      const href = str(b.href, 200);
      if (!href.startsWith("/") || href.startsWith("//")) fail(`${n}: link must be a page on this site, starting with /`);
      if (!isHex(str(b.from, 7)) || !isHex(str(b.to, 7)) || !isHex(str(b.art?.hex, 7))) fail(`${n}: colours must be hex like #1f2a44`);
      if (!ART_KINDS.includes(b.art?.kind)) fail(`${n}: choose an art style`);
      const id = /^[\w-]{1,24}$/.test(str(b.id, 24)) ? str(b.id, 24) : newId(6);
      const upload = await saveUpload(form.get(`image-${b.id}`));
      out.push({
        id, eyebrow: text(b.eyebrow, `${n} eyebrow`, 40), title: text(b.title, `${n} title`, 60, 1), subtitle: text(b.subtitle, `${n} subtitle`, 140),
        cta: text(b.cta, `${n} button text`, 24, 1), href, from: str(b.from, 7), to: str(b.to, 7), art: { kind: b.art.kind, hex: str(b.art.hex, 7) },
        badge: text(b.badge, `${n} badge`, 20) || undefined, active: b.active !== false,
        // Only keep an image URL that points at our own uploads (never an arbitrary client-supplied URL).
        image: upload ?? (typeof b.image === "string" && b.image.startsWith("/api/files/") ? b.image : undefined),
      });
    }
    mutate((d) => { d.banners = out; });
    revalidatePath("/", "layout");
    return out;
  });
}
