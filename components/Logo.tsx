"use client";
import { useApp } from "./Providers";

/** Store logo: the uploaded logo image, or the store name as a wordmark in the brand font/colour. */
export default function Logo({ className = "text-2xl", suffix }: { className?: string; suffix?: React.ReactNode }) {
  const { brand } = useApp();
  return (
    <span className={`inline-flex items-center gap-2 font-display font-bold tracking-tight ${className}`}>
      {brand.logo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={brand.logo} alt={brand.name} className="h-[1.4em] w-auto max-w-[180px] object-contain" />
        : <span>{brand.name}{brand.wordmarkDot && <span className="text-brand-500">.</span>}</span>}
      {suffix}
    </span>
  );
}
