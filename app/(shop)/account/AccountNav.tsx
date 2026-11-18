"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/components/Providers";
import { memberProgram } from "@/lib/brand";
import { Coins, Crown, Heart, LifeBuoy, MapPin, Package, User } from "lucide-react";

const LINKS = [["/account", "Profile & sizes", User], ["/account/orders", "Orders", Package], ["/account/rewards", "Rewards & referrals", Coins], ["/membership", "", Crown], ["/account/addresses", "Addresses", MapPin], ["/wishlist", "Wishlist", Heart], ["/account/support", "Help & support", LifeBuoy]] as const;

export default function AccountNav() {
  const path = usePathname();
  const { brand } = useApp();
  return (
    <nav className="no-scrollbar -mx-4 mb-6 flex gap-1 overflow-x-auto px-4 md:mx-0 md:mb-0 md:w-56 md:shrink-0 md:flex-col md:px-0">
      {LINKS.map(([href, label, I]) => {
        const on = href === "/account" ? path === href : path.startsWith(href);
        return <Link key={href} href={href} className={`flex shrink-0 items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium transition md:rounded-xl ${on ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}><I className="size-4" />{label || memberProgram(brand)}</Link>;
      })}
    </nav>
  );
}
