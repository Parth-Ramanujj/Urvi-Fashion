import type { MetadataRoute } from "next";
import { iconVersion } from "@/lib/brand";
import { getBrand } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

// Installable app for customers (and a "Shop manager" shortcut for the owner), named and coloured from Admin → Branding.
export default function manifest(): MetadataRoute.Manifest {
  const b = getBrand();
  const v = `?v=${iconVersion(b)}`;
  return {
    name: `${b.name} — ${b.tagline}`,
    short_name: b.shortName,
    description: b.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: b.primary,
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: `/icons/192${v}`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/icons/512${v}`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/icons/512${v}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My orders", url: "/account/orders", icons: [{ src: `/icons/192${v}`, sizes: "192x192" }] },
      { name: "Rewards", url: "/account/rewards", icons: [{ src: `/icons/192${v}`, sizes: "192x192" }] },
      { name: "Shop manager", short_name: "Admin", url: "/admin", icons: [{ src: `/icons/192${v}`, sizes: "192x192" }] },
    ],
  };
}
