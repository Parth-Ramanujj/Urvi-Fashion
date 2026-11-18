import Link from "next/link";
import { pageUser } from "@/lib/auth";
import Logo from "@/components/Logo";
import { AdminBottomNav, AdminNav } from "./_ui";

export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await pageUser("/admin", "admin");
  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 lg:flex">
      <aside className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-4">
          <Link href="/admin"><Logo className="text-xl" suffix={<span className="font-sans text-xs font-semibold uppercase tracking-wider text-zinc-400">admin</span>} /></Link>
        </div>
        <AdminNav />
        <p className="hidden px-5 pt-6 text-xs text-zinc-500 lg:block">Signed in as<br /><b className="text-zinc-700 dark:text-zinc-300">{me.name}</b></p>
      </aside>
      <main className="min-w-0 flex-1 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6 lg:p-8">{children}</main>
      <AdminBottomNav />
    </div>
  );
}
