import ProductArt from "./ProductArt";
import type { ArtKind } from "@/lib/types";

/** Renders either a real image URL or a built-in "art:kind:hex:view" image string. */
export default function ProductImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  if (src?.startsWith("art:")) {
    const [, kind, hex, view] = src.split(":");
    return <ProductArt kind={kind as ArtKind} hex={hex} view={view} className={`h-full w-full ${className}`} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={`h-full w-full object-cover ${className}`} />;
}
