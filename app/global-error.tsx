"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-white p-6 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Service temporarily unavailable</h1>
          <p className="mt-2 text-sm text-zinc-500">The store could not connect to the database. Please try again in a moment.</p>
          <button onClick={reset} className="mt-6 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
