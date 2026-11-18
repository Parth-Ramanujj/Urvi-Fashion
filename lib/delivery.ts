// City-based delivery rules (pure). Checkout, quote and order placement resolve fees, ETAs, express and COD from here.
import type { DeliverySettings } from "./types";

export type Speed = "standard" | "express";
export type DeliveryQuote = {
  serviceable: boolean; city: string | null; freeAbove: number; cod: boolean;
  options: Record<Speed, { available: boolean; fee: number; days: [number, number] }>;
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function deliveryFor(s: DeliverySettings, city?: string | null): DeliveryQuote {
  const rule = city ? s.cities.find((c) => c.active && norm(c.name) === norm(city)) : undefined;
  if (rule) return {
    serviceable: true, city: rule.name, freeAbove: s.freeAbove, cod: rule.cod,
    options: { standard: { available: true, fee: rule.standardFee, days: rule.standardDays }, express: { available: rule.express, fee: rule.expressFee, days: rule.expressDays } },
  };
  return {
    serviceable: !city || !s.restrictToCities, city: null, freeAbove: s.freeAbove, cod: true,
    options: { standard: { available: true, fee: s.standardFee, days: [4, 6] }, express: { available: true, fee: s.expressFee, days: [1, 2] } },
  };
}
