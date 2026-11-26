"use client";
import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
        <AlertTriangle className="size-7" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-zinc-500">We hit an unexpected error loading this page. Please try again in a moment.</p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="btn-primary"><RefreshCw className="size-4" />Try again</button>
        <Link href="/" className="btn-ghost">Go home</Link>
      </div>
    </div>
  );
}
