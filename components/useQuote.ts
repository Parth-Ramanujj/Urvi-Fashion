"use client";
import { useEffect, useState } from "react";
import { quote } from "@/lib/actions";
import type { DeliverySpeed } from "@/lib/pricing";
import { useApp } from "./Providers";

export type Quote = Awaited<ReturnType<typeof quote>>;

/** Server-priced view of the local cart; re-runs whenever the bag, coupon or delivery speed changes. */
export function useQuote(coupon: string, speed: DeliverySpeed, useCoins = false, addressId?: string) {
  const { cart } = useApp();
  const [q, setQ] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(cart.map((l) => [l.productId, l.color, l.size, l.qty]));
  useEffect(() => {
    let live = true;
    setLoading(true);
    quote(cart.map(({ productId, color, size, qty }) => ({ productId, color, size, qty })), coupon || undefined, speed, useCoins, addressId)
      .then((r) => { if (live) { setQ(r); setLoading(false); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, coupon, speed, useCoins, addressId]);
  const line = (sku: string) => { const l = cart.find((x) => x.sku === sku); return q?.lines.find((x) => x.productId === l?.productId && x.color === l?.color && x.size === l?.size); };
  return { q, loading, line };
}
