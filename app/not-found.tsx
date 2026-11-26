import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
        <SearchX className="size-7" />
      </span>
      <h1 className="mt-4 font-display text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-sm text-zinc-500">The page you&apos;re looking for doesn&apos;t exist or may have been moved.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/shop" className="btn-primary">Browse shop</Link>
        <Link href="/" className="btn-ghost">Go home</Link>
      </div>
    </div>
  );
}
