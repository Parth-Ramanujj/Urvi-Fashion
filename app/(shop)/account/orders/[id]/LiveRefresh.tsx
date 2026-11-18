"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches the server-rendered order every 15s while it's in transit, so admin/rider status changes show up live. */
export default function LiveRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), 15_000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}
