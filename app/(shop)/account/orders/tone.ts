import type { OrderStatus } from "@/lib/types";

export const statusTone = (s: OrderStatus) =>
  s === "delivered" || s === "exchanged" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
  : s === "cancelled" || s === "return_rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
  : s.includes("return") || s.includes("exchange") ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
  : "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400";
