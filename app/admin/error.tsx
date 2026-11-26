"use client";
import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="card mx-auto my-12 max-w-md p-8 text-center">
      <AlertTriangle className="mx-auto size-8 text-red-500" />
      <h1 className="mt-3 text-xl font-bold">Admin page error</h1>
      <p className="mt-1 text-sm text-zinc-500">Could not load this section. Check your database connection or try again.</p>
      <div className="mt-5 flex justify-center gap-2">
        <button onClick={reset} className="btn-primary"><RefreshCw className="size-4" />Retry</button>
        <Link href="/admin" className="btn-ghost">Overview</Link>
      </div>
    </div>
  );
}
