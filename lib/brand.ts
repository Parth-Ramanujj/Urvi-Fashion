// White-label brand settings (pure; safe for client and server). Everything customer-visible that names or styles
// the store comes from here, edited in Admin → Branding.

export const FONT_PRESETS = {
  classic: { label: "Classic — serif headings", head: "var(--font-fraunces)", body: "var(--font-inter)" },
  modern: { label: "Modern — geometric", head: "var(--font-poppins)", body: "var(--font-inter)" },
  elegant: { label: "Elegant — luxury serif", head: "var(--font-playfair)", body: "var(--font-dmsans)" },
  minimal: { label: "Minimal — all sans", head: "var(--font-inter)", body: "var(--font-inter)" },
} as const;
export type FontPreset = keyof typeof FONT_PRESETS;

export interface Brand {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  /** Wide logo image (header, invoice). Falls back to the store name as a wordmark. */
  logo?: string;
  /** Square app icon / favicon image. Falls back to the first letter on the brand colour. */
  icon?: string;
  wordmarkDot: boolean;
  primary: string;
  font: FontPreset;
  defaultTheme: "light" | "dark" | "system";
  announcement: { enabled: boolean; text: string };
  footerAbout: string;
  contact: { email: string; phone: string; whatsapp: string; address: string };
  legal: { company: string; gstin: string; address: string; invoiceNote: string };
  orderPrefix: string;
  membershipName: string;
  coinName: string;
  /** Show the demo login hints on the login page (turn off for real stores). */
  showDemoLogins: boolean;
  /**
   * Android app built from this site (PWABuilder/Bubblewrap). Served as /.well-known/assetlinks.json so Android
   * trusts the app and opens it full-screen instead of showing a URL bar.
   */
  android: { packageName: string; sha256: string[] };
}

export const DEFAULT_BRAND: Brand = {
  name: "Threadly",
  shortName: "Threadly",
  tagline: "Modern clothing for everyone",
  description: "Shop men's, women's and kids' fashion, accessories and seasonal edits with fast delivery and easy returns.",
  wordmarkDot: true,
  primary: "#f45d17",
  font: "classic",
  defaultTheme: "system",
  announcement: { enabled: true, text: "Free delivery over ₹999 · Easy 14-day returns · Code WELCOME10 for 10% off" },
  footerAbout: "Considered clothing for every day. Free delivery over ₹999 and 14-day easy returns.",
  contact: { email: "support@threadly.dev", phone: "+91 98765 43210", whatsapp: "919876543210", address: "4th Floor, Indiranagar, Bengaluru 560038" },
  legal: { company: "Threadly Retail Pvt. Ltd.", gstin: "29ABCDE1234F1Z5", address: "4th Floor, Indiranagar, Bengaluru 560038", invoiceNote: "This is a computer-generated invoice and does not require a signature." },
  orderPrefix: "TH",
  membershipName: "Plus",
  coinName: "coins",
  showDemoLogins: true,
  android: { packageName: "", sha256: [] },
};

/** Brand for a fresh (non-demo) store: neutral copy, name from setup. */
export const blankBrand = (name: string): Brand => ({
  ...DEFAULT_BRAND,
  name, shortName: name.slice(0, 12), tagline: "Fashion for everyone", description: `Shop the latest styles at ${name}.`,
  announcement: { enabled: false, text: "" }, footerAbout: `${name} — quality clothing, delivered.`,
  contact: { email: "", phone: "", whatsapp: "", address: "" }, legal: { company: name, gstin: "", address: "", invoiceNote: DEFAULT_BRAND.legal.invoiceNote },
  orderPrefix: name.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase() || "ORD", showDemoLogins: false,
});

const mixHex = (hex: string, to: string, t: number) => {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  return `#${[16, 8, 0].map((s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t).toString(16).padStart(2, "0")).join("")}`;
};
export const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

/** 50–900 shades from one brand colour (lighter steps mix in white, darker mix in black). */
export function palette(primary: string) {
  const c = isHex(primary) ? primary : DEFAULT_BRAND.primary;
  const steps: [number, string, number][] = [[50, "#ffffff", 0.93], [100, "#ffffff", 0.85], [200, "#ffffff", 0.68], [300, "#ffffff", 0.46], [400, "#ffffff", 0.22], [500, c, 0], [600, "#000000", 0.12], [700, "#000000", 0.28], [800, "#000000", 0.42], [900, "#000000", 0.55]];
  return Object.fromEntries(steps.map(([k, to, t]) => [k, t ? mixHex(c, to, t) : c])) as Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;
}

/** CSS variables consumed by the Tailwind theme (brand-* colours, heading/body fonts). */
export function brandCss(b: Pick<Brand, "primary" | "font">) {
  const p = palette(b.primary);
  const f = FONT_PRESETS[b.font] ?? FONT_PRESETS.classic;
  return `:root{${Object.entries(p).map(([k, v]) => `--brand-${k}:${v}`).join(";")};--font-head:${f.head};--font-body:${f.body}}`;
}

export const memberProgram = (b: Pick<Brand, "name" | "membershipName">) => `${b.name} ${b.membershipName}`.trim();

/** Changes whenever the icon, colour or name changes, so browsers/phones fetch the new app icon instead of a cached one. */
export function iconVersion(b: Pick<Brand, "icon" | "primary" | "name" | "wordmarkDot">) {
  let h = 0;
  for (const ch of `${b.icon ?? ""}|${b.primary}|${b.name}|${b.wordmarkDot}`) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}
