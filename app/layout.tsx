import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces, Inter, Playfair_Display, Poppins } from "next/font/google";
import Providers from "@/components/Providers";
import { currentUser, publicUser } from "@/lib/auth";
import { brandCss, iconVersion } from "@/lib/brand";
import { getBrand, prefs } from "@/lib/server-utils";
import "./globals.css";

// All font presets are declared; the browser only downloads the ones the brand's preset actually uses.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });
const dmsans = DM_Sans({ variable: "--font-dmsans", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const b = getBrand();
  const v = `?v=${iconVersion(b)}`;
  return {
    title: { default: `${b.name} — ${b.tagline}`, template: `%s · ${b.name}` },
    description: b.description,
    applicationName: b.name,
    appleWebApp: { capable: true, title: b.shortName, statusBarStyle: "default" },
    icons: { icon: [{ url: `/icons/32${v}`, sizes: "32x32" }, { url: `/icons/192${v}`, sizes: "192x192" }], apple: `/icons/180${v}` },
    openGraph: { siteName: b.name, title: b.name, description: b.description, images: [`/icons/512${v}`] },
  };
}
export async function generateViewport(): Promise<Viewport> {
  return { themeColor: getBrand().primary };
}

// Applies the "system" theme before paint to avoid a light flash in dark mode.
const themeScript = `try{if(!document.documentElement.classList.contains('dark')&&!document.documentElement.classList.contains('light')&&matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [p, u] = await Promise.all([prefs(), currentUser()]);
  const brand = getBrand();
  const theme = p.theme === "system" && brand.defaultTheme !== "system" && !p.themeSet ? brand.defaultTheme : p.theme;
  return (
    <html lang={p.lang} className={`${inter.variable} ${fraunces.variable} ${poppins.variable} ${playfair.variable} ${dmsans.variable} ${theme === "dark" ? "dark" : theme === "light" ? "light" : ""}`} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandCss(brand) }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <Providers user={u ? publicUser(u) : null} lang={p.lang} currency={p.currency} theme={theme} brand={brand}>{children}</Providers>
      </body>
    </html>
  );
}
