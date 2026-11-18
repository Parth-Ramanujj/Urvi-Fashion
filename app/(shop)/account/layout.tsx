import { pageUser } from "@/lib/auth";
import AccountNav from "./AccountNav";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const u = await pageUser("/account");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-brand-500 text-xl font-bold text-white">{u.name[0]?.toUpperCase()}</span>
        <div><h1 className="font-display text-2xl font-bold">{u.name}</h1><p className="text-sm text-zinc-500">{u.email ?? `+91 ${u.phone}`}</p></div>
      </div>
      <div className="mt-6 gap-8 md:flex">
        <AccountNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
